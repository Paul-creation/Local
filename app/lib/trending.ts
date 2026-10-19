// 메인 인원별 추천의 "인기 급상승" 규칙 — 순수 함수만 (다른 파일을 import하지 않아 trending.test.mjs가 .ts를 바로 불러온다)
// 신호: 동접 증가율(player_history) · 최근 리뷰 속도(games 현재값) · 스트리머 영상(streamer_videos 최근 14일)
// 칸: 재부상(신작이 아니고 현재 동접 1,000 이상, 증가율 1.2 이상 — 동접 10만 이상은 2.5 이상) · 신작(출시 90일 이내 + 리뷰 10만 미만). 인원별로 재부상 4 + 신작 4

export const MIN_PLAYERS = 300;          // 이 아래 동접은 증가율이 노이즈라 후보에서 뺀다 (신작)
export const RISING_MIN_PLAYERS = 1000;  // 재부상 칸은 현재 동접 1,000 이상만
export const BIG_PLAYERS = 100_000;      // 동접이 이 이상인 큰 게임은
export const BIG_MIN_GP = 2.5;           // 증가율 2.5 이상일 때만 재부상 후보·배지
export const RISING_MIN_GP = 1.2;        // 재부상 칸 후보 하한 (동접 증가율)
export const BADGE_GP = 1.5;             // "다시 뜨는 중" 배지 (출시 1년 이상 + 이 이상)
export const BADGE_MIN_AGE_DAYS = 365;  // 출시 1년 이상 → "다시 뜨는 중", 91~364일 → "요즘 뜨는 중" (둘 다 증가율 1.5 이상)
export const NEW_DAYS = 90;              // 신작: 출시 90일 이내
export const NEW_MAX_REVIEWS = 100_000;  // 신작: 리뷰 10만 미만 (이미 큰 게임의 새 버전은 신작이 아님)
export const STREAMER_DAYS = 14;         // 스트리머 영상은 14일 안, 하루 지날 때마다 1/14씩 줄어든다
export const STREAMER_BADGE_SUM = 3;     // "스트리머 화제": 14일 가중 합 3 이상
export const RISING_SLOTS = 4;
export const NEW_SLOTS = 4;
export const NEW_FIXED = 3;              // 신작은 점수 상위 3개를 날짜와 무관하게 고정
export const RISING_POOL = 12;           // 점수 상위 12개 중 날짜 시드로 5개
export const NEW_POOL = 6;               // 나머지 1개는 4~6위 중 날짜 시드로

export type TrendBadge = '다시 뜨는 중' | '요즘 뜨는 중' | '신작' | '스트리머 화제';
export type Sample = { age: number; count: number }; // age: 기록한 지 며칠 지났는지

const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const a = [...values].sort((x, y) => x - y);
  const mid = a.length >> 1;
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

// 동접 증가율 = 최근 3일 중앙값 ÷ 7일 전 같은 3일 중앙값 (요일 효과를 맞춤). 분모는 50 아래로 내려가지 않게 (작은 동접의 폭주 방지)
// 두 구간 모두 3일 중 기록이 있는 날이 2일 이상이어야 한다 (한 날에 두 번 기록돼도 1일). 모자라면 null = 후보에서 뺌 (대체 구간 없음)
// 동접 0 이하는 기록 실패로 보고 없는 값으로 친다 (0이 분모·중앙값에 들어가 증가율이 튀는 것 방지)
export const MIN_COMPARE_DAYS = 2;
export function playerGrowth(samples: Sample[]): { gp: number } | null {
  const pick = (from: number, to: number) => samples.filter((s) => s.age > from && s.age <= to && s.count > 0);
  const days = (list: Sample[], from: number) => new Set(list.map((s) => Math.ceil(s.age - from) - 1)).size;
  const recent = pick(0, 3);
  const same = pick(7, 10);
  if (days(recent, 0) < MIN_COMPARE_DAYS || days(same, 7) < MIN_COMPARE_DAYS) return null;
  return { gp: median(recent.map((s) => s.count))! / Math.max(median(same.map((s) => s.count))!, 50) };
}

// 리뷰 속도 = (최근 30일 리뷰 ÷ 전체 리뷰) ÷ (30일 ÷ 나이) — 평생 평균 대비 배율. 최근 리뷰 30개 미만이면 null
export function reviewSpeed(recentCount: number | null, total: number | null, ageDays: number | null): number | null {
  if (recentCount == null || recentCount < 30 || !total || !ageDays || ageDays <= 0) return null;
  return (recentCount / total) / Math.min(1, 30 / ageDays);
}

// 스트리머 영상 가중 합 — 영상 나이(일) 배열 → 오늘 올라온 영상 1, 14일 전 0으로 선형 감쇠
export function streamerSum(ages: number[]): number {
  return ages.reduce((sum, a) => sum + (a > STREAMER_DAYS ? 0 : 1 - clamp(a, 0, STREAMER_DAYS) / STREAMER_DAYS), 0);
}

export type TrendInput = {
  current: number | null;           // 현재 동접
  ageDays: number | null;           // 출시 후 일수 (모르면 null)
  reviewTotal: number | null;
  recentReviews: number | null;     // 최근 30일 리뷰 수
  gp: number | null;                // playerGrowth().gp
  streamer: number;                 // streamerSum()
};
export type Trend = { kind: 'rising' | 'new'; score: number; badges: TrendBadge[] };

