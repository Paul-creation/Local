import { createClient } from '@supabase/supabase-js';
import { onlyIds, ONLY_IDS } from './lib/only-ids.mjs';
import { buildReviewUpdate } from './lib/review-fill.mjs';
import { recordReviewCheck } from './lib/review-check.mjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getCurrentPlayers(appid) {
  try {
    const res = await fetch(
      `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appid}`
    );
    const json = await res.json();
    return json.response?.player_count ?? null;
  } catch { return null; }
}

async function getReviewSummary(appid) {
  try {
    const res = await fetch(
      `https://store.steampowered.com/appreviews/${appid}?json=1&filter=summary&language=all&purchase_type=all&review_type=all`
    );
    const json = await res.json();
    return json.query_summary ?? null;
  } catch { return null; }
}

async function main() {
  const { data: games } = await onlyIds(supabase.from('games').select('id, name, steam_appid, review_summary')).eq('hidden', false).not('steam_appid', 'is', null);
  if (!games) return;

  let reviewFailed = 0;
  for (const game of games) {
    const [currentPlayers, reviews] = await Promise.all([
      getCurrentPlayers(game.steam_appid),
      getReviewSummary(game.steam_appid),
    ]);

    const update = {};

    if (currentPlayers !== null) update.current_players = currentPlayers;
    Object.assign(update, buildReviewUpdate(game, reviews)); // 조회 실패면 빈 객체, 리뷰 문구는 빈 게임만 채움
    if (update.review_total === undefined) reviewFailed++;

    // peak_players(역대 최고 동접)는 enrich-itad-heat가 ITAD 값으로만 채움 (SteamSpy peak_ccu는 하루 피크라 쓰지 않음)

    if (Object.keys(update).length > 0) {
      await supabase.from('games').update(update).eq('id', game.id);
    }

    // player_history에도 기록 (날짜별 그래프용)
    if (currentPlayers !== null) {
      await supabase.from('player_history').insert({
        game_id: game.id,
        player_count: currentPlayers,
      });
    }

    console.log(
      `${game.name}: 현재 ${currentPlayers?.toLocaleString() ?? '?'}명 | 리뷰 ${update.review_positive_percent ?? '?'}% (${update.review_total?.toLocaleString() ?? '?'}개)`
    );

    await new Promise((r) => setTimeout(r, 800));
  }

  // 일일 요약용 (--ids로 일부만 돌린 때는 매일 기록을 덮어쓰지 않음)
  if (!ONLY_IDS) recordReviewCheck({ checked: games.length, failed: reviewFailed });
}

main();
