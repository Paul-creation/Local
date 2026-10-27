import { NextResponse } from 'next/server';
import { EVENTS, eventShortLinkTarget } from '../lib/event';

// /halloween 짧은 주소 — 이벤트 링크(eventHref)로 임시 이동(307), 기간이 끝났으면 메인으로
// 기간 판단이 요청 시점이어야 해서 정적으로 굳히지 않는다
// page.tsx의 redirect()는 app/loading.tsx 때문에 스트리밍이 시작돼 HTTP 200 + meta 이동이 되므로 라우트 핸들러로 진짜 307을 낸다
export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return NextResponse.redirect(new URL(eventShortLinkTarget(EVENTS[0]), request.url), 307);
}
