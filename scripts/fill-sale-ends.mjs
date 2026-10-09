// scripts/fill-sale-ends.mjs
// 할인 중인 게임의 종료 시각을 price_history.sale_ends_at에 저장 (ITAD prices/v3, 200개씩 묶어 요청)
// 모르면 null, 할인이 끝났거나 아니면 비움. ITAD 오류면 기존 값 유지. 매일 갱신(daily)에서 가격 기록 뒤에 실행
import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'node:url';
import { getSteamDeals } from './lib/itad.mjs';
import { processSaleEnds } from './lib/sale-ends.mjs';
import { onlyIds } from './lib/only-ids.mjs';

async function main() {
  if (!process.env.ITAD_API_KEY) return console.error('.env.local에 ITAD_API_KEY가 없어요');
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: games, error } = await onlyIds(supabase
    .from('games')
    .select('id, name, itad_id, price_history(id, price, discount_percent, checked_at, sale_ends_at)')).eq('hidden', false)
    .not('steam_appid', 'is', null);
  if (error) {
    if (/sale_ends_at/.test(error.message)) return console.log('price_history.sale_ends_at 칸이 아직 없어요 — supabase/migrations/20261019090000_sale_ends_at.sql을 먼저 실행하세요 (이번엔 건너뜀)');
    console.error('조회 실패:', error.message);
    process.exit(1);
  }
  const r = await processSaleEnds({ supabase, games, getDeals: getSteamDeals });
  console.log(`완료 — 종료일 저장 ${r.set}개 · 비움 ${r.cleared}개 · 변동 없음 ${r.kept}개 · 종료 시각 모름 ${r.noInfo}개 · 가격 불일치로 건너뜀 ${r.mismatch}개 · ITAD 응답 없음으로 유지 ${r.heldEmpty}개`);
  console.log(`ITAD 요청 ${r.requests}번 · 오류 ${r.errors}번`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
