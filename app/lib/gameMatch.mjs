// 글 제목+본문에서 게임 이름(영문 이름·한국어 이름·별칭)을 찾는 순수 함수 — 서버(app/lib/postLinks.ts)와 scripts/fill-post-related-games.mjs가 같이 씀
// - 긴 이름(띄어쓰기 빼고 5자 이상): 띄어쓰기·기호를 무시하고 포함되면 매칭 ("스타듀 밸리" = "스타듀밸리")
// - 짧은 이름(2~4자): 앞뒤가 단어 경계일 때만 (한국어 조사 "을·를·이랑…"은 허용) → "롤러코스터" 안의 "롤" 같은 오매칭 방지
// - 1자 이름과 흔한 낱말(STOP)은 쓰지 않음. 예외는 "롤"뿐 (ONE_CHAR_ALLOWED) — 독립된 단어일 때만(앞이 공백·문장부호·괄호이고, 뒤가 공백·문장부호이거나 조사)
//   뒤에 카드·TCG·리프트바운드·토체스가 오면 그 게임이 아님 (EXCLUDE_AFTER, "롤 리프트바운드 카드깡"은 카드게임)
// - 이름 변형 (nameVariants): 앞의 The는 무시하고, "the 2nd"와 "2nd"를 같게 봄. 변형은 오매칭을 막으려고 항상 단어 경계로만 비교
// - 겹치는 이름은 더 긴 쪽 우선 ("Dying Light: The Beast" 안의 "Dying Light"는 따로 안 셈), 글에 먼저 나온 순서로 최대 3개

export const MAX_RELATED = 3;
const SHORT_MAX = 4;
const STOP = new Set(['게임', '피시', 'pc', '스팀', 'steam', '친구', '멀티', '협동', '할인', '세일']);
// 1글자 이름 중 쓸 수 있는 것 (그 밖의 1글자는 그대로 안 씀)
const ONE_CHAR_ALLOWED = new Set(['롤']);
// 이름 바로 뒤(띄어쓰기 한 칸 허용)에 이게 오면 그 게임 이야기가 아님 — 정규화된 이름 → 정규식
const EXCLUDE_AFTER = { 롤: /^ ?(?:카드|tcg|리프트바운드|토체스)/u };
const PARTICLE = '(?:이랑|하고|에서|으로|까지|부터|보다|처럼|이나|은|는|이|가|을|를|도|만|랑|로|의|와|과|에|나)?';

