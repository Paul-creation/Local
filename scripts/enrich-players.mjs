import { createClient } from '@supabase/supabase-js';

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

async function getAccurateReviews(appid) {
  try {
    const res = await fetch(
      `https://store.steampowered.com/appreviews/${appid}?json=1&filter=summary&language=all&purchase_type=all&review_type=all`
    );
    const json = await res.json();
    const qs = json.query_summary;
    if (!qs) return null;
    return {
      total: qs.total_reviews,
      positive: qs.total_positive,
      percent: qs.total_reviews > 0
        ? Math.round((qs.total_positive / qs.total_reviews) * 100)
        : 0,
    };
  } catch { return null; }
}

async function main() {
  const { data: games } = await supabase.from('games').select('id, name, steam_appid').not('steam_appid', 'is', null);
  if (!games) return;

  for (const game of games) {
    const [currentPlayers, reviews] = await Promise.all([
      getCurrentPlayers(game.steam_appid),
      getAccurateReviews(game.steam_appid),
    ]);

    const update = {};

    if (currentPlayers !== null) update.current_players = currentPlayers;
    if (reviews) {
      update.review_positive_percent = reviews.percent;
      update.review_total = reviews.total;
    }

    // 역대 피크 플레이어 (SteamSpy)
    try {
      const spyRes = await fetch(
        `https://steamspy.com/api.php?request=appdetails&appid=${game.steam_appid}`
      );
      const spyJson = await spyRes.json();
      if (spyJson.peak_ccu) {
        update.peak_players = spyJson.peak_ccu;
      }
    } catch {}

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
      `${game.name}: 현재 ${currentPlayers?.toLocaleString() ?? '?'}명 | 피크 ${update.peak_players?.toLocaleString() ?? '?'}명 | 리뷰 ${reviews?.percent ?? '?'}% (${reviews?.total?.toLocaleString() ?? '?'}개)`
    );

    await new Promise((r) => setTimeout(r, 800));
  }
}

main();