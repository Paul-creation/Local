// 게임 취향 벡터와 유사도 — "비슷한 게임"(game_similar)을 만드는 순수 함수 (DB·네트워크 없음, scripts/build-similar-games.mjs가 가져다 씀)
// 벡터(희소): 태그마다 √(득표 / 그 게임의 최대 득표), 확인된 활동(activities_confirmed)마다 0.5. 유사도는 코사인
// 득표가 없거나 0 이하인 태그는 뺀다. 태그·활동이 하나도 없으면 빈 벡터(어떤 게임과도 유사도 0)
export const ACTIVITY_WEIGHT = 0.5;

export type TagVote = { tag_id: number | string; votes: number | null | undefined };
export type TasteVector = { w: Map<string, number>; norm: number };

export function gameVector(tags: readonly TagVote[], activities: readonly string[] | null | undefined): TasteVector {
  const w = new Map<string, number>();
  const valid = tags.filter((t) => Number.isFinite(t.votes) && (t.votes as number) > 0);
  const max = Math.max(0, ...valid.map((t) => t.votes as number));
  for (const t of valid) w.set(`t${t.tag_id}`, Math.sqrt((t.votes as number) / max));
  for (const a of activities ?? []) if (typeof a === 'string' && a) w.set(`a:${a}`, ACTIVITY_WEIGHT);
  let sq = 0;
  for (const v of w.values()) sq += v * v;
  return { w, norm: Math.sqrt(sq) };
}

export function cosine(a: TasteVector, b: TasteVector): number {
  if (!a.norm || !b.norm) return 0;
  const [small, big] = a.w.size <= b.w.size ? [a.w, b.w] : [b.w, a.w];
  let dot = 0;
  for (const [k, v] of small) {
    const o = big.get(k);
    if (o !== undefined) dot += v * o;
  }
  return dot / (a.norm * b.norm);
}

// 후보 중 기준 게임과 가장 비슷한 k개 (유사도 0 이하는 제외). 동점은 후보 목록에서 앞에 있는 게임이 먼저 — 인기순으로 정렬해 넘기면 인기순 동점 처리
export function topSimilar<T extends { id: string; vec: TasteVector }>(source: T, candidates: readonly T[], k: number): { id: string; score: number }[] {
  const scored: { id: string; score: number; at: number }[] = [];
  candidates.forEach((c, at) => {
    if (c.id === source.id) return;
    const score = cosine(source.vec, c.vec);
    if (score > 0) scored.push({ id: c.id, score, at });
  });
  scored.sort((x, y) => y.score - x.score || x.at - y.at);
  return scored.slice(0, Math.max(0, k)).map(({ id, score }) => ({ id, score }));
}

// ── 내 라이브러리 "취향 비슷한 게임" (브라우저에서 계산) ──
// 취향 벡터 = 보유 게임 벡터를 각각 길이 1로 맞춘 뒤 더한 것 (태그가 많은 게임이 취향을 혼자 끌고 가지 않게). 후보와는 코사인
// 최종 점수 = 코사인 × (1 + 0.15 × min(할인율, 50) / 50) — 할인은 가산점일 뿐 코사인이 0이면 후보가 아니다
export const SALE_BONUS = 0.15;
export const SALE_BONUS_CAP = 50;
export const MIN_OWNED_FOR_TASTE = 5;

export function profileVector(vecs: readonly TasteVector[]): TasteVector {
  const w = new Map<string, number>();
  for (const v of vecs) {
    if (!v.norm) continue;
    for (const [k, x] of v.w) w.set(k, (w.get(k) ?? 0) + x / v.norm);
  }
  let sq = 0;
  for (const x of w.values()) sq += x * x;
  return { w, norm: Math.sqrt(sq) };
}

export const saleBoost = (score: number, discountPercent: number | null | undefined) =>
  score * (1 + (SALE_BONUS * Math.min(Math.max(discountPercent || 0, 0), SALE_BONUS_CAP)) / SALE_BONUS_CAP);

// /api/games/taste 한 줄: [게임 id, [[태그 번호, 득표], …], [확인된 활동 키, …]]
export type TasteRow = [string, [number, number][], string[]];

// 보유하지 않은 게임을 취향 점수순으로. 동점은 popularity(작을수록 인기)가 작은 게임이 먼저, 그다음 id
// 보유 게임 중 벡터가 있는 게임이 하나도 없으면 빈 목록
export function rankByTaste(
  rows: readonly TasteRow[],
  ownedIds: ReadonlySet<string>,
  discountOf: (id: string) => number,
  popularityOf: (id: string) => number,
  limit = Infinity,
): { id: string; score: number }[] {
  const vecs = rows.map(([id, tags, acts]) => ({ id, vec: gameVector(tags.map(([tag_id, votes]) => ({ tag_id, votes })), acts) }));
  const profile = profileVector(vecs.filter((x) => ownedIds.has(x.id)).map((x) => x.vec));
  if (!profile.norm) return [];
  const out: { id: string; score: number; pop: number }[] = [];
  for (const x of vecs) {
    if (ownedIds.has(x.id)) continue;
    const c = cosine(profile, x.vec);
    if (c > 0) out.push({ id: x.id, score: saleBoost(c, discountOf(x.id)), pop: popularityOf(x.id) });
  }
  out.sort((a, b) => b.score - a.score || a.pop - b.pop || (a.id < b.id ? -1 : 1));
  return out.slice(0, limit).map(({ id, score }) => ({ id, score }));
}
