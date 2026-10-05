// 등급표(data/pc-spec/gpu-tiers.json · cpu-tiers.json) 버전 — 순수 상수, 다른 파일을 가져오지 않는다
// 내 PC 사양(localStorage)에 이 버전을 같이 저장해 두고, 버전이 다르면 저장된 부품 key로 등급을 다시 계산한다 (app/lib/myPc.ts)
// 등급표의 key·제조사·등급을 바꾸면 specTablesVersion.test.mjs가 실패한다 → VERSION을 1 올리고 FINGERPRINT를 테스트가 알려주는 값으로 갱신
// 2: P2(i7 8~10세대·Ryzen 7 2000·3000 7→6) + 모바일 CPU 항목 추가
export const SPEC_TABLES_VERSION = 2;
export const SPEC_TABLES_FINGERPRINT = '27097c528d36';
