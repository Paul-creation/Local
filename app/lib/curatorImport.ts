// 관리자 "캡션 붙여넣기 게시물 연결" 도구의 순수 함수 (DB·네트워크 호출 없음, 테스트 대상)
// 캡션 → AI가 뽑은 게임 이름 → games와 매칭(정확 → 정규화 → 부분) · 인스타 주소 정리 · 입력 길이 제한

export const LIMITS = { caption: 6000, title: 120, url: 300, names: 40, nameLen: 80 };

export type MatchGame = { id: string; name: string; display_name: string | null; search_name_ko: string | null };
export type MatchTier = 'exact' | 'normalized' | 'partial';
export type Match<G extends MatchGame = MatchGame> = { game: G; tier: MatchTier };

// 대소문자·기호·공백·™® 차이를 없앤 비교용 문자열 (한글·영문·숫자만 남김)
export function normalizeName(s: string): string {
  return String(s || '').replace(/[™®©℠]/g, '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

// search_name_ko는 쉼표로 이름을 이어 붙인 칸
const aliasesOf = (g: MatchGame): string[] =>
  [g.name, g.display_name, ...(g.search_name_ko ? g.search_name_ko.split(',') : [])]
    .map((x) => (x || '').trim())
    .filter(Boolean);

// 부분 일치는 너무 짧은 이름이 아무 데나 걸리지 않게 정규화한 길이가 한글 2자·영문 3자 이상일 때만
const partialOk = (n: string) => (/[ㄱ-ㆎ가-힣]/.test(n) ? n.length >= 2 : n.length >= 3);

// 숨긴 게임은 호출하는 쪽에서 미리 뺀 목록을 넘긴다. 후보는 일치 단계 순(정확 → 정규화 → 부분), 같은 단계에선 이름 길이가 비슷한 순, 최대 limit개
export function matchGames<G extends MatchGame>(query: string, games: G[], limit = 3): Match<G>[] {
  const q = String(query || '').trim();
  const nq = normalizeName(q);
  if (!nq) return [];
  const rank: Record<MatchTier, number> = { exact: 0, normalized: 1, partial: 2 };
  const out: (Match<G> & { gap: number })[] = [];
  for (const game of games) {
    const names = aliasesOf(game);
    let tier: MatchTier | null = null;
    let gap = 0;
    if (names.some((n) => n.toLowerCase() === q.toLowerCase())) tier = 'exact';
    else if (names.some((n) => normalizeName(n) === nq)) tier = 'normalized';
    else if (partialOk(nq)) {
      const hit = names.map(normalizeName).filter((n) => n && (n.includes(nq) || (partialOk(n) && nq.includes(n))));
      if (hit.length) {
        tier = 'partial';
        gap = Math.min(...hit.map((n) => Math.abs(n.length - nq.length)));
      }
    }
    if (tier) out.push({ game, tier, gap });
  }
  out.sort((a, b) => rank[a.tier] - rank[b.tier] || a.gap - b.gap);
  return out.slice(0, limit).map(({ game, tier }) => ({ game, tier }));
}

// AI 응답 텍스트에서 { title, games } 를 꺼냄. 코드 펜스·앞뒤 설명이 붙어도 첫 { 부터 마지막 } 까지만 읽는다
export function parseExtraction(text: string): { title: string; games: string[] } {
  const s = String(text || '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  let obj: unknown = null;
  if (a >= 0 && b > a) {
    try { obj = JSON.parse(s.slice(a, b + 1)); } catch { obj = null; }
  }
  const o = (obj && typeof obj === 'object' ? obj : {}) as { title?: unknown; games?: unknown };
  const title = typeof o.title === 'string' ? o.title.trim().slice(0, LIMITS.title) : '';
  return { title, games: cleanNames(Array.isArray(o.games) ? o.games : []) };
}

// 게임 이름 목록 정리: 문자열만, 앞뒤 공백·번호 머리말 제거, 길이 제한, 같은 이름(정규화 기준) 한 번만, 최대 개수
export function cleanNames(list: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of list) {
    if (typeof x !== 'string') continue;
    const name = x.replace(/^\s*(?:\d+\s*[.)\]:-]|[-*•·])\s*/, '').trim().slice(0, LIMITS.nameLen);
    const key = normalizeName(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= LIMITS.names) break;
  }
  return out;
}

// 캡션 첫 줄 (게시물 제목 제안용, AI가 제목을 못 줬을 때)
export function firstLine(caption: string): string {
  const line = String(caption || '').split(/\r?\n/).map((l) => l.trim()).find(Boolean) || '';
  return line.slice(0, LIMITS.title);
}

// 인스타 게시물 주소를 저장 형식(https://www.instagram.com/p/코드/)으로. 공유 링크의 ?igsh= 같은 꼬리는 떼고, 인스타 주소가 아니면 null
export function normalizePostUrl(input: string): string | null {
  const raw = String(input || '').trim();
  if (!raw || raw.length > LIMITS.url) return null;
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'https:' || !/^(www\.)?instagram\.com$/.test(u.hostname)) return null;
  const m = u.pathname.match(/^(?:\/[A-Za-z0-9._]+)?\/(p|reel|tv)\/([A-Za-z0-9_-]{5,30})\/?$/);
  return m ? `https://www.instagram.com/${m[1]}/${m[2]}/` : null;
}

// 게시물 종류: 연결할 게임이 1개면 single, 2개 이상이면 collection
export const postTypeFor = (count: number): 'single' | 'collection' => (count >= 2 ? 'collection' : 'single');

// 게시 날짜(YYYY-MM-DD, 한국 시간 정오로 저장해 날짜가 하루 밀리지 않게). 비었거나 형식이 틀리면 null
export function postedAtIso(date: string): string | null {
  const m = String(date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00+09:00`).toISOString();
}

export const isAppid = (s: unknown): s is string => typeof s === 'string' && /^\d{1,10}$/.test(s);
export const isUuid = (s: unknown): s is string =>
  typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
