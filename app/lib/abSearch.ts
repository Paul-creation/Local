// 에어비앤비식 3칸 검색(누구랑·어떻게·뭐 할까)의 순수 규칙 — 다른 파일을 import하지 않아 테스트(abSearch.test.mjs)가 .ts를 바로 불러온다
// 조건은 주소 쿼리로 주고받는다: n(인원) · how(방식) · g(장르 타일, 쉼표) · kw(직접 입력) · o(조건 칩, 쉼표)
// 전부 DB 값으로만 판정하고 AI는 쓰지 않는다. 인원·한국어·무료는 값이 비어 있으면 통과, 나머지는 값이 있어야 통과

export const MAX_N = 16;

export type HowKey = 'coop' | 'pvp' | 'party' | 'brain' | 'any';
export const HOWS: { key: HowKey; label: string; desc: string; mark: string }[] = [
  { key: 'coop', label: '같이 깨기', desc: '협동해서 끝까지', mark: '＋' },
  { key: 'pvp', label: '서로 붙기', desc: '친구끼리 대전', mark: '×' },
  { key: 'party', label: '왁자지껄 파티', desc: '짧게 여러 판', mark: '◎' },
  { key: 'brain', label: '머리 맞대기', desc: '퍼즐, 말로 맞추는 게임', mark: '?' },
  { key: 'any', label: '아무거나', desc: '재밌으면 됨', mark: '∗' },
];

// 장르 타일 — 게임이 아래 중 하나라도 가지면 맞는 것으로 본다 (genres·themes는 IGDB 영문 이름, tags는 태그 사전 이름, acts는 활동 키)
export type GenreKey = 'horror' | 'survival' | 'drive' | 'cook' | 'puzzle' | 'scifi' | 'fantasy' | 'racing' | 'sports' | 'rhythm';
type Rule = { genres?: string[]; themes?: string[]; tags?: string[]; acts?: string[] };
export const GENRES: { key: GenreKey; label: string; rule: Rule }[] = [
  { key: 'horror', label: '공포', rule: { themes: ['Horror'], tags: ['horror'], acts: ['horror_scare'] } },
  { key: 'survival', label: '생존·크래프팅', rule: { themes: ['Survival'], tags: ['survival', 'crafting'], acts: ['craft'] } },
  { key: 'drive', label: '운전·여행', rule: { tags: ['driving'], acts: ['drive', 'ride', 'sail', 'fly', 'train'] } },
  { key: 'cook', label: '요리', rule: { tags: ['cooking'], acts: ['cook'] } },
  { key: 'puzzle', label: '퍼즐', rule: { genres: ['Puzzle'], tags: ['puzzle'], acts: ['puzzle'] } },
  { key: 'scifi', label: '우주·SF', rule: { themes: ['Science fiction'], tags: ['space', 'scifi'] } },
  { key: 'fantasy', label: '판타지', rule: { themes: ['Fantasy'], tags: ['fantasy'] } },
  { key: 'racing', label: '레이싱', rule: { genres: ['Racing'], tags: ['racing'] } },
  { key: 'sports', label: '스포츠', rule: { genres: ['Sport'], tags: ['sports'], acts: ['sports'] } },
  { key: 'rhythm', label: '리듬', rule: { genres: ['Music'], tags: ['rhythm'], acts: ['music'] } },
];
export const genreLabel = (k: GenreKey) => GENRES.find((g) => g.key === k)?.label ?? k;

// "어떻게" 중 협동·대전은 플래그로, 파티·머리 맞대기는 규칙으로
export const HOW_RULES: Record<'party' | 'brain', Rule> = {
  party: { themes: ['Party'], tags: ['party', 'minigames'], acts: ['minigame'] },
  brain: { genres: ['Puzzle'], tags: ['puzzle', 'wordgame', 'trivia', 'deduction'], acts: ['puzzle', 'deduction'] },
};

