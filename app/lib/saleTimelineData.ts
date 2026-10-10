// 이번 주 할인 마감 페이지 데이터 — 2단계로 가져온다
// 1) price_history에서 종료 시각이 지금~168시간 안인 행의 game_id만 뽑는다 (옛 행도 섞일 수 있음)
// 2) 그 게임들의 "최신 가격 1행"을 다시 받아 같은 조건으로 한 번 더 거른다 → 옛 행 때문에 끝난 할인이 섞이지 않는다
import { supabase } from './supabase';
import { selectHomeGames } from './visibleGames';
import { flattenGame, getPriceInfo } from './price';
import { playersText } from './players';
import { endsWithinWindow, WINDOW_MS } from './saleTimeline';

export type TimelineGame = {
  id: string; name: string; image: string | null; players: string;
  discount: number; final: number; original: number | null; endsAt: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 게임 칸은 목록과 같은 느슨한 모양
export function toTimelineGame(game: any, now: number): TimelineGame | null {
  const price = getPriceInfo(game);
  if (!price || game.is_free || !price.saleEndsAt) return null;
  if (!endsWithinWindow(price.discount, price.saleEndsAt, now)) return null;
  return {
    id: game.id, name: game.name,
    image: game.cover_image_url || game.card_image_url || null,
    players: playersText(game),
    discount: price.discount, final: price.final, original: price.original, endsAt: price.saleEndsAt,
  };
}

// 서버가 계산한 시각(now)도 같이 돌려줘서 화면이 첫 그림에 같은 시각을 쓴다
export async function getSaleTimeline(): Promise<{ items: TimelineGame[]; now: number }> {
  const now = Date.now();
  const { data: rows } = await supabase
    .from('price_history')
    .select('game_id')
    .gte('sale_ends_at', new Date(now).toISOString())
    .lte('sale_ends_at', new Date(now + WINDOW_MS).toISOString())
    .limit(1000);
  const ids = [...new Set(((rows || []) as { game_id: string }[]).map((r) => r.game_id))];
  if (ids.length === 0) return { items: [], now };
  const { data: games } = await selectHomeGames(
    'id, name, min_players, max_players, is_free, price_type, card_image_url, cover_image_url, price_history(price, discount_percent, checked_at, currency, original_price, sale_ends_at)',
  )
    .in('id', ids)
    .gte('price_history.price', 100)
    .order('checked_at', { referencedTable: 'price_history', ascending: false })
    .limit(1, { referencedTable: 'price_history' });
  const items = ((games as Record<string, unknown>[]) || [])
    .map((g) => toTimelineGame(flattenGame(g), now))
    .filter((g): g is TimelineGame => g != null);
  return { items, now };
}
