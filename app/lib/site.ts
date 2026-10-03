// 사이트 이름·대표 주소·연락처는 여기서만 정한다. 바꿀 땐 Vercel 환경변수만 바꾸고 다시 배포
// (NEXT_PUBLIC_* 값은 빌드할 때 코드에 박히므로 환경변수를 바꾼 뒤 재배포해야 반영됨)
export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || '게임정보허브';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://game-info-hub.vercel.app').replace(/\/$/, '');
// 운영자(저작권 표시·개인정보 보호책임자 표기에 사용)
export const OPERATOR_NAME = process.env.NEXT_PUBLIC_OPERATOR_NAME || 'The Circles';
// 페이지에서 openGraph를 쓰면 layout 값을 통째로 덮어쓰므로 공통 값은 이걸 펼쳐서 같이 넣는다
export const BASE_OG = { siteName: SITE_NAME, locale: 'ko_KR', type: 'website' as const };
// 연락 이메일 — 비어 있으면 화면에 CONTACT_TEXT("준비 중")를 보여준다
export const CONTACT_EMAIL = (process.env.NEXT_PUBLIC_CONTACT_EMAIL || '').trim();
export const CONTACT_TEXT = CONTACT_EMAIL || '준비 중';
export const SITE_DESCRIPTION = '친구들이랑 뭐 할지 고민될 때 — 인원·난이도·가격·할인까지 한눈에 비교하는 게임 정보 사이트';