export type OptKey = 'free' | 'u10k' | 'sale' | 'easy' | 'ko' | 'local';
export const OPTS: { key: OptKey; label: string }[] = [
  { key: 'free', label: '무료' },
  { key: 'u10k', label: '만 원 이하' },
  { key: 'sale', label: '지금 할인 중' },
  { key: 'easy', label: '쉬운 게임' },
  { key: 'ko', label: '한국어' },
  { key: 'local', label: '한 화면에서' },
];
export const U10K = 10000;

export type GenreMode = 'all' | 'any'; // 장르를 여러 개 골랐을 때: all = 고른 장르를 모두 가진 게임, any = 하나라도 가진 게임
export type AbQuery = { n: number | null; how: HowKey | null; genres: GenreKey[]; gm: GenreMode; kw: string; opts: OptKey[] };
export const EMPTY_QUERY: AbQuery = { n: null, how: null, genres: [], gm: 'all', kw: '', opts: [] };

const isHow = (v: string | null): v is HowKey => !!v && HOWS.some((h) => h.key === v);
const isGenre = (v: string): v is GenreKey => GENRES.some((g) => g.key === v);
const isOpt = (v: string): v is OptKey => OPTS.some((o) => o.key === v);

export function parseQuery(sp: { get(k: string): string | null }): AbQuery {
  const n = Number(sp.get('n'));
  const how = sp.get('how');
  const list = (k: string) => (sp.get(k) || '').split(',').filter(Boolean);
  return {
    n: Number.isInteger(n) && n >= 1 ? Math.min(n, MAX_N) : null,
    how: isHow(how) ? how : null,
    genres: [...new Set(list('g').filter(isGenre))],
    gm: sp.get('gm') === 'any' ? 'any' : 'all', // 없거나 모르는 값이면 all
    kw: (sp.get('kw') || '').trim().slice(0, 40),
    opts: [...new Set(list('o').filter(isOpt))],
  };
}

export function queryToParams(q: AbQuery): string {
  const p = new URLSearchParams();
  if (q.n) p.set('n', String(q.n));
  if (q.how) p.set('how', q.how);
  if (q.genres.length) p.set('g', q.genres.join(','));
  if (q.genres.length > 1 && q.gm === 'any') p.set('gm', 'any'); // all은 기본값이라 주소에 싣지 않는다
  if (q.kw) p.set('kw', q.kw);
  if (q.opts.length) p.set('o', q.opts.join(','));
  return p.toString();
}

export const queryHref = (q: AbQuery) => {
  const s = queryToParams(q);
  return s ? `/find?${s}` : '/find';
};

export const isEmptyQuery = (q: AbQuery) => !q.n && !q.how && !q.genres.length && !q.kw && !q.opts.length;

// 뭐 할까 칸 글자 — 여럿이면 "공포 외 1개" (말줄임 "공포, ..." 안 씀)
function whatText(q: AbQuery) {
  const items = [...q.genres.map(genreLabel), ...(q.kw ? [q.kw] : [])];
  return items.length > 1 ? `${items[0]} 외 ${items.length - 1}개` : (items[0] ?? '');
}

// 접힌 검색창 글자 — "4명 | 같이 깨기 | 공포"
export function summaryParts(q: AbQuery) {
  return {
    who: q.n ? (q.n >= 5 ? `${q.n}명 이상` : q.n === 1 ? '혼자' : `${q.n}명`) : '',
    how: q.how ? HOWS.find((h) => h.key === q.how)!.label : '',
    what: whatText(q),
  };
}

// ---------- 게임 판정 ----------
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 게임 칸은 목록(gameIndex)과 같은 느슨한 모양
export type AbGame = any;

// 태그 판정은 브라우저가 태그 나무로 만들어 넘긴다 (이 파일은 나무를 모른다)
export type AbCtx = {
  hasTag: (g: AbGame, names: string[]) => boolean; // 사전 이름(정규화) 중 하나라도 가진 게임
};
export const NO_TAGS: AbCtx = { hasTag: () => false };

const hasAny = (list: string[] | null | undefined, want?: string[]) => !!want?.length && !!list?.some((x) => want.includes(x));

function matchesRule(g: AbGame, r: Rule, ctx: AbCtx) {
  return hasAny(g.genres, r.genres) || hasAny(g.themes, r.themes) || hasAny(g.activities_confirmed, r.acts) || (!!r.tags && ctx.hasTag(g, r.tags));
}

