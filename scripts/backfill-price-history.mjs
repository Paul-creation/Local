// scripts/backfill-price-history.mjs
// 스팀 게임 할인 기록을 ITAD(Steam KRW)에서 가져오기 — 이미 있는 기록은 건너뛰고 새 기록만 추가
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const ITAD_KEY = process.env.ITAD_API_KEY;
const MAX_RECORDS_PER_GAME = 30;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const minuteKey = (t) => new Date(t).toISOString().slice(0, 16);

async function getItadId(steamAppid) {
  try {
    const res = await fetch(
      `https://api.isthereanydeal.com/games/lookup/v1?key=${ITAD_KEY}&appid=${steamAppid}`
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
    .select('id, name, steam_appid, is_free, price_history(price, checked_at)')
    .not('steam_appid', 'is', null);
  if (error) return console.error('조회 실패:', error.message);

  console.log(`스팀 게임 ${games.length}개 확인 시작\n`);
  let added = 0;
  let touched = 0;

  for (const game of games) {
    if (game.is_free) continue;

    const itadId = await getItadId(game.steam_appid);
    if (!itadId) {
      console.log(`❌ ITAD 매칭 실패: ${game.name}`);
      await sleep(400);
      continue;
    }

    const history = await getPriceHistory(itadId);
    const steamKrw = history
      .filter((h) => h.shop?.name === 'Steam' && h.deal?.price?.amount >= 100)
      .slice(0, MAX_RECORDS_PER_GAME);

    if (steamKrw.length === 0) {
      console.log(`기록 없음: ${game.name}`);
      await sleep(400);
      continue;
    }

    const existing = new Set(
      (game.price_history || []).filter((p) => p.checked_at).map((p) => minuteKey(p.checked_at))
    );
    const rows = steamKrw
      .filter((h) => !existing.has(minuteKey(h.timestamp)))
      .map((h) => ({
        game_id: game.id,
        price: h.deal.price.amount,
        discount_percent: h.deal.cut,
        checked_at: h.timestamp,
      }));

    if ((game.price_history || []).some((p) => p.price < 100)) {
      await supabase.from('price_history').delete().eq('game_id', game.id).lt('price', 100);
    }

    if (rows.length > 0) {
      const { error: insErr } = await supabase.from('price_history').insert(rows);
      if (insErr) {
        console.error(`저장 실패 (${game.name}):`, insErr.message);
        continue;
      }
    }

    const all = [
      ...(game.price_history || []).filter((p) => p.price >= 100),
      ...rows,
    ];
    const lowest = all.reduce((a, b) => (b.price < a.price ? b : a));
    await supabase
      .from('games')
      .update({ lowest_price: lowest.price, lowest_price_date: lowest.checked_at })
      .eq('id', game.id);

    if (rows.length > 0) {
      console.log(`✅ ${game.name}: 새 기록 ${rows.length}개 · 최저 ₩${lowest.price.toLocaleString('ko-KR')}`);
      added += rows.length;
      touched++;
    }
    await sleep(800);
  }

  console.log(`\n완료 — ${touched}개 게임에 새 할인 기록 ${added}개 추가`);
}

main();
