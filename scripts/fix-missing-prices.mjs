// scripts/fix-missing-prices.mjs
// 스팀 유료 게임의 "현재 가격"을 매일 확인해서, 지난 기록과 달라졌을 때만 한 줄 추가
// (기존 기록은 절대 지우지 않음 → 할인 전적이 계속 쌓임)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { data: games, error } = await supabase
    .from('games')
    .select('id, name, steam_appid, is_free, price_history(price, discount_percent, checked_at)')
    .not('steam_appid', 'is', null);
  if (error) return console.error('조회 실패:', error.message);

  let added = 0, same = 0, none = 0;
  for (const game of games) {
    if (game.is_free) continue;

    let po = null;
    try {
      const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${game.steam_appid}&cc=kr&filters=price_overview`);
      const json = await res.json();
      po = json?.[game.steam_appid]?.data?.price_overview || null;
    } catch {}

    if (!po || po.currency !== 'KRW') {
      none++;
      await sleep(700);
      continue;
    }

    const price = po.final / 100;
    const discount = po.discount_percent || 0;
    const latest = (game.price_history || [])
      .filter((p) => p.price >= 100 && p.checked_at)
      .sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime())[0];

    if (!latest || latest.price !== price || latest.discount_percent !== discount) {
      await supabase.from('price_history').insert({ game_id: game.id, price, discount_percent: discount, currency: 'KRW' });
      console.log(`✅ ${game.name}: ₩${price.toLocaleString('ko-KR')} (할인 ${discount}%)`);
      added++;
    } else {
      same++;
    }
    await sleep(700);
  }
  console.log(`\n완료 — 가격 변동 기록 ${added}개 · 변동 없음 ${same}개 · 가격 정보 없음 ${none}개`);
}

main();
