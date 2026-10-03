import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '../../../lib/adminAuth';
import { db, fail } from '../../../lib/community';

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const TYPES = ['post', 'comment', 'game_comment'] as const;
type TargetType = (typeof TYPES)[number];

type Report = { target_type: TargetType; target_id: number; reason: string | null; created_at: string };

// 처리 안 된 신고를 대상(글·댓글·게임 의견)별로 묶어서 + 대상 미리보기 (reporter_hash는 내보내지 않음)
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const { data, error } = await db.from('post_reports')
    .select('target_type, target_id, reason, created_at')
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) return fail(error.message, 500);

  const groups = new Map<string, { type: TargetType; id: number; count: number; reasons: Record<string, number>; latest: string }>();
  for (const r of (data || []) as Report[]) {
    const key = `${r.target_type}:${r.target_id}`;
    const g = groups.get(key) || { type: r.target_type, id: r.target_id, count: 0, reasons: {}, latest: r.created_at };
    g.count++;
    const reason = r.reason || '사유 없음';
    g.reasons[reason] = (g.reasons[reason] || 0) + 1;
    groups.set(key, g);
  }
  const idsOf = (t: TargetType) => [...groups.values()].filter((g) => g.type === t).map((g) => g.id);
  const [posts, comments, gameComments] = await Promise.all([
    idsOf('post').length ? db.from('posts').select('id, title, body, nickname, hidden').in('id', idsOf('post')) : { data: [] },
    idsOf('comment').length ? db.from('post_comments').select('id, post_id, body, nickname, hidden').in('id', idsOf('comment')) : { data: [] },
    idsOf('game_comment').length ? db.from('game_comments').select('id, game_id, body, nickname, hidden, games(name)').in('id', idsOf('game_comment')) : { data: [] },
  ]);
  const targets: Record<TargetType, Map<number, Record<string, unknown>>> = {
    post: new Map((posts.data || []).map((x: any) => [x.id, x])),
    comment: new Map((comments.data || []).map((x: any) => [x.id, x])),
    game_comment: new Map((gameComments.data || []).map((x: any) => [x.id, x])),
  };
  const items = [...groups.values()]
    .map((g) => ({ ...g, target: targets[g.type].get(g.id) || null }))
    .sort((a, b) => b.count - a.count || b.latest.localeCompare(a.latest));
  return NextResponse.json({ items });
}

// 처리 완료: 그 대상의 처리 안 된 신고 전부에 시각 표시 (신고 기록은 지우지 않음)
export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const { type, id } = await req.json().catch(() => ({}));
  if (!TYPES.includes(type) || !Number.isSafeInteger(id)) return fail('잘못된 요청이에요.');
  const { error } = await db.from('post_reports').update({ resolved_at: new Date().toISOString() })
    .eq('target_type', type).eq('target_id', id).is('resolved_at', null);
  if (error) return fail(error.message, 500);
  return NextResponse.json({ ok: true });
}
