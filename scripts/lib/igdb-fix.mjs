// scripts/lib/igdb-fix.mjs — 이름 검색 오매칭 정정 계획 (순수 함수, fix-igdb-mismatch가 씀)
// 칸마다: DB 값이 이미 앱 ID로 찾은 값이면 그대로, "예전 이름 검색이 썼을 값"과 같으면 앱 ID 값으로 바꾸고, 둘 다 아니면(나중에 다른 값이 들어간 칸) 건드리지 않는다
import { isBlank } from './igdb.mjs';

export const FIX_FIELDS = ['genres', 'themes', 'critic_score', 'developer', 'publisher', 'platform'];

const canon = (v) => (isBlank(v) ? '' : Array.isArray(v) ? JSON.stringify([...v].sort()) : JSON.stringify(v));
export const sameValue = (a, b) => canon(a) === canon(b);

// current: DB 현재 값, oldHit: 예전 이름 검색이 썼을 값, app: 앱 ID로 찾은 IGDB 값 (모두 FIX_FIELDS 칸을 가진 객체, platform은 없으면 null)
export function planFix(current, oldHit, app) {
  const changes = {};
  const kept = [];
  for (const f of FIX_FIELDS) {
    if (f === 'platform' && app.platform == null) continue; // IGDB가 플랫폼을 안 주면 비교하지 않음
    if (sameValue(current[f], app[f])) continue;
    if (sameValue(current[f], oldHit[f])) changes[f] = { before: current[f], after: isBlank(app[f]) ? null : app[f] };
    else kept.push(f);
  }
  return { changes, kept };
}
