import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data } = await supabase
    .from('games')
    .select('id, name, tags, difficulty, min_players, max_players, recommended_players, solo_playable, category')
    .order('name');
  return NextResponse.json(data || []);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...update } = body;
  const { error } = await supabase.from('games').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}