import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '../../../../lib/adminAuth';
import { LIMITS, isAppid, isUuid, normalizePostUrl, postTypeFor, postedAtIso } from '../../../../lib/curatorImport';

// 체크한 게임을 curator_posts에 연결하고, DB에 없는 게임은 curator_game_queue(추가 대기열)에 넣는다 (대기열은 데일리가 가져온 뒤 같은 게시물에 자동 연결)
// 같은 (계정, 게임, 게시물)은 건너뛴다. 삭제·덮어쓰기 없음
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const todayKst = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return fail('Unauthorized', 401);
  const body = await req.json().catch(() => ({}));

  if (!isUuid(body.curatorId)) return fail('계정을 골라 주세요.');
  const postUrl = normalizePostUrl(body.postUrl);
  if (!postUrl) return fail('인스타그램 게시물 링크(…/p/코드)가 아니에요.');
  const postedAt = postedAtIso(typeof body.postedAt === 'string' && body.postedAt ? body.postedAt : todayKst());
  if (!postedAt) return fail('게시 날짜 형식이 틀렸어요.');
  const postTitle = typeof body.postTitle === 'string' ? body.postTitle.trim().slice(0, LIMITS.title) || null : null;

  const gameIds: string[] = [...new Set<string>((Array.isArray(body.gameIds) ? body.gameIds : []).filter(isUuid))];
  const queueRaw: { appid: string; name: string }[] = [];
  for (const q of Array.isArray(body.queue) ? body.queue : []) {
    if (isAppid(q?.appid) && !queueRaw.some((x) => x.appid === q.appid)) queueRaw.push({ appid: q.appid, name: String(q.name || '').slice(0, 120) });
  }
  if (gameIds.length > LIMITS.names || queueRaw.length > LIMITS.names) return fail(`한 번에 ${LIMITS.names}개까지 가능해요.`);
  if (!gameIds.length && !queueRaw.length) return fail('연결할 게임을 체크해 주세요.');

  const { data: curator, error: cErr } = await supabase.from('curators').select('id').eq('id', body.curatorId).maybeSingle();
  if (cErr) return fail(cErr.message, 500);
  if (!curator) return fail('없는 계정이에요.');

  // 보내온 게임 id가 실제로 보이는 게임인지 확인 (숨긴 게임·없는 id는 뺌)
  const notes: string[] = [];
  let validIds: string[] = [];
  if (gameIds.length) {
    const { data, error } = await supabase.from('games').select('id').in('id', gameIds).eq('hidden', false);
    if (error) return fail(error.message, 500);
    validIds = (data || []).map((g) => g.id as string);
    if (validIds.length < gameIds.length) notes.push(`숨겼거나 없는 게임 ${gameIds.length - validIds.length}개는 뺐어요`);
  }

  // 대기열 후보 중 이미 DB에 있는 게임은 대기열 대신 바로 연결 (숨긴 게임은 건너뜀)
  let queueList = queueRaw;
  if (queueRaw.length) {
    const { data, error } = await supabase.from('games').select('id, hidden, steam_appid').in('steam_appid', queueRaw.map((q) => q.appid));
    if (error) return fail(error.message, 500);
    const have = new Map((data || []).map((g) => [g.steam_appid as string, g]));
    queueList = [];
    for (const q of queueRaw) {
      const g = have.get(q.appid);
      if (!g) queueList.push(q);
      else if (g.hidden) notes.push(`${q.name || q.appid}은(는) 숨긴 게임이라 건너뜀`);
      else if (!validIds.includes(g.id as string)) validIds.push(g.id as string);
    }
  }

  const postType = postTypeFor(validIds.length + queueList.length);
  const result = { linked: 0, alreadyLinked: 0, queued: 0, alreadyQueued: 0, postType, notes };

  if (validIds.length) {
    const rows = validIds.map((game_id) => ({ curator_id: body.curatorId, game_id, post_url: postUrl, post_type: postType, post_title: postTitle, posted_at: postedAt }));
    const { data, error } = await supabase
      .from('curator_posts')
      .upsert(rows, { onConflict: 'curator_id,game_id,post_url', ignoreDuplicates: true })
      .select('game_id');
    if (error) return fail(`연결 실패: ${error.message}`, 500);
    result.linked = data?.length ?? 0;
    result.alreadyLinked = validIds.length - result.linked;
  }

  if (queueList.length) {
    const rows = queueList.map((q) => ({ appid: q.appid, curator_id: body.curatorId, post_url: postUrl, post_type: postType, post_title: postTitle, posted_at: postedAt }));
    const { data, error } = await supabase
      .from('curator_game_queue')
      .upsert(rows, { onConflict: 'appid,curator_id,post_url', ignoreDuplicates: true })
      .select('appid');
    if (error) {
      const hint = /curator_game_queue/.test(error.message) ? ' — 마이그레이션 20261031090000_curator_game_queue.sql 실행이 필요해요' : '';
      return fail(`대기열 추가 실패: ${error.message}${hint}`, 500);
    }
    result.queued = data?.length ?? 0;
    result.alreadyQueued = queueList.length - result.queued;
  }

  return NextResponse.json(result);
}