export const matchesGenre = (g: AbGame, key: GenreKey, ctx: AbCtx) => matchesRule(g, GENRES.find((x) => x.key === key)!.rule, ctx);

// 인원: 최대·최소를 모르면 통과. 팀·파티 인원(party_max)이 있으면 그것을 최대로 본다
export function maxOf(g: AbGame): number | null {
  return g.party_max ?? g.max_players ?? null;
}
export function fitsPlayers(g: AbGame, n: number) {
  const max = maxOf(g);
  const min = g.min_players ?? null;
  if (max != null && n > max) return false;
  if (min != null && n < min) return false;
  return true;
}

export function matchesHow(g: AbGame, how: HowKey, ctx: AbCtx) {
  if (how === 'any') return true;
  if (how === 'coop') return !!(g.has_online_coop || g.has_local_coop);
  if (how === 'pvp') return !!g.has_pvp;
  return matchesRule(g, HOW_RULES[how], ctx);
}

// 현재 가격(할인 중이면 할인가) — 모르면 null
export function priceNow(g: AbGame): number | null {
  if (g.is_free) return 0;
  if (g.price_type) return null;
  return typeof g.price_final === 'number' ? g.price_final : null;
}
const soon = (g: AbGame) => g.release_status === 'coming_soon';

export function matchesOpt(g: AbGame, o: OptKey) {
  const p = priceNow(g);
  switch (o) {
    case 'free': return !soon(g) && (p == null ? !g.price_type : p === 0);
    case 'u10k': return !soon(g) && (p == null ? !g.price_type : p <= U10K);
    case 'sale': return (g.price_discount ?? 0) > 0;
    case 'easy': return barrierOf(g) === '낮음';
    case 'ko': return g.no_korean !== true;
    case 'local': return !!g.has_local_coop;
  }
}

export function barrierOf(g: AbGame): string | null {
  if (g.entry_barrier === '낮음' || g.entry_barrier === '보통' || g.entry_barrier === '높음') return g.entry_barrier;
  return ({ 쉬움: '낮음', 보통: '보통', 어려움: '높음' } as Record<string, string>)[g.difficulty] ?? null;
}

// 직접 입력: 게임 이름(영문·한글·별명)이거나 태그 이름이면 맞는 것 — 이름 비교는 searchMatch와 같은 규칙을 호출 쪽이 넘긴다
export type KwMatcher = (g: AbGame, kw: string) => boolean;

export type Parts = { n: boolean; how: boolean; genres: boolean; kw: boolean; opts: OptKey[] };
export const ALL_PARTS = (q: AbQuery): Parts => ({ n: !!q.n, how: !!q.how && q.how !== 'any', genres: q.genres.length > 0, kw: !!q.kw, opts: q.opts });

export function matchesQuery(g: AbGame, q: AbQuery, parts: Parts, ctx: AbCtx, kw: KwMatcher) {
  if (parts.n && q.n && !fitsPlayers(g, q.n)) return false;
  if (parts.how && q.how && !matchesHow(g, q.how, ctx)) return false;
  if (parts.genres) {
    const hit = (k: GenreKey) => matchesGenre(g, k, ctx);
    if (!(q.gm === 'any' ? q.genres.some(hit) : q.genres.every(hit))) return false;
  }
  if (parts.kw && q.kw && !kw(g, q.kw)) return false;
  for (const o of parts.opts) if (!matchesOpt(g, o)) return false;
  return true;
}

// 인기순 (heat_rank 낮을수록 위, 순위 없는 게임은 뒤에 받은 순서대로)
const byHeat = (a: AbGame, b: AbGame) => (a.heat_rank ?? Infinity) - (b.heat_rank ?? Infinity);

