// The Game Awards 올해의 게임 기록 (games.goty_awards, scripts/apply-game-meta.mjs가 채움)
export type GotyAward = { year: number; result: 'winner' | 'nominee' };

// 형식이 이상한 값은 버리고, 수상 먼저 → 최근 연도 순
export function sortGoty(raw: unknown): GotyAward[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is GotyAward => Number.isInteger(a?.year) && (a?.result === 'winner' || a?.result === 'nominee'))
    .sort((a, b) => (a.result === b.result ? b.year - a.year : a.result === 'winner' ? -1 : 1));
}

export const gotyLabel = (a: GotyAward) => (a.result === 'winner' ? `${a.year} 올해의 게임` : `${a.year} 올해의 게임 후보`);
