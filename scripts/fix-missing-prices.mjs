// scripts/fix-missing-prices.mjs
// 스팀 유료 게임의 "현재 가격"을 매일 확인해서, 지난 기록과 달라졌을 때만 한 줄 추가
// (기존 기록은 절대 지우지 않음 → 할인 전적이 계속 쌓임)
// - 스팀이 주는 정가(price_overview.initial)도 original_price에 저장. 가격이 그대로여도 최신 행의 original_price가 비어 있으면 그 칸만 채움 (이미 있는 값은 덮어쓰지 않음)
// - 가격만 받을 때는 appdetails에 앱 번호 50개를 한 번에 물어볼 수 있어서 요청이 게임 수의 1/50 (요청 제한에 안 걸림)
// - 가격 유형이 있는 게임(월 구독 등)은 건너뜀. 가격을 못 받은 게임은 이유와 함께 출력하고 games.price_check_*에 표시 → daily-summary가 3일 연속 실패를 알림
// - 스팀 요청 제한: 배치 하나는 lib/steam.mjs가 30→60→120초 기다리며 3번 다시 시도. 그래도 안 된 배치가 3번 연속이면 거기서 멈추고
//   남은 게임은 "실패"로 기록하지 않음 (price_check_failed_since·note를 안 건드림 → 3일 연속 실패 알림에 안 쌓임). 다음 실행 때 다시 시도
import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'node:url';
import { steamGet, SteamLimitError } from './lib/steam.mjs';
import { onlyIds } from './lib/only-ids.mjs';
import { markPriceStatus, noPriceIds, recordPriceCheck } from './lib/price-check.mjs';

export const BATCH = 50;
// 요청 제한이 이만큼 연달아 풀리지 않으면 남은 배치는 시도하지 않고 멈춤 (막힌 상태로 계속 두드리지 않음. 배치당 최악 약 3.6분)
export const MAX_CONSECUTIVE_LIMITED = 3;

// 스팀 정가(initial, 100배 값) → 원. 최종가보다 작거나 100원 미만이면 믿지 않고 null
const originalOf = (initial, final) => {
  const v = Number(initial) / 100;
  return Number.isFinite(v) && v >= 100 && v >= final ? v : null;
};

// 유료 게임 목록을 배치로 나눠 가격을 확인하고 저장한다. supabase·getBatch(배치 → appdetails JSON)를 받아서 테스트에서 가짜로 바꿔 끼울 수 있음
// 반환: { added, same, filled, okIds, failed, unprocessed } — unprocessed: 요청 제한으로 확인하지 못한 게임 수 (실패로 세지 않음)
export async function processPrices({ supabase, paid, getBatch, log = console.log }) {
  let added = 0, same = 0, filled = 0, unprocessed = 0, streak = 0;
  const okIds = [];
  const failed = [];
  for (let i = 0; i < paid.length; i += BATCH) {
    const batch = paid.slice(i, i + BATCH);
    let json = null;
    let batchError = null;
    try {
      json = await getBatch(batch);
      streak = 0;
    } catch (e) {
      if (e instanceof SteamLimitError) {
        // 실패로 기록하지 않고(failed에 안 넣음) 다음 실행에서 다시 시도
        streak++;
        unprocessed += batch.length;
        log(`⏳ 스팀 요청 제한: 배치 ${i / BATCH + 1} (게임 ${batch.length}개) — ${e.message} · 실패로 기록하지 않고 다음 실행에서 다시 시도`);
        if (streak >= MAX_CONSECUTIVE_LIMITED) {
          const rest = Math.max(0, paid.length - (i + BATCH));
          unprocessed += rest;
          log(`⛔ 요청 제한이 배치 ${streak}번 연속 풀리지 않아 여기서 멈춤 — 남은 ${rest}개는 시도하지 않음 (다음 실행에서 다시 시도)`);
          break;
        }
        continue;
      }
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
      const original = originalOf(po.initial, price);
      const latest = (game.price_history || [])
        .filter((p) => p.price >= 100 && p.checked_at)
        .sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime())[0];

      if (!latest || latest.price !== price || latest.discount_percent !== discount) {
        const { error: insErr } = await supabase.from('price_history').insert({ game_id: game.id, price, discount_percent: discount, currency: 'KRW', original_price: original });
        if (insErr) {
          console.error(`저장 실패 (${game.name}):`, insErr.message);
          continue;
        }
        console.log(`✅ ${game.name}: ₩${price.toLocaleString('ko-KR')} (할인 ${discount}%)`);
        added++;
      } else {
        same++;
        // 변동이 없어도 최신 행에 정가가 비어 있으면 그 칸만 채움 (is null 조건이라 이미 있는 값은 안 건드림)
        if (original != null && latest.original_price == null) {
          const { data: done, error: updErr } = await supabase.from('price_history').update({ original_price: original }).eq('id', latest.id).is('original_price', null).select('id');
          if (updErr) console.error(`정가 저장 실패 (${game.name}):`, updErr.message);
          else if (done?.length) filled++;
        }
      }
    }
  }

  return { added, same, filled, okIds, failed, unprocessed };
}

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: games, error } = await onlyIds(supabase
    .from('games')
    .select('id, name, steam_appid, is_free, price_history(id, price, discount_percent, checked_at, original_price)')).eq('hidden', false)
    .not('steam_appid', 'is', null);
  if (error) {
    console.error('조회 실패:', error.message);
    process.exit(1);
  }

  const skip = await noPriceIds(supabase);
  const paid = games.filter((g) => !g.is_free && !skip.has(g.id));
  // 빈 객체·null 같은 빈 응답은 요청 제한일 수 있어 다시 시도 (그대로 두면 50개 전부 "상점 정보 없음" 실패로 기록됨)
  const getBatch = (batch) => steamGet(`https://store.steampowered.com/api/appdetails?appids=${batch.map((g) => g.steam_appid).join(',')}&cc=kr&filters=price_overview`, {
    retryIf: (j) => !j || typeof j !== 'object' || Object.keys(j).length === 0,
  });
  const { added, same, filled, okIds, failed, unprocessed } = await processPrices({ supabase, paid, getBatch });

  await markPriceStatus(supabase, { okIds, failed });
  recordPriceCheck('steam', { checked: paid.length - unprocessed, failed: failed.length, ...(unprocessed ? { unprocessed } : {}) });

  console.log(`\n완료 — 가격 변동 기록 ${added}개 · 변동 없음 ${same}개 · 정가 채움 ${filled}개`);
  console.log(`가격을 못 받은 게임 ${failed.length}개 (스팀 유료 ${paid.length}개 중)`);
  if (unprocessed) console.log(`요청 제한으로 미처리 ${unprocessed}개 — 실패로 기록하지 않았고 다음 실행에서 다시 시도`);
  for (const f of failed) console.log(`   - ${f.name} (${f.appid}): ${f.note}`);
}

// 직접 실행했을 때만 돌림 (테스트가 processPrices만 불러 쓸 수 있게)
if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
