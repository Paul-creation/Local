// scripts/lib/activities-classify.mjs
// fill-activities-v2.mjs가 받은 모델 답(JSON)을 활동 키별로 confirmed / unsure / weak로 나눔
// - input+strong(인용문이 입력에 실제로 있음) → confirmed
// - knowledge+strong, 또는 input인데 인용이 입력에 없음 → unsure
// - weak(근거가 그 키를 직접 뒷받침하지 않음) → 어디에도 넣지 않고 evidence에만 기록
// - 스팀 카테고리 칸 문구(예: "Online PvP", "Steam Workshop")만 인용한 근거는 strength를 weak로 내림
import { ACTIVITY_KEYS } from '../../app/lib/activities.ts';

// 비교용 정규화: 대소문자·공백·따옴표·문장부호 차이를 무시
export const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

export function classify(parsed, haystack, categories = []) {
  const hay = norm(haystack);
  const cats = new Set(categories.map(norm).filter(Boolean));
  const confirmed = [], unsure = [], weak = [], evidence = {};
  let no = 0, unknown = 0, quoteFail = 0, categoryOnly = 0;
  for (const key of ACTIVITY_KEYS) {
    const v = parsed?.v?.[key];
    if (v === 'no') { no++; continue; }
    if (v !== 'yes') { unknown++; continue; }
    const e = parsed?.e?.[key] || {};
    const quote = String(e.quote || '').slice(0, 200);
    const nq = norm(quote);
    const verified = e.basis === 'input' && nq.length >= 4 && hay.includes(nq);
    if (e.basis === 'input' && !verified) quoteFail++;
    let strong = e.strength === 'strong'; // strength가 없거나 이상하면 약한 근거로 본다
    if (strong && verified && cats.has(nq)) { strong = false; categoryOnly++; }
    const note = String(e.note || '').slice(0, 80);
    if (!strong) { weak.push(key); evidence[key] = { basis: verified ? 'input' : 'knowledge', strength: 'weak', quote: verified ? quote : '', note }; continue; }
    (verified ? confirmed : unsure).push(key);
    evidence[key] = { basis: verified ? 'input' : 'knowledge', strength: 'strong', quote: verified ? quote : '', note };
  }
  return { confirmed, unsure, weak, evidence, no, unknown, quoteFail, categoryOnly };
}

export function parseJson(text) {
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s < 0 || e < 0) throw new Error('JSON 없음');
  return JSON.parse(text.slice(s, e + 1));
}
