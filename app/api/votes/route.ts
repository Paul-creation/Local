import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { getIp } from '../../lib/aiGuard';
import { VOTE_SITUATIONS } from '../../lib/situations';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DAILY_VOTES_PER_IP = 40;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// IP는 그대로 저장하지 않고 해시로만 저장
const voterHash = (ip: string) =>
  createHash('sha256').update(ip + (process.env.SUPABASE_SERVICE_ROLE_KEY || '')).digest('hex').slice(0, 32);

export async function GET(req: NextRequest) {
  const gameId = req.nextUrl.searchParams.get('gameId');
  if (!gameId || !UUID.test(gameId)) return NextResponse.json({});

  const { data } = await supabase.from('game_votes').select('situation').eq('game_id', gameId);
  const counts: Record<string, number> = {};
  for (const row of data || []) counts[row.situation] = (counts[row.situation] || 0) + 1;
  return NextResponse.json(counts);
}

export async function POST(req: NextRequest) {
  const { gameId, situation } = await req.json().catch(() => ({}));
  if (typeof gameId !== 'string' || !UUID.test(gameId) || !VOTE_SITUATIONS.includes(situation)) {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });
  }

  const voter = voterHash(getIp(req.headers));
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ data: game }, { count }] = await Promise.all([
    supabase.from('games').select('id').eq('id', gameId).maybeSingle(),
    supabase.from('game_votes').select('id', { count: 'exact', head: true }).eq('voter_hash', voter).gte('created_at', since),
  ]);
  if (!game) return NextResponse.json({ error: '없는 게임' }, { status: 404 });
  if ((count ?? 0) >= DAILY_VOTES_PER_IP) {
    return NextResponse.json({ error: '오늘은 투표를 충분히 했어요. 내일 다시 참여해주세요.' }, { status: 429 });
  }

  const { error } = await supabase.from('game_votes').insert({ game_id: gameId, situation, voter_hash: voter });
  // 같은 사람이 같은 상황에 또 투표 → 조용히 무시 (중복 방지 인덱스)
  if (error && error.code !== '23505') return NextResponse.json({ error: '저장 실패' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
