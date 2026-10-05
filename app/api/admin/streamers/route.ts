import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '../../../lib/adminAuth';

// 스트리머 PICK 관리: 채널 켜기/끄기(논란 등으로 뺄 때) · 영상 숨기기(게임이 잘못 연결됐을 때)
// 채널·영상 추가는 scripts/fetch-streamer-videos.mjs만 함
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const CHANNEL_ID = /^UC[\w-]{22}$/;
const VIDEO_ID = /^[\w-]{11}$/;

// ?channel=ID 없으면 채널 목록, 있으면 그 채널의 영상 (최근 200개, 숨긴 것 포함)
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const channel = req.nextUrl.searchParams.get('channel');
  if (channel) {
    if (!CHANNEL_ID.test(channel)) return fail('잘못된 채널이에요.');
    const { data, error } = await supabase
      .from('streamer_videos')
      .select('video_id, title, published_at, view_count, is_short, match_method, hidden, game_id, games(name)')
      .eq('channel_id', channel)
      .order('published_at', { ascending: false })
      .limit(200);
    if (error) return fail(error.message, 500);
    return NextResponse.json({ items: data || [] });
  }
  const { data, error } = await supabase
    .from('streamer_channels')
    .select('channel_id, streamer_name, channel_title, handle, kind, enabled, uploads_checked_at')
    .order('streamer_name')
    .order('kind');
  if (error) return fail(`${error.message} — supabase/migrations/20261014090000_streamer_videos.sql 실행 필요할 수 있음`, 500);
  return NextResponse.json({ items: data || [] });
}

// { channel_id, enabled } 또는 { video_id, hidden }
export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => ({}));
  if (typeof body.channel_id === 'string' && CHANNEL_ID.test(body.channel_id) && typeof body.enabled === 'boolean') {
    const { error } = await supabase.from('streamer_channels').update({ enabled: body.enabled }).eq('channel_id', body.channel_id);
    if (error) return fail(error.message, 500);
    return NextResponse.json({ ok: true });
  }
  if (typeof body.video_id === 'string' && VIDEO_ID.test(body.video_id) && typeof body.hidden === 'boolean') {
    const { error } = await supabase.from('streamer_videos').update({ hidden: body.hidden }).eq('video_id', body.video_id);
    if (error) return fail(error.message, 500);
    return NextResponse.json({ ok: true });
  }
  return fail('잘못된 요청이에요.');
}
