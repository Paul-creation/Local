// scripts/lib/heat-targets.mjs
// enrich-itad-heat 대상 고르기 — ITAD 요청을 아끼려고 매일 전체 대신 일부만
// - 매일: ITAD ID가 없는 게임 (새 게임). 단, 최근에 ITAD에 없다고 확인된 게임은 건너뜀
// - 매일: heat_rank 상위 HOT_TOP_N개 (메인 "지금 뜨는 게임"·snapshot-hot-rank는 상위 50개를 쓰므로 3배로 넉넉하게)
// - 나머지: 게임 id 해시 % 7 == 요일(한국 시간)인 게임 → 7일에 한 바퀴 (backfill-price-history와 같은 규칙)
// - --all이면 전부 (없음 캐시도 무시)
// "없음" 캐시는 파일(scripts/.cache/itad-missing.json, 스팀 appid → 확인한 날짜)이고 daily 워크플로가 실행 사이에 보관함
import fs from 'node:fs';
import path from 'node:path';
import { dayHash } from './backfill-targets.mjs';

export const MISSING_TTL_DAYS = 30; // 이 기간이 지나면 다시 찾아봄 (ITAD가 나중에 등록할 수 있음)
export const HOT_TOP_N = 150;
export const MISSING_FILE = process.env.ITAD_MISSING_FILE ?? 'scripts/.cache/itad-missing.json';

export function loadMissing(file = MISSING_FILE) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveMissing(missing, file = MISSING_FILE) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(missing));
}

export function isKnownMissing(missing, appid, now = Date.now()) {
  const at = Date.parse(missing[appid]);
  return Number.isFinite(at) && now - at < MISSING_TTL_DAYS * 86400 * 1000;
}

// heat_rank 작은 순 상위 n개의 id (순위 값이 아니라 목록 안 순서 — 숨김 게임 때문에 순위 값에 빈 곳이 있음)
export function hotIds(games, n = HOT_TOP_N) {
  return new Set(games.filter((g) => g.heat_rank != null).sort((a, b) => a.heat_rank - b.heat_rank).slice(0, n).map((g) => g.id));
}

export function isHeatTarget(game, weekday, { all = false, missing = {}, now = Date.now(), hot = new Set() } = {}) {
  if (all) return true;
  if (!game.itad_id) return !isKnownMissing(missing, game.steam_appid, now);
  if (hot.has(game.id)) return true;
  return dayHash(game.id) % 7 === weekday;
}
