// 담당: 친구(검색·태그·비교)
// 인원·가격 범위 슬라이더의 눈금·판정·주소 규칙 (메인 검색 필터와 /games 주소 변환이 같이 쓴다)
// 슬라이더 값은 눈금 번호로 다룬다. 인원: 0(상관없음)·1~15·16(16명+) / 가격: 0(무료)·1~9(5,000원 단위)·10(50,000원+)
import { LARGE_LOBBY } from './players';
import { getPriceInfo } from './price';

export type Range = [number, number];

export const PLAYERS_MAX = LARGE_LOBBY;
export const PLAYERS_ALL: Range = [0, PLAYERS_MAX];
export const PRICE_STEP = 5000;
export const PRICE_MAX = 10;
export const PRICE_ALL: Range = [0, PRICE_MAX];
export const FREE_ONLY: Range = [0, 0];

export const isAll = (r: Range, all: Range) => r[0] === all[0] && r[1] === all[1];

export const playersLabel = (i: number) => (i <= 0 ? '상관없음' : i >= PLAYERS_MAX ? `${PLAYERS_MAX}명+` : `${i}명`);
export const priceLabel = (i: number) =>
  i <= 0 ? '무료' : i >= PRICE_MAX ? `${(PRICE_MAX * PRICE_STEP).toLocaleString('ko-KR')}원+` : `${(i * PRICE_STEP).toLocaleString('ko-KR')}원`;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// "2-7" 또는 "5"(5~5로 해석) → 눈금. 잘못된 값이면 null
function parsePair(v: string | null) {
  const m = /^(\d+)(?:-(\d+))?$/.exec(v || '');
  if (!m) return null;
  const a = Number(m[1]);
  const b = m[2] == null ? a : Number(m[2]);
  return a <= b ? [a, b] : [b, a];
}

// players=2-7 · players=5 (커뮤니티 연결 카드 등 예전 주소) / 오른쪽 손잡이는 1명 이상
export function parsePlayers(v: string | null): Range {
  const p = parsePair(v);
  if (!p) return PLAYERS_ALL;
  const hi = clamp(p[1], 1, PLAYERS_MAX);
  return [clamp(p[0], 0, hi), hi];
}

// 예전 인원 칸 주소(?p=3-4인 등)를 그때와 비슷한 범위로
const LEGACY_PLAYERS: Record<string, Range> = {
  '1인': [1, 1], '2인': [2, 2], '3-4인': [0, 3], '5인 이상': [0, 5], '16명 이상': [0, PLAYERS_MAX],
};
export const legacyPlayers = (p: string | null): Range => LEGACY_PLAYERS[p || ''] || PLAYERS_ALL;

// price=0-30000 (원 단위) → 5,000원 눈금
export function parsePrice(v: string | null): Range {
  const p = parsePair(v);
  if (!p) return PRICE_ALL;
  return [clamp(Math.round(p[0] / PRICE_STEP), 0, PRICE_MAX), clamp(Math.round(p[1] / PRICE_STEP), 0, PRICE_MAX)];
}

export const formatPlayers = (r: Range) => (isAll(r, PLAYERS_ALL) ? '' : `${r[0]}-${r[1]}`);
export const formatPrice = (r: Range) => (isAll(r, PRICE_ALL) ? '' : `${r[0] * PRICE_STEP}-${r[1] * PRICE_STEP}`);

// L명부터 H명까지 전부 가능한 게임: 최소 인원 ≤ L(상관없음이면 조건 없음), 최대 인원 ≥ H(16명+면 16 이상)
// 범위를 하나라도 움직이면 인원 정보가 없는 게임은 뺀다
export function matchesPlayers(g: { min_players?: number | null; max_players?: number | null }, r: Range) {
  if (isAll(r, PLAYERS_ALL)) return true;
  if (!g.min_players || !g.max_players) return false;
  return (r[0] === 0 || g.min_players <= r[0]) && g.max_players >= r[1];
}

// 가격 판정에 쓰는 칸 (메인 목록은 price_final, 그 밖은 price_history — getPriceInfo가 둘 다 읽는다)
type PricedGame = { is_free?: boolean | null } & Parameters<typeof getPriceInfo>[0];

// 지금 실제로 내는 가격 (할인 중이면 할인가). 무료 게임은 0, 가격을 모르면 null
export function currentPrice(g: PricedGame) {
  if (g.is_free) return 0;
  return getPriceInfo(g)?.final ?? null;
}

export function matchesPrice(g: PricedGame, r: Range) {
  if (isAll(r, PRICE_ALL)) return true;
  const price = currentPrice(g);
  if (price == null) return false;
  return price >= r[0] * PRICE_STEP && (r[1] >= PRICE_MAX || price <= r[1] * PRICE_STEP);
}
