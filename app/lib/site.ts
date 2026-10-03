export const SITE_NAME = '게임정보허브';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://game-info-hub.vercel.app').replace(/\/$/, '');
// 페이지에서 openGraph를 쓰면 layout 값을 통째로 덮어쓰므로 공통 값은 이걸 펼쳐서 같이 넣는다
export const BASE_OG = { siteName: SITE_NAME, locale: 'ko_KR', type: 'website' as const };
export const SITE_DESCRIPTION = '친구들이랑 뭐 할지 고민될 때 — 인원·난이도·가격·할인까지 한눈에 비교하는 게임 정보 사이트';
