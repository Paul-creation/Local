// scripts/backfill-price-history-other.mjs
// 스팀 외 유료 게임(에픽·블리자드)의 할인 기록을 ITAD에서 가져오기 — 이미 있는 기록은 건너뛰고 새 기록만 추가
// 한 번 찾은 ITAD ID는 games.itad_id에 저장해서 다음부터는 lookup을 건너뜀
import { createClient } from '@supabase/supabase-js';
import { lookupItadId, getPriceHistory, ItadLimitError } from './lib/itad.mjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const MAX_RECORDS_PER_GAME = 60;

const minuteKey = (t) => new Date(t).toISOString().slice(0, 16);

const SHOP_MATCH = {
  epic: /epic/i,
  battlenet: /blizzard|battle\.net/i,
  riot: /riot/i,
};

async function main() {
  if (!process.env.ITAD_API_KEY) return console.error('.env.local에 ITAD_API_KEY가 없어요');

  const { data: games, error } = await supabase
    .from('games')
    .select('id, name, source, external_id, is_free, itad_id, price_history(price, checked_at)')
    .is('steam_appid', null);
  if (error) return console.error('조회 실패:', error.message);

  let saved = 0;
  let notFound = 0;
  let limited = 0;
  let failed = 0;
  for (const game of games) {
    if (game.is_free) {
      console.log(`건너뜀 (무료): ${game.name}`);
      continue;
    }

    try {
      let itadId = game.itad_id;
      if (!itadId) {
        itadId = await lookupItadId({ title: game.name });
        if (!itadId && game.external_id) itadId = await lookupItadId({ title: game.external_id.replace(/-/g, ' ') });
        if (!itadId) {
          console.log(`❌ ITAD 매칭 실패: ${game.name}`);
          notFound++;
          continue;
        }
        await supabase.from('games').update({ itad_id: itadId }).eq('id', game.id).is('itad_id', null);
      }

      const history = await getPriceHistory(itadId);
      const shopRe = SHOP_MATCH[game.source];
      const records = history
        .filter((h) => shopRe?.test(h.shop?.name || '') && h.deal?.price?.amount >= 100)
        .slice(0, MAX_RECORDS_PER_GAME);

      if (records.length === 0) {
        const shops = [...new Set(history.map((h) => h.shop?.name).filter(Boolean))].join(', ');
        console.log(`기록 없음: ${game.name}${shops ? ` (ITAD에 있는 상점: ${shops})` : ''}`);
        continue;
      }

      const existing = new Set(
        (game.price_history || []).filter((p) => p.checked_at).map((p) => minuteKey(p.checked_at))
      );
      const rows = records
        .filter((h) => !existing.has(minuteKey(h.timestamp)))
        .map((h) => ({
          game_id: game.id,
          price: h.deal.price.amount,
          discount_percent: h.deal.cut,
          checked_at: h.timestamp,
        }));

      if (rows.length === 0) {
        console.log(`건너뜀 (새 기록 없음): ${game.name}`);
        continue;
      }

      const { error: insErr } = await supabase.from('price_history').insert(rows);
      if (insErr) {
        console.error(`저장 실패 (${game.name}):`, insErr.message);
        failed++;
        continue;
      }

      const all = [...(game.price_history || []).filter((p) => p.price >= 100), ...rows];
      const lowest = all.reduce((a, b) => (b.price < a.price ? b : a));
      await supabase
        .from('games')
        .update({ lowest_price: lowest.price, lowest_price_date: lowest.checked_at })
        .eq('id', game.id);

      console.log(`✅ ${game.name}: ${records[0].shop.name} 새 기록 ${rows.length}개 · 최저 ₩${lowest.price.toLocaleString('ko-KR')}`);
      saved++;
    } catch (e) {
      if (e instanceof ItadLimitError) {
        console.log(`⏳ 요청 제한 (3번 재시도 후 실패): ${game.name} — ${e.message}`);
        limited++;
      } else {
        console.log(`⚠️ ITAD 오류: ${game.name} — ${e.message}`);
        failed++;
      }
    }
  }

  console.log(`\n완료 — ${saved}개 게임 할인 기록 저장`);
  console.log(`매칭 실패 ${notFound}개 · 요청 제한 ${limited}개 · 기타 오류 ${failed}개`);
}

main();
