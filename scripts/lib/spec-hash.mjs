// scripts/lib/spec-hash.mjs
// parse-specs.mjs가 "이미 처리한 게임인지" 가려내는 해시 — 사양 텍스트 + 파서 버전 + 등급표 버전
// 같으면 다음 실행 때 건너뛰고, 텍스트·파서 버전·등급표 버전이 바뀐 게임만 다시 처리한다
import crypto from 'node:crypto';
import { SPEC_TABLES_VERSION } from '../../app/lib/specTablesVersion.ts';

// spec_parsed 모양·파서 규칙 버전 — 파서 규칙이나 결과 모양을 바꿀 때 올린다 (올리면 전체가 한 번 다시 처리됨)
// 2: cpu·gpu가 제조사별 등급({ nvidia, amd, intel, any }) / 3: 사양 단어 없는 표기도 low_spec, 세대 없는 CPU는 출시 연도로 짐작(cpu_generation_guessed)
// 4: 세대 짐작 제거(세대 미표기 기본값) · 파서 보강(Ryzen 하이픈 모델, | 구분, 제조사 이어 붙임, ® 붙은 GPU) · 모바일 CPU 한 단계 낮게 · cpu_generation_guessed 칸 없어짐
export const VERSION = 4;

export const specHash = (min, rec) => crypto.createHash('sha1').update(`v${VERSION}.t${SPEC_TABLES_VERSION}\n${min || ''}\n${rec || ''}`).digest('hex').slice(0, 16);
