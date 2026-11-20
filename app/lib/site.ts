// 사이트 이름·대표 주소·연락처는 여기서만 정한다. 바꿀 땐 Vercel 환경변수만 바꾸고 다시 배포
// (NEXT_PUBLIC_* 값은 빌드할 때 코드에 박히므로 환경변수를 바꾼 뒤 재배포해야 반영됨)
// 화면·<title>·OG·설명에는 영어 이름만 씀. 한국어 이름은 발음으로 스스로 알아채게 하려고 화면에 안 보이게 둠
// SITE_NAME_KO는 구조화 데이터 alternateName(화면에 안 보임)과 커뮤니티 닉네임 금지 목록에만 씀
export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'select screen';
export const SITE_NAME_KO = process.env.NEXT_PUBLIC_SITE_NAME_KO || '재밌드나';
export const SITE_NAME_FULL = SITE_NAME;
// 구조화 데이터(WebSite) alternateName — 검색에서 이 이름들로도 사이트를 찾게(예전 이름 JamiDuNow·재밌드나 포함)
export const SITE_ALT_NAMES = ['Select Screen', '셀렉트 스크린', 'select-screen', SITE_NAME_KO, 'JamiDuNow', 'select-screen.com'];
export const SITE_TITLE = SITE_NAME_FULL;
// 환경변수가 예전 주소(vercel.app, jamidunow.com)로 남아 있어도 canonical·sitemap은 select-screen.com으로 나가게 무시한다
const ENV_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;
export const SITE_URL = (ENV_SITE_URL && !/\.vercel\.app|jamidunow\.com/i.test(ENV_SITE_URL) ? ENV_SITE_URL : 'https://select-screen.com').replace(/\/$/, '');
// 운영자(저작권 표시·개인정보 보호책임자 표기에 사용)
export const OPERATOR_NAME = process.env.NEXT_PUBLIC_OPERATOR_NAME || 'The Circles';
// 페이지에서 openGraph를 쓰면 layout 값을 통째로 덮어쓰므로 공통 값은 이걸 펼쳐서 같이 넣는다
export const OG_DEFAULT_IMAGE = { url: '/og-default.png', width: 1200, height: 630, alt: SITE_NAME_FULL };
export const BASE_OG = { siteName: SITE_NAME_FULL, locale: 'ko_KR', type: 'website' as const, images: [OG_DEFAULT_IMAGE] };
// 연락 이메일 — NEXT_PUBLIC_CONTACT_EMAIL로 바꿀 수 있고, 없으면 전용 주소를 쓴다
export const CONTACT_EMAIL = (process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'jamidunow@gmail.com').trim();
export const CONTACT_TEXT = CONTACT_EMAIL || '준비 중';
export const SITE_DESCRIPTION = '친구들이랑 뭐 할지 고민될 때 — 게임 픽창 열듯 인원·난이도·가격·할인까지 한눈에 비교하는 게임 정보 사이트';
// <meta description>·OG 설명용
export const SITE_META_DESCRIPTION = `${SITE_NAME}: ${SITE_DESCRIPTION}`;
