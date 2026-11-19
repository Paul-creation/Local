import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { parseRevalidateBody, pathsToRevalidate, keyMatches, isWebhookBody, webhookTargets } from '../../../lib/revalidateBody';

// 관리자용 캐시 갱신 — x-admin-key 헤더가 ADMIN_REVALIDATE_KEY와 같을 때만
// 본문 없이 부르면: 메인("/")과 /this-week 페이지 캐시를 무효화 (신작 추가·출시)
//   /api/games/list·/api/games/taste는 ISR이 아니라 CDN Cache-Control(s-maxage=3600)만 쓰므로 여기서 무효화할 수 없다 (최대 1시간 뒤 반영)
// 본문이 { ids: [...] }이면: 그 게임의 상세(/games/[id])만 무효화 (가격·할인·출시 상태가 바뀐 게임, 한 번에 최대 500개)
// 본문이 { curators: [handle...] }이면: 그 큐레이터 페이지(/c/[handle])와 메인("/")을 무효화 (게시물 추가, 한 번에 최대 20개). ids와 같이 보낼 수도 있음
// 본문이 Supabase Database Webhook 형식 { type, table: 'curators'|'curator_posts', record, old_record }이면: 바뀐 행의 핸들을 찾아 { curators: [handle] }과 똑같이 무효화 (curator_posts는 curator_id로 curators.handle 조회). 인증은 같은 x-admin-key 헤더
// 환경변수가 비어 있으면 항상 401
export const dynamic = 'force-dynamic';

function keyOk(req: NextRequest) {
  return keyMatches(req.headers.get('x-admin-key') || '', process.env.ADMIN_REVALIDATE_KEY || '');
}

// curator_posts 웹훅용 — curator_id → handle (읽기만, 서비스 키는 서버 전용)
async function handlesOf(curatorIds: string[]): Promise<string[]> {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await db.from('curators').select('handle').in('id', curatorIds);
  if (error) throw new Error(error.message);
  return (data || []).map((c) => c.handle as string);
}

export async function POST(req: NextRequest) {
  if (!keyOk(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const raw = await req.text();
  if (raw.trim()) {
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
    let parsed;
    if (isWebhookBody(body)) {
      try { parsed = await webhookTargets(body, handlesOf); } catch { return NextResponse.json({ error: 'lookup failed' }, { status: 500 }); } // 500이면 Supabase가 다시 보낸다
    } else parsed = parseRevalidateBody(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const paths = pathsToRevalidate(parsed.value);
    for (const p of paths) revalidatePath(p);
    return NextResponse.json({ ok: true, revalidated: parsed.value.ids.length + parsed.value.curators.length });
  }
  const paths = ['/', '/home-member', '/this-week']; // /home-member: 로그인 사용자용 메인(proxy.ts가 / 요청을 다시 써 줌) — /와 같이 갱신
  for (const p of paths) revalidatePath(p);
  return NextResponse.json({ ok: true, revalidated: paths });
}

export async function GET() {
  return NextResponse.json({ error: 'method not allowed' }, { status: 405, headers: { Allow: 'POST' } });
}
