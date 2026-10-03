// 인원 표시 공통 규칙 (서버·브라우저 어디서나 쓰는 순수 함수)
// 공개 서버·대규모 로비 게임은 DB에 실제 숫자(예: 30, 64, 120)를 저장하고, 화면에는 "16명+"로 보여준다
export const LARGE_LOBBY = 16;

export function playersText(g: { min_players?: number | null; max_players?: number | null }) {
  if (!g.min_players || !g.max_players) return '';
  if (g.max_players > LARGE_LOBBY) return `${LARGE_LOBBY}명+`;
  return g.min_players === g.max_players ? `${g.min_players}인` : `${g.min_players}-${g.max_players}인`;
}

// 주소의 players=5 같은 숫자를 인원 필터 칸(1인·2인·3-4인·5인 이상·16명 이상)으로 바꾼다
export function playersBucket(n: number) {
  if (!Number.isFinite(n) || n < 1) return '';
  if (n === 1) return '1인';
  if (n === 2) return '2인';
  if (n <= 4) return '3-4인';
  if (n < LARGE_LOBBY) return '5인 이상';
  return '16명 이상';
}