// 덜 중요한 조건부터 하나씩 풀어 결과가 생길 때까지 — 풀 조건이 없으면 그대로 0개
const DROP_ORDER: { label: string; apply: (p: Parts) => Parts }[] = [
  { label: '한 화면에서', apply: (p) => ({ ...p, opts: p.opts.filter((o) => o !== 'local') }) },
  { label: '쉬운 게임', apply: (p) => ({ ...p, opts: p.opts.filter((o) => o !== 'easy') }) },
  { label: '한국어', apply: (p) => ({ ...p, opts: p.opts.filter((o) => o !== 'ko') }) },
  { label: '만 원 이하', apply: (p) => ({ ...p, opts: p.opts.filter((o) => o !== 'u10k') }) },
  { label: '무료', apply: (p) => ({ ...p, opts: p.opts.filter((o) => o !== 'free') }) },
  { label: '지금 할인 중', apply: (p) => ({ ...p, opts: p.opts.filter((o) => o !== 'sale') }) },
  { label: '직접 입력', apply: (p) => ({ ...p, kw: false }) },
  { label: '장르', apply: (p) => ({ ...p, genres: false }) },
  { label: '방식', apply: (p) => ({ ...p, how: false }) },
  { label: '인원', apply: (p) => ({ ...p, n: false }) },
];
const partsCount = (p: Parts) => (p.n ? 1 : 0) + (p.how ? 1 : 0) + (p.genres ? 1 : 0) + (p.kw ? 1 : 0) + p.opts.length;

export function search(games: AbGame[], q: AbQuery, ctx: AbCtx, kw: KwMatcher) {
  let parts = ALL_PARTS(q);
  let list = games.filter((g) => matchesQuery(g, q, parts, ctx, kw));
  const relaxed: string[] = [];
  // 장르를 여러 개 "모두"로 골랐는데 결과가 없으면, 조건을 풀기 전에 "하나라도"로 다시 계산해 보여 준다
  if (list.length === 0 && parts.genres && q.gm === 'all' && q.genres.length > 1) {
    const anyList = games.filter((g) => matchesQuery(g, { ...q, gm: 'any' }, parts, ctx, kw));
    if (anyList.length > 0) return { list: [...anyList].sort(byHeat), relaxed, parts, genresAny: true };
  }
  for (const step of DROP_ORDER) {
    if (list.length > 0) break;
    const next = step.apply(parts);
    if (partsCount(next) === partsCount(parts)) continue; // 원래 없던 조건
    parts = next;
    relaxed.push(step.label);
    list = games.filter((g) => matchesQuery(g, q, parts, ctx, kw));
  }
  return { list: [...list].sort(byHeat), relaxed, parts, genresAny: false };
}

// 조건 전체에 맞는 게임 수 (조건을 풀어 주는 단계 없이) — 뭐 할까 팝오버의 "N개 보기"
export const countMatching = (games: AbGame[], q: AbQuery, ctx: AbCtx, kw: KwMatcher) => {
  const parts = ALL_PARTS(q);
  return games.filter((g) => matchesQuery(g, q, parts, ctx, kw)).length;
};

// 홈 검색창 패널 아래 "N명이 같이 할 수 있는 게임 N개"
export const countFitting = (games: AbGame[], n: number) => games.filter((g) => fitsPlayers(g, n)).length;

