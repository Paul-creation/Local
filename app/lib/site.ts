// 사이트 이름·대표 주소·연락처는 여기서만 정한다. 바꿀 땐 Vercel 환경변수만 바꾸고 다시 배포
// (NEXT_PUBLIC_* 값은 빌드할 때 코드에 박히므로 환경변수를 바꾼 뒤 재배포해야 반영됨)
// 영어 이름은 화면 헤더·로고에, 한국어 이름은 검색용(<title>·OG·설명·구조화 데이터)에 같이 씀
export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'JamiDuNow';
export const SITE_NAME_KO = process.env.NEXT_PUBLIC_SITE_NAME_KO || '재밌드나';
export const SITE_NAME_FULL = `${SITE_NAME} | ${SITE_NAME_KO}`;
// 구조화 데이터(WebSite) alternateName — 검색에서 이 이름들로도 사이트를 찾게
export const SITE_ALT_NAMES = [SITE_NAME_KO, 'JDN'];
export const SITE_TITLE = `${SITE_NAME_FULL} - 친구랑 할 게임 찾기`;
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://game-info-hub.vercel.app').replace(/\/$/, '');
// 운영자(저작권 표시·개인정보 보호책임자 표기에 사용)
export const OPERATOR_NAME = process.env.NEXT_PUBLIC_OPERATOR_NAME || 'The Circles';
// 페이지에서 openGraph를 쓰면 layout 값을 통째로 덮어쓰므로 공통 값은 이걸 펼쳐서 같이 넣는다
export const BASE_OG = { siteName: SITE_NAME_FULL, locale: 'ko_KR', type: 'website' as const };
// 연락 이메일 — 비어 있으면 화면에 CONTACT_TEXT("준비 중")를 보여준다
export const CONTACT_EMAIL = (process.env.NEXT_PUBLIC_CONTACT_EMAIL || '').trim();
export const CONTACT_TEXT = CONTACT_EMAIL || '준비 중';
export const SITE_DESCRIPTION = '친구들이랑 뭐 할지 고민될 때 — 인원·난이도·가격·할인까지 한눈에 비교하는 게임 정보 사이트';
// <meta description>·OG 설명용 (한국어 이름 포함)
export const SITE_META_DESCRIPTION = `${SITE_NAME_KO}(${SITE_NAME}): ${SITE_DESCRIPTION}`;
