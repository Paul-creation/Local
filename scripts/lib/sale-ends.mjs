// scripts/lib/sale-ends.mjs
// 할인 종료 시각(price_history.sale_ends_at) 채우기 — ITAD prices/v3의 스팀 딜 expiry를 그대로 저장
// - 최신 가격 행이 할인 중일 때만 값을 둔다. 종료일을 모르면 null (추정하지 않음)
// - 할인이 끝났거나(ITAD 스팀 딜 없음·종료 시각이 지남) 할인 중이 아니면 null로 비운다
// - ITAD 오류·가격이 안 맞아 확인이 안 되면 기존 값을 그대로 둔다 (지우지 않음)
export const ITAD_BATCH = 200;
const STEAM_SHOP_ID = 61;

const latestOf = (history) =>
  (history || [])
    .filter((p) => p.price >= 100 && p.checked_at)
    .sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime())[0] || null;

// 반환: { set, cleared, kept, noInfo, mismatch, errors, requests }
export async function processSaleEnds({ supabase, games, getDeals, now = Date.now(), log = console.log }) {
  const r = { set: 0, cleared: 0, kept: 0, noInfo: 0, mismatch: 0, errors: 0, requests: 0 };
  const clearIds = [];
  const targets = []; // 최신 행이 할인 중인 게임

  for (const g of games) {
    const latest = latestOf(g.price_history);
    const live = latest && latest.discount_percent > 0;
    for (const p of g.price_history || []) {
      if (p.sale_ends_at && !(live && p.id === latest.id)) clearIds.push(p.id); // 최신이 아니거나 할인이 아닌 행의 종료일은 비움
    }
    if (live && g.itad_id) targets.push({ game: g, latest });
  }

  const clear = async (ids) => {
    if (!ids.length) return;
    const { error } = await supabase.from('price_history').update({ sale_ends_at: null }).in('id', ids);
    if (error) { log(`⚠️ 종료일 비우기 실패: ${error.message}`); r.errors++; } else r.cleared += ids.length;
  };
  await clear(clearIds);

  for (let i = 0; i < targets.length; i += ITAD_BATCH) {
    const chunk = targets.slice(i, i + ITAD_BATCH);
    let list;
    r.requests++;
    try {
      list = await getDeals(chunk.map((t) => t.game.itad_id));
    } catch (e) {
      log(`⚠️ ITAD 오류: 게임 ${chunk.length}개는 기존 종료일을 그대로 둠 — ${e.message}`);
      r.errors++;
      continue;
    }
    const byId = new Map(list.map((x) => [x.id, x]));

    for (const { game, latest } of chunk) {
      const deal = (byId.get(game.itad_id)?.deals || []).find((d) => d.shop?.id === STEAM_SHOP_ID && d.cut > 0);
      const t = deal?.expiry ? new Date(deal.expiry).getTime() : NaN;
      let next = null; // 기본은 비움: 딜이 없거나(끝남) 종료 시각을 모르거나 이미 지남
      if (deal) {
        // 우리 최신 기록과 같은 할인인지 확인 — 가격이 다르면 어느 딜의 종료일인지 모르니 건드리지 않음
        if (Math.round(deal.price?.amount) !== Math.round(latest.price)) { r.mismatch++; continue; }
        if (Number.isFinite(t) && t > now) next = new Date(t).toISOString();
        else r.noInfo++;
      }
      const cur = latest.sale_ends_at ? new Date(latest.sale_ends_at).toISOString() : null;
      if (cur === next) { r.kept++; continue; }
      const { error } = await supabase.from('price_history').update({ sale_ends_at: next }).eq('id', latest.id);
      if (error) { log(`⚠️ 저장 실패 (${game.name}): ${error.message}`); r.errors++; continue; }
      if (next) r.set++; else r.cleared++;
    }
  }
  return r;
}
