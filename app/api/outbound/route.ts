import { NextRequest, NextResponse } from 'next/server';
import { getIp } from '../../lib/aiGuard';
import { supabase } from '../../lib/supabase';
import { db } from '../../lib/community';
import { CONSENT_GRANTED } from '../../lib/curatorConsent';
import { isUuid, makeRateLimiter, parseInstagramUrl } from '../../lib/outbound';

const allow = makeRateLimiter(30, 60_000);
const done = (status = 204) => new NextResponse(null, { status });

// 큐레이터 → 인스타그램 나가는 클릭 기록. sendBeacon 전용이라 응답 본문은 없다. IP·개인 정보는 저장하지 않는다(요청 제한용 IP는 메모리에서만 잠깐)
export async function POST(req: NextRequest) {
  if (!allow(getIp(req.headers))) return done(429);
  const body = await req.text().then((t) => (t.length <= 2000 ? JSON.parse(t) : null)).catch(() => null);
  if (!body || typeof body !== 'object') return done(400);

  const target = parseInstagramUrl(body.target_url);
  const handle = typeof body.curator === 'string' ? body.curator.slice(0, 100) : '';
  if (!target || !handle) return done(400);

  // 공개 중(consent_status=granted)인 큐레이터만 — 브라우저 키는 RLS로 이 계정만 읽는다
  const { data: curator } = await supabase.from('curators').select('id, handle').eq('handle', handle).eq('consent_status', CONSENT_GRANTED).maybeSingle();
  if (!curator) return done(400);

  let gameId: string | null = null;
  if (body.game_id != null) {
    if (!isUuid(body.game_id)) return done(400);
    const { data: post } = await supabase.from('curator_posts').select('id').eq('curator_id', curator.id).eq('game_id', body.game_id).limit(1).maybeSingle();
    if (!post) return done(400);
    gameId = body.game_id;
  }

  await db.from('outbound_clicks').insert({ curator: curator.handle, game_id: gameId, target_url: target });
  return done();
}
