// scripts/lib/activities-classify.mjs
// fill-activities-v2.mjs가 받은 모델 답(JSON)을 활동 키별로 확정·확인 필요로 나눔
// - yes + basis input + 인용문이 입력 자료에 실제로 있으면 confirmed, 그 외 yes는 unsure
import { ACTIVITY_KEYS } from '../../app/lib/activities.ts';

// 비교용 정규화: 대소문자·공백·따옴표·문장부호 차이를 무시
export const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

export function classify(parsed, haystack) {
  const hay = norm(haystack);
  const confirmed = [], unsure = [], evidence = {};
  let no = 0, unknown = 0, quoteFail = 0;
  for (const key of ACTIVITY_KEYS) {
    const v = parsed?.v?.[key];
    if (v === 'no') { no++; continue; }
    if (v !== 'yes') { unknown++; continue; }
    const e = parsed?.e?.[key] || {};
    const quote = String(e.quote || '').slice(0, 200);
    const verified = e.basis === 'input' && norm(quote).length >= 4 && hay.includes(norm(quote));
    if (e.basis === 'input' && !verified) quoteFail++;
    (verified ? confirmed : unsure).push(key);
    evidence[key] = { basis: verified ? 'input' : 'knowledge', quote: verified ? quote : '', note: String(e.note || '').slice(0, 80) };
  }
  return { confirmed, unsure, evidence, no, unknown, quoteFail };
}

export function parseJson(text) {
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s < 0 || e < 0) throw new Error('JSON 없음');
  return JSON.parse(text.slice(s, e + 1));
}
