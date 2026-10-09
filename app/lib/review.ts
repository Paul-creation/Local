// 스팀 평가 문구 → 색 단계. 긍정 = 평가 색, 부정 = 할인·경고 색, 그 사이(복합적 등) = 보조 글자색 (노랑·금색 계열 쓰지 않음)
export function reviewTone(summary: string | null | undefined): 'positive' | 'mixed' | 'negative' {
  if (summary?.includes('긍정')) return 'positive';
  if (summary?.includes('부정')) return 'negative';
  return 'mixed';
}