/** @param {string} s */
export function normalize(s) {
  return String(s || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const ORDINAL = '\\d+(?:st|nd|rd|th)';

/**
 * 한 이름(정규화·띄어쓴 꼴)의 같은 뜻 변형들 — 첫 번째는 원래 이름, 나머지는 derived
 * - 앞의 "the " 떼기 (떼고 두 낱말 이상 남을 때만: "The Forest"→"forest"처럼 흔한 한 낱말이 되면 글에 오매칭이 많아 안 함)
 * - 서수 앞의 "the" 떼기 ("하늘의 궤적 the 2nd" → "하늘의 궤적 2nd")와 반대로 붙이기 ("… 2nd" → "… the 2nd")
 * @param {string} spaced
 */
export function nameVariants(spaced) {
  const out = [{ spaced, derived: false }];
  const add = (v) => { if (v && !out.some((o) => o.spaced === v)) out.push({ spaced: v, derived: true }); };
  const multi = (v) => v.split(' ').length >= 2;
  const noLead = spaced.replace(/^the /, '');
  if (noLead !== spaced && multi(noLead)) add(noLead);
  for (const base of [spaced, noLead]) {
    const noOrdThe = base.replace(new RegExp(` the (?=${ORDINAL}(?: |$))`, 'g'), ' ');
    if (noOrdThe !== base && multi(noOrdThe)) add(noOrdThe);
    const m = new RegExp(`^(.+?) (${ORDINAL})$`).exec(base);
    if (m && !/(^| )the$/.test(m[1]) && multi(base)) add(`${m[1]} the ${m[2]}`);
  }
  return out;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 게임 목록 → 매칭에 쓸 이름 목록 (게임마다 한 번만 만들어 두고 재사용)
 * @param {{ id: string, name: string | null, search_name_ko?: string | null }[]} games
 * @returns {{ id: string, key: string, re: RegExp | null, excludeAfter: RegExp | null }[]}
 */
export function buildMatchers(games) {
  const out = [];
  for (const g of games) {
    const names = [g.name, ...String(g.search_name_ko || '').split(',')];
    const seen = new Set();
    for (const raw of names) {
      for (const v of nameVariants(normalize(raw))) {
        const spaced = v.spaced;
        const key = spaced.replace(/ /g, '');
        const len = [...key].length;
        if (len < 1 || (len < 2 && !ONE_CHAR_ALLOWED.has(key)) || STOP.has(key) || seen.has(key)) continue;
        seen.add(key);
        // 짧은 이름·1글자 예외·변형은 단어 경계로만 비교
        const short = len <= SHORT_MAX || v.derived;
        const forms = [...new Set([spaced, key])].map(escapeRe).join('|');
        out.push({
          id: g.id,
          key,
          re: short ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${forms})${PARTICLE}(?![\\p{L}\\p{N}])`, 'gu') : null,
          excludeAfter: EXCLUDE_AFTER[key] || null,
        });
      }
    }
  }
  return out;
}

/**
 * 겹치는 이름을 정리한 뒤 남은 매칭 위치들 (scripts/fetch-streamer-videos.mjs가 "가장 긴 이름 하나"를 고를 때 씀)
 * @param {string} text
 * @param {ReturnType<typeof buildMatchers>} matchers
 * @returns {{ id: string, start: number, len: number }[]}
 */
export function findGameHits(text, matchers) {
  const spaced = normalize(text);
  // 띄어쓴 글자 위치 → 띄어쓰기 뺀 글자 위치
  const toKeyIdx = [];
  let k = 0;
  for (let i = 0; i <= spaced.length; i++) { toKeyIdx[i] = k; if (spaced[i] !== ' ') k++; }
  const keyText = spaced.replace(/ /g, '');

  const hits = [];
  for (const m of matchers) {
    if (m.re) {
      m.re.lastIndex = 0;
      for (const r of spaced.matchAll(m.re)) {
        if (m.excludeAfter && m.excludeAfter.test(spaced.slice(r.index + r[0].length))) continue; // "롤 리프트바운드 카드깡" 등
        const start = toKeyIdx[r.index];
        hits.push({ id: m.id, start, len: m.key.length });
      }
    } else {
      for (let at = keyText.indexOf(m.key); at !== -1; at = keyText.indexOf(m.key, at + 1)) {
        hits.push({ id: m.id, start: at, len: m.key.length });
      }
    }
  }

  // 긴 이름부터 자리를 차지하고, 겹치는 짧은 이름은 버림
  hits.sort((a, b) => b.len - a.len || a.start - b.start);
  const taken = [];
  const kept = [];
  for (const h of hits) {
    const end = h.start + h.len;
    if (taken.some(([s, e]) => h.start < e && s < end)) continue;
    taken.push([h.start, end]);
    kept.push(h);
  }
  return kept;
}

/**
 * @param {string} text 제목 + 본문
 * @param {ReturnType<typeof buildMatchers>} matchers
 * @param {number} [limit]
 * @returns {string[]} 관련 게임 id (글에 나온 순서)
 */
export function matchGames(text, matchers, limit = MAX_RELATED) {
  const first = new Map();
  for (const h of findGameHits(text, matchers)) {
    if (!first.has(h.id) || first.get(h.id) > h.start) first.set(h.id, h.start);
  }
  return [...first].sort((a, b) => a[1] - b[1]).slice(0, limit).map(([id]) => id);
}
