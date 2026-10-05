// scripts/lib/spec-hash.mjs
// parse-specs.mjs가 "이미 처리한 게임인지" 가려내는 해시 — 사양 텍스트 + 출시 연도(CPU 세대 짐작에 쓰임) + 파서 버전
// 같으면 다음 실행 때 건너뛰고, 텍스트·출시 연도·파서 버전이 바뀐 게임만 다시 처리한다
import crypto from 'node:crypto';

// spec_parsed 모양 버전 — 파서 규칙이나 결과 모양을 바꿀 때 올린다 (올리면 전체가 한 번 다시 처리됨)
// 2: cpu·gpu가 제조사별 등급({ nvidia, amd, intel, any }) / 3: 사양 단어 없는 표기도 low_spec, 세대 없는 CPU는 출시 연도로 짐작(cpu_generation_guessed)
export const VERSION = 3;

export const releaseYearOf = (date) => { const y = date ? new Date(date).getUTCFullYear() : NaN; return Number.isInteger(y) && y > 1980 ? y : null; };
export const specHash = (min, rec, year = null) => crypto.createHash('sha1').update(`v${VERSION}\n${year ?? ''}\n${min || ''}\n${rec || ''}`).digest('hex').slice(0, 16);
