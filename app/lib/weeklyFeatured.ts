// 담당: Paul(메인 배너·디자인)
// 메인 "이번주의 게임" — featured_games의 가장 최근 주 게임 1개만 메인 select와 따로 가져온다
// 선정은 scripts/pick-weekly-featured.mjs가 매주 (week_start = 그 주 금요일, 한국 시간)
import { supabase } from './supabase';

// "2026-10-02" → "10월 1주차" (그 주 금요일이 그 달의 몇 번째 금요일인지)
export function weekLabel(weekStart: string) {
  const [, m, d] = weekStart.split('-').map(Number);
  return `${m}월 ${Math.ceil(d / 7)}주차`;
}

export async function getWeeklyFeatured() {
  const { data } = await supabase
    .from('featured_games')
    .select(`
      week_start,
      games(
        id, name, tags, difficulty, min_players, max_players, is_free, lowest_price,
        card_image_url, cover_image_url, description, fun_description,
        price_history(price, discount_percent, checked_at, currency)
      )
    `)
    .gte('games.price_history.price', 100)
    .order('week_start', { ascending: false })
    .order('checked_at', { referencedTable: 'games.price_history', ascending: false })
    .limit(1, { referencedTable: 'games.price_history' })
    .limit(1);
  const row = data?.[0];
  const game = row?.games as any;
  if (!game) return null;
  return { ...game, weekLabel: weekLabel(row!.week_start) };
}
