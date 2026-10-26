// 큐레이터 공개 동의 — curators.consent_status ('pending' | 'granted' | 'revoked')
// 'granted'가 아니면 어디에도 공개하지 않는다(계정 페이지·홈·게임 상세·OG·사이트맵). 조회 함수(curators.ts)가 이 규칙을 한 곳에서 적용한다
export const CONSENT_GRANTED = 'granted';

export const isGranted = (status: unknown) => status === CONSENT_GRANTED;

// 홈 노출: show_on_home은 동의가 있을 때만 의미가 있다 (granted가 아니면 true여도 무시)
export const showsOnHome = (c: { consent_status?: unknown; show_on_home?: unknown }) => isGranted(c.consent_status) && c.show_on_home === true;