const weighted = (parts: [number | null, number][]) => {
  const use = parts.filter((p): p is [number, number] => p[0] != null);
  const w = use.reduce((a, [, b]) => a + b, 0);
  return w ? use.reduce((a, [x, b]) => a + x * b, 0) / w : 0;
};

// 후보가 아니면 null. 점수는 동접 0.5 · 리뷰 0.3 · 스트리머 0.2 (없는 신호는 빼고 다시 맞춤)
export function classify(t: TrendInput): Trend | null {
  const cur = t.current ?? 0;
  if (cur < MIN_PLAYERS) return null;
  const S = clamp(t.streamer / 5);
  const isNew = t.ageDays != null && t.ageDays >= 0 && t.ageDays <= NEW_DAYS && (t.reviewTotal ?? 0) < NEW_MAX_REVIEWS;
  const badges: TrendBadge[] = [];
  let kind: Trend['kind'];
  let score: number;
  if (isNew) {
    kind = 'new';
    // 신작은 증가율을 낼 만큼 기록이 없어 규모(수준)로 본다
    const P = clamp((Math.log10(cur) - 2) / 2.5);
    const R = t.recentReviews ? clamp(Math.log10(t.recentReviews) / 4) : null;
    score = weighted([[P, 0.5], [R, 0.3], [S, 0.2]]);
    badges.push('신작');
  } else {
    if (cur < RISING_MIN_PLAYERS || t.gp == null || t.gp < RISING_MIN_GP) return null;
    if (cur >= BIG_PLAYERS && t.gp < BIG_MIN_GP) return null;
    kind = 'rising';
    const P = clamp(Math.log2(t.gp) / 2);
    const gr = reviewSpeed(t.recentReviews, t.reviewTotal, t.ageDays);
    const R = gr != null ? clamp(Math.log2(gr) / 2) : null; // 리뷰 속도는 점수 보정에만 (후보 조건·배지에는 안 씀)
    score = weighted([[P, 0.5], [R, 0.3], [S, 0.2]]);
    if (t.ageDays != null && t.gp >= BADGE_GP) {
      if (t.ageDays >= BADGE_MIN_AGE_DAYS) badges.push('다시 뜨는 중');
      else if (t.ageDays > NEW_DAYS) badges.push('요즘 뜨는 중');
    }
  }
  if (t.streamer >= STREAMER_BADGE_SUM) badges.push('스트리머 화제');
  return { kind, score, badges };
}

// 검색 "지금 뜨는 게임" 필터용 저장값 (games.trend_badge) — classify 배지 그대로: 신작 / 다시 뜨는 중(출시 1년 이상) / 요즘 뜨는 중(91~364일). 배지가 없는 후보(증가율 1.2~1.5)는 null
export type TrendBadgeKey = 'new' | 'rising_old' | 'rising_recent';
const BADGE_KEY: Partial<Record<TrendBadge, TrendBadgeKey>> = { '신작': 'new', '다시 뜨는 중': 'rising_old', '요즘 뜨는 중': 'rising_recent' };
export function trendBadgeKey(t: Trend | null): TrendBadgeKey | null {
  for (const b of t?.badges ?? []) if (BADGE_KEY[b]) return BADGE_KEY[b]!;
  return null;
}

// 문자열 → 32비트 시드 (FNV-1a), 시드 → 난수 (mulberry32)
const hashSeed = (str: string) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed: number) => () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// 풀에서 count개를 시드로 고른다 (Fisher-Yates) — 같은 시드는 같은 결과
export const pickDaily = <T,>(pool: T[], count: number, seedKey: string): T[] => {
  const rand = rng(hashSeed(seedKey));
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, count);
};

// 보여줄 순서 — 앞 3개가 재부상 2 + 신작 1, 4~6번째는 재부상·신작을 번갈아, 신작 연속은 맨 끝(7·8번째) (내 PC 필터로 걸러져도 섞임이 유지됨)
const ORDER = 'RRNRNRNN';

// 점수 순 id 배열 두 개(재부상·신작)에서 재부상 4개(상위 12개 풀에서 날짜 시드로)와 신작 4개(상위 3개 고정 + 4~6위 중 날짜 시드로 1개)를 골라 ORDER대로 늘어놓는다
// 한쪽이 모자라면 모자란 만큼 다른 쪽에서 채운다 (총 8개 유지)
export function pickSlots(rising: string[], fresh: string[], seedKey: string): string[] {
  const rs = pickDaily(rising.slice(0, RISING_POOL), RISING_POOL, `${seedKey}:r`);
  const ns = [...fresh.slice(0, NEW_FIXED), ...pickDaily(fresh.slice(NEW_FIXED, NEW_POOL), NEW_POOL - NEW_FIXED, `${seedKey}:n`)];
  const r = rs.slice(0, Math.min(rs.length, RISING_SLOTS + Math.max(0, NEW_SLOTS - ns.length)));
  const n = ns.slice(0, Math.min(ns.length, NEW_SLOTS + Math.max(0, RISING_SLOTS - rs.length)));
  const out: string[] = [];
  for (let i = 0; r.length || n.length; i++) {
    const wantR = ORDER[i % ORDER.length] === 'R';
    const from = (wantR ? r.length : n.length) ? (wantR ? r : n) : (wantR ? n : r);
    out.push(from.shift()!);
  }
  return out;
}
