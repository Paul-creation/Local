// scripts/backfill-price-history-other.mjs
// 스팀 외 유료 게임(에픽·블리자드)의 할인 기록을 ITAD에서 가져오기
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const ITAD_KEY = process.env.ITAD_API_KEY;
const MAX_RECORDS_PER_GAME = 15;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SHOP_MATCH = {
  epic: /epic/i,
  battlenet: /blizzard|battle\.net/i,
  riot: /riot/i,
};

async function lookupByTitle(title) {
  try {
    const res = await fetch(
      `https://api.isthereanydeal.com/games/lookup/v1?key=${ITAD_KEY}&title=${encodeURIComponent(title)}`
    );
    const json = await res.json();
    return json.found ? json.game.id : null;
  } catch {
    return null;
  }
}

async function getPriceHistory(itadId) {
  try {
    const res = await fetch(
      `https://api.isthereanydeal.com/games/history/v2?key=${ITAD_KEY}&id=${itadId}&country=KR`
    );
    const json = await res.json();
    return Array.isArray(json) ? json : [];
  } catch {
    return [];
  }
}

async function main() {
  if (!ITAD_KEY) return console.error('.env.local에 ITAD_API_KEY가 없어요');

  const { data: games, error } = await supabase
    .from('games')
    .select('id, name, source, external_id, is_free, price_history(id, price)')
    .is('steam_appid', null);
  if (error) return console.error('조회 실패:', error.message);

  let saved = 0;
  for (const game of games) {
    if (game.is_free) {
      console.log(`건너뜀 (무료): ${game.name}`);
      continue;
    }

    const krwRecords = (game.price_history || []).filter((p) => p.price >= 100);
    if (krwRecords.length > 1) {
      console.log(`건너뜀 (이미 기록 있음): ${game.name}`);
      continue;
    }

    let itadId = await lookupByTitle(game.name);
    if (!itadId && game.external_id) itadId = await lookupByTitle(game.external_id.replace(/-/g, ' '));
    if (!itadId) {
      console.log(`❌ ITAD 매칭 실패: ${game.name}`);
      await sleep(500);
      continue;
    }

    const history = await getPriceHistory(itadId);
    const shopRe = SHOP_MATCH[game.source];
    const records = history
      .filter((h) => shopRe?.test(h.shop?.name || '') && h.deal?.price?.amount >= 100)
      .slice(0, MAX_RECORDS_PER_GAME);

    if (records.length === 0) {
      const shops = [...new Set(history.map((h) => h.shop?.name).filter(Boolean))].join(', ');
      console.log(`기록 없음: ${game.name}${shops ? ` (ITAD에 있는 상점: ${shops})` : ''}`);
      await sleep(500);
      continue;
    }

    const rows = records.map((h) => ({
      game_id: game.id,
      price: h.deal.price.amount,
      discount_percent: h.deal.cut,
      checked_at: h.timestamp,
    }));

    const { error: insErr } = await supabase.from('price_history').insert(rows);
    if (insErr) {
      console.error(`저장 실패 (${game.name}):`, insErr.message);
      continue;
    }

    const lowest = rows.reduce((a, b) => (b.price < a.price ? b : a));
    await supabase
      .from('games')
      .update({ lowest_price: lowest.price, lowest_price_date: lowest.checked_at })
      .eq('id', game.id);

    console.log(`✅ ${game.name}: ${records[0].shop.name} 기록 ${rows.length}개 · 최저 ₩${lowest.price.toLocaleString('ko-KR')}`);
    saved++;
    await sleep(800);
  }

  console.log(`\n완료 — ${saved}개 게임 할인 기록 저장`);
}

main();
