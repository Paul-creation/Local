import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const gameId = req.nextUrl.searchParams.get('gameId');
  if (!gameId) return NextResponse.json({});

  const { data } = await supabase
    .from('game_votes')
    .select('situation')
    .eq('game_id', gameId);

  const counts: Record<string, number> = {};
  for (const row of data || []) {
    counts[row.situation] = (counts[row.situation] || 0) + 1;
  }

  return NextResponse.json(counts);
}

export async function POST(req: NextRequest) {
  const { gameId, situation } = await req.json();
  if (!gameId || !situation) return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });

  await supabase.from('game_votes').insert({ game_id: gameId, situation });
  return NextResponse.json({ ok: true });
}