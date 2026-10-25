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

  // 리뷰 주 경로: GetItems(100개씩 묶음, 한 번에 약 15초). 값이 없는 게임만 appreviews → 상점 페이지 순으로 대체
  const viaItems = await fetchGetItemsReviews(games.map((g) => g.steam_appid));
  console.log(`GetItems 리뷰 ${viaItems.size}/${games.length}개`);
  const done = { getitems: 0, appreviews: 0, store_page: 0 };

  for (const game of games) {
    const currentPlayers = await getCurrentPlayers(game.steam_appid);

    const update = {};

    if (currentPlayers !== null) update.current_players = currentPlayers;
    let source = 'getitems';
    let review = buildReviewUpdate(game, viaItems.get(String(game.steam_appid)), { source, hasSource });
    if (review.review_total === undefined) {
      source = 'appreviews';
      review = buildReviewUpdate(game, await getReviewSummary(game.steam_appid), { source, hasSource });
    }
    if (review.review_total === undefined) {
      source = 'store_page';
      review = buildReviewUpdate(game, await fetchStoreReviews(game.steam_appid), { source, hasSource });
    }
    if (review.review_total !== undefined) { Object.assign(update, review); done[source]++; } // 세 경로 모두 실패면 기존 값 유지(실패로 셈)
    else console.log(`${game.name}: 리뷰 값을 못 받음 — 기존 값 유지`);

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
      `${game.name}: 현재 ${currentPlayers?.toLocaleString() ?? '?'}명 | 리뷰 ${update.review_positive_percent ?? '?'}% (${update.review_total?.toLocaleString() ?? '?'}개)${update.review_total !== undefined ? ` ← ${source}` : ''}`
    );

    await new Promise((r) => setTimeout(r, 800));
  }

  // 일일 요약용 (--ids로 일부만 돌린 때는 매일 기록을 덮어쓰지 않음)
  if (!ONLY_IDS) recordReviewCheck({ checked: games.length, viaGetItems: done.getitems, viaAppreviews: done.appreviews, viaStore: done.store_page });
  console.log(`리뷰 갱신 ${done.getitems + done.appreviews + done.store_page}/${games.length}개 (GetItems ${done.getitems} · appreviews ${done.appreviews} · 상점 페이지 ${done.store_page})`);
}

main();
