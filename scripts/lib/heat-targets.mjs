// scripts/lib/heat-targets.mjs
// enrich-itad-heat 대상 고르기 — ITAD 요청을 아끼려고 매일 전체 대신 일부만
// - 매일: ITAD ID가 없는 게임 (새 게임). 단, 최근에 ITAD에 없다고 확인된 게임은 건너뜀
// - 나머지: 게임 id 해시 % 7 == 요일(한국 시간)인 게임 → 7일에 한 바퀴 (backfill-price-history와 같은 규칙)
// - --all이면 전부 (없음 캐시도 무시)
// "없음" 캐시는 파일(scripts/.cache/itad-missing.json, 스팀 appid → 확인한 날짜)이고 daily 워크플로가 실행 사이에 보관함
import fs from 'node:fs';
import path from 'node:path';
import { dayHash } from './backfill-targets.mjs';

export const MISSING_TTL_DAYS = 30; // 이 기간이 지나면 다시 찾아봄 (ITAD가 나중에 등록할 수 있음)
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

export function isHeatTarget(game, weekday, { all = false, missing = {}, now = Date.now() } = {}) {
  if (all) return true;
  if (!game.itad_id) return !isKnownMissing(missing, game.steam_appid, now);
  return dayHash(game.id) % 7 === weekday;
}
