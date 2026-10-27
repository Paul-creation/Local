import { redirect } from 'next/navigation';
import { EVENTS, eventShortLinkTarget } from '../lib/event';

// /halloween 짧은 주소 — 이벤트 링크(eventHref)로 임시 이동(307), 기간이 끝났으면 메인으로
// 기간 판단이 요청 시점이어야 해서 정적으로 굳히지 않는다
export const dynamic = 'force-dynamic';

export default function HalloweenShortLink() {
  redirect(eventShortLinkTarget(EVENTS[0]));
}
