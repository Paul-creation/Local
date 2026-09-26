import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '../../../lib/adminAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EDITABLE = ['tags', 'difficulty', 'min_players', 'max_players', 'recommended_players', 'solo_playable', 'category'];
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
  return NextResponse.json({ ok: true });
}
