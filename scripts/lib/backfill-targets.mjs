// scripts/lib/backfill-targets.mjs
// backfill-price-history 증분 대상 — ITAD 요청을 아끼려고 매일 전체 대신 일부만
// - 매일: ITAD ID가 없거나 가격 기록이 MIN_RECORDS건 미만인 게임 (새 게임·기록이 빈 게임)
// - 나머지: 게임 id 해시 % 7 == 요일(한국 시간)인 게임 → 7일에 한 바퀴 (DB 칸 없이 결정)
export const MIN_RECORDS = 5;

export function dayHash(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
  return h;
}

export const kstWeekday = (now = Date.now()) => new Date(now + 9 * 3600 * 1000).getUTCDay();

export function isBackfillTarget(game, weekday, all = false) {
  if (all) return true;
  return !game.itad_id || (game.price_history || []).length < MIN_RECORDS || dayHash(game.id) % 7 === weekday;
}
