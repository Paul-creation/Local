// scripts/lib/trend-judge.mjs
// 전체 게임의 "지금 뜨는 게임" 판정 — app/lib/trending.ts의 classify·playerGrowth·streamerSum을 그대로 쓴다 (update-trending.mjs와 테스트가 씀)
// 인원 조건·핫차트 상위 10 제외는 없음 (메인 인원별 추천 전용 규칙). 숨긴 게임은 판정하지 않고 null
import { classify, playerGrowth, streamerSum, trendBadgeKey } from '../../app/lib/trending.ts';

const DAY = 86400_000;

// games: { id, hidden, current_players, release_date, review_total, recent_review_count }
// samples: Map<id, {age, count}[]> · streamerAges: Map<id, number[]> · now: ms
// → Map<id, { badge, score } | null> (null = 해당 없음)
export function judgeTrends(games, samples, streamerAges, now) {
  const out = new Map();
  for (const g of games) {
    if (g.hidden) { out.set(g.id, null); continue; }
    const t = classify({
      current: g.current_players,
      ageDays: g.release_date ? (now - new Date(g.release_date).getTime()) / DAY : null,
      reviewTotal: g.review_total,
      recentReviews: g.recent_review_count,
      gp: playerGrowth(samples.get(g.id) ?? [])?.gp ?? null,
      streamer: streamerSum(streamerAges.get(g.id) ?? []),
    });
    const badge = trendBadgeKey(t);
    out.set(g.id, badge ? { badge, score: Math.round(t.score * 10000) / 10000 } : null);
  }
  return out;
}

// 저장할 변경만 — 판정된 게임은 점수·시각을 새로, 해당 없는데 값이 남은 게임은 null로 초기화 (이미 null이면 건드리지 않음)
export function planWrites(games, judged, at) {
  const writes = [];
  for (const g of games) {
    const j = judged.get(g.id);
    if (j) writes.push({ id: g.id, trend_badge: j.badge, trend_score: j.score, trend_at: at });
    else if (g.trend_badge != null || g.trend_score != null) writes.push({ id: g.id, trend_badge: null, trend_score: null, trend_at: at });
  }
  return writes;
}

export const countByBadge = (judged) => {
  const c = { new: 0, rising_old: 0, rising_recent: 0 };
  for (const j of judged.values()) if (j) c[j.badge]++;
  return c;
};
