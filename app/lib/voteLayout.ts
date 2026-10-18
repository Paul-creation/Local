// 투표 칩 배치: 그룹 안에서 투표 많은 순(동률은 기존 순서). 정렬은 Array.sort가 안정 정렬이라 기존 순서가 유지된다.
export function sortGroupItems(items: string[], counts: Record<string, number>): string[] {
  return [...items].sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
}

// 게이지 비율 = 그 태그 투표수 / 최다 득표 태그 투표수 (0~1)
export function gaugeRatio(count: number, counts: Record<string, number>): number {
  const max = Math.max(0, ...Object.values(counts));
  return max > 0 ? Math.min(1, count / max) : 0;
}