// ---------- 근거 배지 (✓ 맞음 / ⚠ 주의) — 전부 DB 값으로만 ----------
export type Badge = { ok: boolean; text: string };
const won = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`;

export function badgesFor(g: AbGame, q: AbQuery, parts: Parts, ctx: AbCtx): Badge[] {
  const ok: Badge[] = [];
  const warn: Badge[] = [];
  const n = q.n;
  const max = maxOf(g);
  if (n && n >= 2) {
    if (max != null && max < n) warn.push({ ok: false, text: `최대 ${max}인까지` });
    else if (g.has_online_coop && max != null) ok.push({ ok: true, text: `${n}인 온라인 협동` });
    else if (g.has_pvp && max != null) ok.push({ ok: true, text: `${n}인 대전` });
    else if (max != null) ok.push({ ok: true, text: `${n}인 가능` });
    if (g.has_local_coop && !g.has_online_coop && !(max != null && max < n)) warn.push({ ok: false, text: '온라인 협동 없음 (로컬만)' });
  } else if (n === 1 && (g.solo_mode === 'story' || g.solo_mode === 'possible' || g.solo_playable === true)) {
    ok.push({ ok: true, text: '혼자 가능' });
  }
  if (q.how === 'coop' && !(g.has_online_coop || g.has_local_coop)) warn.push({ ok: false, text: '협동 모드 없음' });
  if (q.how === 'pvp') (g.has_pvp ? ok : warn).push({ ok: !!g.has_pvp, text: g.has_pvp ? '친구끼리 대전' : '대전 모드 없음' });
  if (q.how === 'coop' && n == null && g.has_online_coop) ok.push({ ok: true, text: '온라인 협동' });
  for (const k of q.genres) if (matchesGenre(g, k, ctx)) ok.push({ ok: true, text: genreLabel(k) });
  if (g.has_local_coop && q.opts.includes('local') && parts.opts.includes('local')) ok.push({ ok: true, text: '한 화면에서 같이' });
  if (g.no_korean === true) warn.push({ ok: false, text: '한국어 지원 없음' });
  else if (g.korean_support && g.korean_support !== '한국어 없음' && q.opts.includes('ko')) ok.push({ ok: true, text: g.korean_support === '자막+더빙' ? '한국어 자막·더빙' : '한국어 자막' });
  if ((g.price_discount ?? 0) > 0) ok.push({ ok: true, text: `지금 ${g.price_discount}% 할인` });
  if (g.is_free) ok.push({ ok: true, text: '무료' });
  else if (q.opts.includes('u10k') && !soon(g) && priceNow(g) != null && priceNow(g)! <= U10K) ok.push({ ok: true, text: '만 원 이하' });
  const b = barrierOf(g);
  if (b === '낮음') ok.push({ ok: true, text: '처음 해도 쉬움' });
  else if (b === '높음') warn.push({ ok: false, text: '진입장벽 높음' });
  return [...ok.slice(0, 4), ...warn.slice(0, 3)];
}

// "N명 다 사면 ₩합계" — 역대 최저가(lowest_price) × 인원, 무료면 "무료". 인원이 2명 미만이거나 가격을 모르면 null
export function groupTotal(g: AbGame, n: number | null): string | null {
  if (!n || n < 2) return null;
  if (g.is_free) return '무료';
  if (soon(g) || g.price_type) return null;
  const low = typeof g.lowest_price === 'number' && g.lowest_price >= 100 ? g.lowest_price : null;
  if (low != null) return `${n}명 다 사면 ${won(low * n)} (역대 최저가 기준)`;
  const now = priceNow(g);
  return now != null ? `${n}명 다 사면 ${won(now * n)} (현재가 기준)` : null;
}

// ---------- 상황 타일 6개 ----------
export const SITUATIONS: { key: string; title: string; desc: string; query: AbQuery }[] = [
  { key: 'duo-night', title: '둘이서 밤샘', desc: '둘이 끝까지 같이 깨는 협동', query: { n: 2, how: 'coop', genres: [], gm: 'all', kw: '', opts: [] } },
  { key: 'four-coop', title: '4명 첫 협동', desc: '넷이 처음 같이 해 보는 판', query: { n: 4, how: 'coop', genres: [], gm: 'all', kw: '', opts: ['easy'] } },
  { key: 'newbie', title: '게임 안 하는 친구랑', desc: '진입장벽 낮은 게임만', query: { n: null, how: null, genres: [], gm: 'all', kw: '', opts: ['easy', 'ko'] } },
  { key: 'free-now', title: '무료로 바로', desc: '결제 없이 지금 시작', query: { n: 2, how: null, genres: [], gm: 'all', kw: '', opts: ['free'] } },
  { key: 'scream', title: '비명 지르는 공포', desc: '같이 하면 더 무서운 판', query: { n: 3, how: 'coop', genres: ['horror'], gm: 'all', kw: '', opts: [] } },
  { key: 'sale-party', title: '오늘 할인 파티게임', desc: '할인 중인 왁자지껄', query: { n: 4, how: 'party', genres: [], gm: 'all', kw: '', opts: ['sale'] } },
];
