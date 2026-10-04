// 글 제목+본문에서 게임 이름(영문 이름·한국어 이름·별칭)을 찾는 순수 함수 — 서버(app/lib/postLinks.ts)와 scripts/fill-post-related-games.mjs가 같이 씀
// - 긴 이름(띄어쓰기 빼고 5자 이상): 띄어쓰기·기호를 무시하고 포함되면 매칭 ("스타듀 밸리" = "스타듀밸리")
// - 짧은 이름(2~4자): 앞뒤가 단어 경계일 때만 (한국어 조사 "을·를·이랑…"은 허용) → "롤러코스터" 안의 "롤" 같은 오매칭 방지
// - 1자 이름과 흔한 낱말(STOP)은 쓰지 않음
// - 겹치는 이름은 더 긴 쪽 우선 ("Dying Light: The Beast" 안의 "Dying Light"는 따로 안 셈), 글에 먼저 나온 순서로 최대 3개

export const MAX_RELATED = 3;
const SHORT_MAX = 4;
const STOP = new Set(['게임', '피시', 'pc', '스팀', 'steam', '친구', '멀티', '협동', '할인', '세일']);
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

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 게임 목록 → 매칭에 쓸 이름 목록 (게임마다 한 번만 만들어 두고 재사용)
 * @param {{ id: string, name: string | null, search_name_ko?: string | null }[]} games
 * @returns {{ id: string, key: string, re: RegExp | null }[]}
 */
export function buildMatchers(games) {
  const out = [];
  for (const g of games) {
    const names = [g.name, ...String(g.search_name_ko || '').split(',')];
    const seen = new Set();
    for (const raw of names) {
      const spaced = normalize(raw);
      const key = spaced.replace(/ /g, '');
      if ([...key].length < 2 || STOP.has(key) || seen.has(key)) continue;
      seen.add(key);
      const short = [...key].length <= SHORT_MAX;
      const forms = [...new Set([spaced, key])].map(escapeRe).join('|');
      out.push({ id: g.id, key, re: short ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${forms})${PARTICLE}(?![\\p{L}\\p{N}])`, 'gu') : null });
    }
  }
  return out;
}

/**
 * @param {string} text 제목 + 본문
 * @param {ReturnType<typeof buildMatchers>} matchers
 * @param {number} [limit]
 * @returns {string[]} 관련 게임 id (글에 나온 순서)
 */
export function matchGames(text, matchers, limit = MAX_RELATED) {
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
  const first = new Map();
  for (const h of hits) {
    const end = h.start + h.len;
    if (taken.some(([s, e]) => h.start < e && s < end)) continue;
    taken.push([h.start, end]);
    if (!first.has(h.id) || first.get(h.id) > h.start) first.set(h.id, h.start);
  }
  return [...first].sort((a, b) => a[1] - b[1]).slice(0, limit).map(([id]) => id);
}
