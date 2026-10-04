// scripts/fix-missing-prices.mjs
// 스팀 유료 게임의 "현재 가격"을 매일 확인해서, 지난 기록과 달라졌을 때만 한 줄 추가
// (기존 기록은 절대 지우지 않음 → 할인 전적이 계속 쌓임)
// - 가격만 받을 때는 appdetails에 앱 번호 50개를 한 번에 물어볼 수 있어서 요청이 게임 수의 1/50 (요청 제한에 안 걸림)
// - 가격을 못 받은 게임은 이유와 함께 출력하고 games.price_check_*에 표시 → daily-summary가 3일 연속 실패를 알림
import { createClient } from '@supabase/supabase-js';
import { steamGet } from './lib/steam.mjs';
import { markPriceStatus, recordPriceCheck } from './lib/price-check.mjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const BATCH = 50;

async function main() {
  const { data: games, error } = await supabase
    .from('games')
    .select('id, name, steam_appid, is_free, price_history(price, discount_percent, checked_at)')
    .not('steam_appid', 'is', null);
  if (error) {
    console.error('조회 실패:', error.message);
    process.exit(1);
  }

  const paid = games.filter((g) => !g.is_free);
  let added = 0, same = 0;
  const okIds = [];
  const failed = [];
  for (let i = 0; i < paid.length; i += BATCH) {
    const batch = paid.slice(i, i + BATCH);
    let json = null;
    let batchError = null;
    try {
      json = await steamGet(`https://store.steampowered.com/api/appdetails?appids=${batch.map((g) => g.steam_appid).join(',')}&cc=kr&filters=price_overview`);
    } catch (e) {
      batchError = `요청 실패 (${e.message})`;
    }

    for (const game of batch) {
      const entry = json?.[game.steam_appid];
      const po = entry?.data?.price_overview;
      const note = batchError
        ?? (!entry?.success ? '상점 정보 없음 (앱 번호 오류·지역 제한·삭제)'
          : !po ? '가격 없음 (판매 중단·묶음 전용·무료 전환)'
          : po.currency !== 'KRW' ? `원화 아님 (${po.currency})` : null);
      if (note) {
        failed.push({ id: game.id, name: game.name, appid: game.steam_appid, note });
        continue;
      }
      okIds.push(game.id);

      const price = po.final / 100;
      const discount = po.discount_percent || 0;
      const latest = (game.price_history || [])
        .filter((p) => p.price >= 100 && p.checked_at)
        .sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime())[0];

      if (!latest || latest.price !== price || latest.discount_percent !== discount) {
        const { error: insErr } = await supabase.from('price_history').insert({ game_id: game.id, price, discount_percent: discount, currency: 'KRW' });
        if (insErr) {
          console.error(`저장 실패 (${game.name}):`, insErr.message);
          continue;
        }
        console.log(`✅ ${game.name}: ₩${price.toLocaleString('ko-KR')} (할인 ${discount}%)`);
        added++;
      } else {
        same++;
      }
    }
  }

  await markPriceStatus(supabase, { okIds, failed });
  recordPriceCheck('steam', { checked: paid.length, failed: failed.length });

  console.log(`\n완료 — 가격 변동 기록 ${added}개 · 변동 없음 ${same}개`);
  console.log(`가격을 못 받은 게임 ${failed.length}개 (스팀 유료 ${paid.length}개 중)`);
  for (const f of failed) console.log(`   - ${f.name} (${f.appid}): ${f.note}`);
}

main();
