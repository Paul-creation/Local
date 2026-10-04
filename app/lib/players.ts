// 인원 표시 공통 규칙 (서버·브라우저 어디서나 쓰는 순수 함수)
// 공개 서버·대규모 로비 게임은 DB에 실제 숫자(예: 30, 64, 120)를 저장하고, 화면에는 "16명+"로 보여준다
export const LARGE_LOBBY = 16;

export function playersText(g: { min_players?: number | null; max_players?: number | null }) {
  if (!g.min_players || !g.max_players) return '';
  if (g.max_players > LARGE_LOBBY) return `${LARGE_LOBBY}명+`;
  return g.min_players === g.max_players ? `${g.min_players}인` : `${g.min_players}-${g.max_players}인`;
}
