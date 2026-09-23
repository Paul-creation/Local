// scripts/test-lowest.mjs
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ITAD_KEY = process.env.ITAD_API_KEY;

async function main() {
  // Rust로 테스트
  const appid = '252490';

  const lookupRes = await fetch(
    `https://api.isthereanydeal.com/games/lookup/v1?key=${ITAD_KEY}&appid=${appid}`
  );
  const lookup = await lookupRes.json();
  console.log('lookup:', JSON.stringify(lookup));
  if (!lookup.found) return;

  const histRes = await fetch(
    `https://api.isthereanydeal.com/games/history/v2?key=${ITAD_KEY}&id=${lookup.game.id}&country=KR`
  );
  const hist = await histRes.json();
  console.log('전체 기록 수:', hist.length);
  console.log('샵 목록:', [...new Set(hist.map(h => h.shop?.name))]);
  const steamOnly = hist.filter(h => h.shop?.name === 'Steam');
  console.log('Steam 기록 수:', steamOnly.length);
  if (steamOnly.length > 0) {
    console.log('최저:', steamOnly.reduce((min, h) => h.deal.price.amount < min.deal.price.amount ? h : min));
  }
}

main();