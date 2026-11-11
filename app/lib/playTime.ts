// 한눈에 보기 "플레이 시간" 타일 판정 — IGDB ttb_*(초) 우선, 없으면 story_length 문구.
// 혼자 하기 가능: 빠르게 ≤ 보통 ≤ 전부 순서가 맞으면 세 값, 어긋나면 "보통"만.
// 멀티 전용(solo_mode none): "함께 클리어까지 N시간"(보통 값만)
export type PlayTimeGame = {
  solo_mode?: string | null;
  story_length?: string | null;
  ttb_hastily?: number | null;
  ttb_normally?: number | null;
  ttb_completely?: number | null;
};
export type PlayTime =
  | { label: string; kind: 'hours'; normally: number; hastily?: number; completely?: number }
  | { label: string; kind: 'text'; text: string };

export function playTime(g: PlayTimeGame): PlayTime | null {
  const multiOnly = g.solo_mode === 'none';
  const label = multiOnly ? '함께 클리어까지' : '플레이 시간';
  const normally = g.ttb_normally ?? 0;
  if (normally > 0) {
    if (multiOnly) return { label, kind: 'hours', normally };
    const ordered = (!g.ttb_hastily || g.ttb_hastily <= normally) && (!g.ttb_completely || g.ttb_completely >= normally);
    return ordered
      ? { label, kind: 'hours', normally, hastily: g.ttb_hastily || undefined, completely: g.ttb_completely || undefined }
      : { label, kind: 'hours', normally };
  }
  if (g.story_length) return { label, kind: 'text', text: g.story_length };
  return null;
}

export const hoursText = (sec: number) => `${Math.max(1, Math.round(sec / 3600)).toLocaleString('ko-KR')}시간`;
