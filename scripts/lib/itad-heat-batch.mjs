// scripts/lib/itad-heat-batch.mjs
// enrich-itad-heat의 배치 처리 — batchSize개씩 조회 → 최저가 → 저장을 끝내고 다음 배치로 (중간에 죽어도 앞 배치는 저장돼 있음)
// collect(game) → { update, itadId } | null(ITAD에 없음) · getLows(itadIds) → Map(itadId → low) · save(game, update, low) → 성공 여부
export async function processHeatBatches({ games, batchSize, collect, getLows, save, isLimitError, log = console.log }) {
  let saved = 0;
  let noMatch = 0;
  let failed = 0;
  let lowsCount = 0;
  let stopped = false;
  let processed = 0; // 끝까지 처리한 게임 수 (제한에 걸린 게임부터는 미처리)

  for (let start = 0; start < games.length && !stopped; start += batchSize) {
    const batch = games.slice(start, start + batchSize);
    const collected = [];
    for (const [idx, game] of batch.entries()) {
      try {
        const c = await collect(game);
        if (!c) {
          log(`데이터 없음: ${game.name}`);
          noMatch++;
        } else collected.push({ game, ...c });
      } catch (e) {
        if (isLimitError(e)) {
          log(`⏳ ${e.message}`);
          stopped = true;
          processed = start + idx;
          break;
        }
        log(`❌ 실패: ${game.name} — ${e.message}`);
        failed++;
      }
    }
    if (!stopped) processed = start + batch.length;

    let lows = new Map();
    if (collected.length > 0) {
      try {
        lows = await getLows(collected.map((c) => c.itadId));
      } catch (e) {
        log(`❌ 역대 최저가 조회 실패 (${start + 1}~${start + batch.length}번째): ${e.message}`);
        failed++;
        if (isLimitError(e)) { stopped = true; processed = start + batch.length; }
      }
    }
    lowsCount += lows.size;

    for (const { game, update, itadId } of collected) {
      const low = lows.get(itadId);
      if (low) Object.assign(update, { lowest_price: low.price, lowest_price_date: low.date, lowest_price_shop: low.shop });
      if (Object.keys(update).length === 0) continue;
      if (await save(game, update, low)) saved++;
      else failed++;
    }
    log(`── 진행 ${Math.min(start + batchSize, games.length)}/${games.length} · 저장 ${saved} · ITAD에 없음 ${noMatch} · 실패 ${failed}`);
  }
  if (stopped) log(`ITAD 요청 제한으로 중단, 처리 ${processed}/${games.length} (저장한 배치는 그대로 남음)`);
  return { saved, noMatch, failed, lowsCount, stopped, processed };
}
