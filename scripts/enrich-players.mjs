import { createClient } from '@supabase/supabase-js';
import { onlyIds, ONLY_IDS } from './lib/only-ids.mjs';
import { buildReviewUpdate } from './lib/review-fill.mjs';
import { fetchStoreReviews } from './lib/review-store.mjs';
import { fetchGetItemsReviews } from './lib/review-getitems.mjs';
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
  const cols = 'id, name, steam_appid, review_summary, review_total';
  // review_source 칸(마이그레이션 20261024120000)이 아직 없으면 그 칸 없이 돌림 — 출처는 기록 안 함
  let hasSource = true;
  let res = await onlyIds(supabase.from('games').select(`${cols}, review_source`)).eq('hidden', false).eq('release_status', 'released').not('steam_appid', 'is', null);
  if (res.error && /review_source/.test(res.error.message)) {
    hasSource = false;
    console.log('games.review_source 칸이 없음 — 리뷰 출처 기록 없이 진행 (마이그레이션 전)');
    res = await onlyIds(supabase.from('games').select(cols)).eq('hidden', false).eq('release_status', 'released').not('steam_appid', 'is', null);
  }
  const games = res.data;
  if (!games) return;

  const fallback = []; // appreviews가 실패했고 리뷰 수를 아직 모르는 게임 — 뒤에서 GetItems → 상점 페이지 순으로 채움
  for (const game of games) {
    const [currentPlayers, reviews] = await Promise.all([
      getCurrentPlayers(game.steam_appid),
      getReviewSummary(game.steam_appid),
    ]);

    const update = {};

    if (currentPlayers !== null) update.current_players = currentPlayers;
    Object.assign(update, buildReviewUpdate(game, reviews, { source: 'appreviews', hasSource })); // 조회 실패면 빈 객체
    if (update.review_total === undefined && game.review_total == null) fallback.push(game);

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

  // appreviews 실패 + review_total null인 게임만: GetItems(여러 개 묶음) → 그래도 없으면 상점 페이지 "All Reviews" 줄
  const done = { getitems: 0, store_page: 0 };
  if (fallback.length) {
    const viaItems = await fetchGetItemsReviews(fallback.map((g) => g.steam_appid));
    for (const game of fallback) {
      let qs = viaItems.get(String(game.steam_appid));
      let source = 'getitems';
      if (!qs) { qs = await fetchStoreReviews(game.steam_appid); source = 'store_page'; }
      const update = buildReviewUpdate(game, qs, { source, hasSource });
      if (update.review_total === undefined) { console.log(`${game.name}: 리뷰 대체 경로도 실패`); continue; }
      await supabase.from('games').update(update).eq('id', game.id);
      done[source]++;
      console.log(`${game.name}: 리뷰 ${update.review_positive_percent}% (${update.review_total.toLocaleString()}개) ← ${source}`);
    }
  }

  // 일일 요약용 (--ids로 일부만 돌린 때는 매일 기록을 덮어쓰지 않음)
  if (!ONLY_IDS) {
    const reviewFailed = fallback.length - done.getitems - done.store_page;
    recordReviewCheck({ checked: games.length, failed: reviewFailed, viaGetItems: done.getitems, viaStore: done.store_page });
  }
}

main();
