// 추천 인원 투표 (player_count_votes) — 읽기: 선택지별 표 수 + 내 선택 / 쓰기: 한 사람(익명 쿠키) 한 게임에 한 표
// 쓰기는 이 API만 (서버 전용 키). 쿠키 원문은 저장하지 않고 비밀 값과 섞은 해시만 저장
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ipHash } from '../../lib/aiGuard';
import { readAiClientId } from '../../lib/aiClient';
import { isPlayerChoice } from '../../lib/playerVotes';
import { selectGames } from '../../lib/visibleGames';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAILY_VOTES_PER_VOTER = 40;

const voterOf = (h: Headers) => {
  const id = readAiClientId(h);
  return id ? ipHash('players:' + id) : null;
};

export async function GET(req: NextRequest) {
  const gameId = req.nextUrl.searchParams.get('gameId');
  if (!gameId || !UUID.test(gameId)) return NextResponse.json({ counts: {}, mine: null });
  const voter = voterOf(req.headers);
  const [{ data, error }, mine] = await Promise.all([
    supabase.from('player_count_votes').select('choice').eq('game_id', gameId),
    voter
      ? supabase.from('player_count_votes').select('choice').eq('game_id', gameId).eq('voter_hash', voter).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  // 표가 아직 없으면(마이그레이션 전) 빈 결과
  if (error) return NextResponse.json({ counts: {}, mine: null });
  const counts: Record<string, number> = {};
  for (const r of data || []) counts[r.choice] = (counts[r.choice] || 0) + 1;
  return NextResponse.json({ counts, mine: mine.data?.choice ?? null }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const { gameId, choice } = await req.json().catch(() => ({}));
  if (typeof gameId !== 'string' || !UUID.test(gameId) || !isPlayerChoice(choice)) {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });
  }
  const voter = voterOf(req.headers);
  if (!voter) return NextResponse.json({ error: '브라우저 확인이 필요해요. 페이지를 새로고침한 뒤 다시 눌러 주세요.' }, { status: 400 });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ data: game }, { count }] = await Promise.all([
    selectGames('id, max_players, party_max', undefined, supabase).eq('id', gameId).maybeSingle(),
    supabase.from('player_count_votes').select('id', { count: 'exact', head: true }).eq('voter_hash', voter).gte('created_at', since),
  ]);
  if (!game) return NextResponse.json({ error: '없는 게임' }, { status: 404 });
  const g = game as { max_players?: number | null; party_max?: number | null };
  if ((g.party_max ?? g.max_players ?? 0) <= 1) return NextResponse.json({ error: '멀티 게임만 투표할 수 있어요' }, { status: 400 });
  if ((count ?? 0) >= DAILY_VOTES_PER_VOTER) {
    return NextResponse.json({ error: '오늘은 투표를 충분히 했어요. 내일 다시 참여해 주세요.' }, { status: 429 });
  }

  const { error } = await supabase.from('player_count_votes').insert({ game_id: gameId, choice, voter_hash: voter });
  if (error?.code === '23505') return NextResponse.json({ error: '이미 투표했어요' }, { status: 409 });
  if (error) return NextResponse.json({ error: '저장하지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
