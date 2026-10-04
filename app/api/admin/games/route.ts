import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '../../../lib/adminAuth';
import { badgeFor } from '../../../lib/badge.mjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// category(배지)는 직접 고치지 않고 인원·협동/대전 칸에서 계산 (app/lib/badge.mjs)
const EDITABLE = ['tags', 'difficulty', 'min_players', 'max_players', 'recommended_players', 'solo_playable'];
const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const { data } = await supabase
    .from('games')
    .select('id, name, tags, difficulty, min_players, max_players, recommended_players, solo_playable, category')
    .order('name');
  return NextResponse.json(data || []);
}

export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json();
  if (!body?.id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

  const update: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in body) update[k] = body[k];

  const { error } = await supabase.from('games').update(update).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 인원이 바뀌었을 수 있으니 배지 다시 계산
  const { data: g } = await supabase
    .from('games')
    .select('category, max_players, has_online_coop, has_local_coop, has_pvp')
    .eq('id', body.id)
    .single();
  const category = g ? badgeFor(g) : null;
  if (g && category !== g.category) await supabase.from('games').update({ category }).eq('id', body.id);
  return NextResponse.json({ ok: true, category });
}
