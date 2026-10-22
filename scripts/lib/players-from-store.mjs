// scripts/lib/players-from-store.mjs — 스팀 상점 소개문에서 인원을 명시한 문장 뽑기 (순수 함수, DB·네트워크·AI 없음)
// 결과 status
//  - fill: 숫자가 하나로 확실하거나, 협동·대전 숫자가 라벨로 나뉘어 최대 인원(같은 판 기준)을 정할 수 있음 → max(+ 범위의 min)
//  - pending: 숫자가 여러 개라 못 나누거나, 서버·대규모 숫자(LARGE_FROM 이상) → 자동 반영 안 하고 근거 문장과 함께 대기 목록으로
//  - none: 인원을 명시한 문장이 없음
import { decodeEntities } from './html-entities.mjs';

export const LARGE_FROM = 17; // 화면에 "16명+"로 나오는 구간. 이 이상은 서버·대규모 매치일 수 있어 자동 반영 안 함 (docs/verification-rules.md)

const WORDS = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, sixteen: 16 };
const NUM = `(\\d{1,3}|${Object.keys(WORDS).join('|')})`;
const toNum = (s) => (/^\d/.test(s) ? Number(s) : WORDS[s.toLowerCase()]);

// 영어: "1-4 player", "2 to 8 players", "up to 4 players", "4-player", "4 players", "4v4" / 한국어: "최대 4인", "2~4명", "4인 협동"
const RANGE_EN = new RegExp(`\\b${NUM}\\s*(?:-|–|—|to)\\s*${NUM}[- ]players?\\b`, 'gi');
const UPTO_EN = new RegExp(`\\bup to ${NUM}(?:\\s+(?:local|online|co-?op|cooperative))?[- ]players?\\b`, 'gi');
const PLAYERS_EN = new RegExp(`\\b${NUM}[- ]players?\\b`, 'gi');
const VERSUS = /\b(\d{1,2})\s?v\s?(\d{1,2})\b/gi;
const FRIENDS_EN = new RegExp(`\\b(?:up to|with|invite) ${NUM} (?:other )?(?:friends|people)\\b`, 'gi'); // "친구 N명"은 본인 포함 여부가 애매해 숫자로 못 씀
const RANGE_KO = /(\d{1,3})\s*[~\-–]\s*(\d{1,3})\s*(?:인|명)/g;
const MAX_KO = /최대\s*(\d{1,3})\s*(?:인|명)/g;
const N_KO = /(\d{1,3})\s*(?:인|명)\s*(?:협동|코옵|멀티|대전|까지|플레이)/g;

const COOP = /co-?op|cooperative|together|with friends|squad|team up|협동|코옵|친구/i;
const PVP = /pvp|versus|\bvs\b|compet|deathmatch|arena|ranked|match|대전|경쟁/i;
const SERVER = /server|mmo|battle royale|massive|concurrent|persistent|서버|배틀로얄/i;
const HEDGE = /recommend|or more|more than|at least|minimum|unlimited|no limit|welcome|무제한|권장|이상/i; // "up to 3 (더 해도 됨)" 같은 말 — 숫자가 상한이 아님
const LOCAL_ONLY = /split[- ]?screen|local|couch|same screen|shared screen|hot ?seat|분할|로컬/i;
const COMPETE = /pvp|versus|\bvs\b|competitive|deathmatch|ranked|대전|경쟁/i;

// 소개문 HTML → 문장 목록
export function toSentences(html) {
  const text = decodeEntities(String(html || '')
    .replace(/<br\s*\/?>|<\/(p|li|h\d|div)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t ]+/g, ' ');
  return text.split(/\n+|(?<=[.!?。])\s+/).map((s) => s.trim()).filter((s) => s.length > 3);
}

function kindOf(sentence) {
  if (SERVER.test(sentence)) return 'server';
  const coop = COOP.test(sentence);
  const pvp = PVP.test(sentence);
  if (coop && !pvp) return 'coop';
  if (pvp && !coop) return 'pvp';
  return 'any';
}

// 한 문장에서 { min, max } 후보를 모두 뽑는다. 1인 표기("1 player")는 인원 정보가 아니라 버림
function numbersIn(sentence) {
  const out = [];
  const taken = []; // 이미 쓴 글자 구간 (범위 표기 안의 숫자를 또 세지 않도록)
  const add = (m, min, max, flag) => {
    const [s, e] = [m.index, m.index + m[0].length];
    if (taken.some(([a, b]) => s < b && e > a)) return;
    taken.push([s, e]);
    if (max >= 2) out.push({ min: min >= 1 && min < max ? min : null, max, flag });
  };
  for (const m of sentence.matchAll(RANGE_EN)) add(m, toNum(m[1]), toNum(m[2]));
  for (const m of sentence.matchAll(RANGE_KO)) add(m, Number(m[1]), Number(m[2]));
  for (const m of sentence.matchAll(UPTO_EN)) add(m, null, toNum(m[1]));
  for (const m of sentence.matchAll(MAX_KO)) add(m, null, Number(m[1]));
  for (const m of sentence.matchAll(VERSUS)) add(m, null, Number(m[1]) + Number(m[2]), 'versus'); // 팀 대전 표기는 친구끼리 내전 인원인지 모름
  for (const m of sentence.matchAll(FRIENDS_EN)) add(m, null, toNum(m[1]), 'friends');
  for (const m of sentence.matchAll(PLAYERS_EN)) add(m, null, toNum(m[1]));
  for (const m of sentence.matchAll(N_KO)) add(m, null, Number(m[1]));
  return out;
}

// texts: 소개문 HTML 문자열들 (short_description, about_the_game). 같은 문장은 한 번만
export function extractPlayers(texts) {
  const seen = new Set();
  const found = []; // { max, min, kind, sentence }
  for (const html of texts) {
    for (const sentence of toSentences(html)) {
      if (seen.has(sentence)) continue;
      seen.add(sentence);
      const nums = numbersIn(sentence);
      if (!nums.length) continue;
      const kind = kindOf(sentence);
      for (const n of nums) found.push({ ...n, kind, sentence: sentence.length > 200 ? `${sentence.slice(0, 200)}…` : sentence });
    }
  }
  if (!found.length) return { status: 'none', evidence: [] };

  const evidence = [...new Set(found.map((f) => f.sentence))].slice(0, 4);
  const pending = (reason, values = [...new Set(found.map((f) => f.max))].sort((a, b) => a - b)) => ({ status: 'pending', reason, values, evidence });
  // 팀 대전 표기(NvN)·"친구 N명"은 확실한 숫자가 따로 있을 때만 버리고 나머지로 판단, 그것뿐이면 대기
  if (found.every((f) => f.flag)) return pending(found.some((f) => f.flag === 'friends') ? 'friends' : 'versus-only');
  const solid = found.filter((f) => !f.flag);
  const values = [...new Set(solid.map((f) => f.max))].sort((a, b) => a - b);
  if (values.some((v) => v >= LARGE_FROM)) return pending('large', values);
  if (solid.some((f) => HEDGE.test(f.sentence))) return pending('hedge', values);
  if (solid.every((f) => LOCAL_ONLY.test(f.sentence) && !/online|온라인/i.test(f.sentence))) return pending('local-only', values);
  // 협동·불명 숫자 하나뿐인데 숫자 없는 다른 문장에 대전 요소가 있으면 대전 쪽 인원이 더 클 수 있음
  const numbered = new Set(solid.map((f) => f.sentence));
  if (solid.every((f) => f.kind !== 'pvp') && texts.some((t) => toSentences(t).some((x) => !numbered.has(x) && COMPETE.test(x)))) return pending('also-versus', values);
  if (values.length === 1) {
    const mins = solid.map((f) => f.min).filter((m) => m != null);
    return { status: 'fill', max: values[0], min: mins.length ? Math.min(...mins) : null, reason: 'single', evidence };
  }
  // 숫자가 여럿: 협동 숫자 하나 + 대전 숫자 하나로 라벨이 갈릴 때만 같은 판 최대(둘 중 큰 값)로 정함. 그 외는 대기
  const by = (k) => [...new Set(solid.filter((f) => f.kind === k).map((f) => f.max))];
  const coop = by('coop');
  const pvp = by('pvp');
  const labeled = solid.every((f) => f.kind === 'coop' || f.kind === 'pvp');
  if (labeled && coop.length === 1 && pvp.length === 1) return { status: 'fill', max: Math.max(coop[0], pvp[0]), min: null, reason: `split coop ${coop[0]} / pvp ${pvp[0]}`, evidence };
  return pending('multi', values);
}
