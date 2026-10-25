// scripts/lib/playstyle-guard.mjs
// 보강 AI가 스팀 근거 없이 지어내는 플레이 방식(대면·로컬·같은 화면·화면 분할·오프라인)을 막음 — 프롬프트 규칙 + 코드 검사 (AI 호출 없음)
// 근거 = 스팀 카테고리의 Local Co-op·Shared/Split Screen 계열. DB에서는 has_local_coop(Shared/Split Screen Co-op)이거나, 받아 둔 카테고리 목록에 해당 문구가 있는 경우
import fs from 'node:fs';

export const PLAYSTYLE_RULE = '스팀 설명·태그·카테고리에 근거가 없는 플레이 방식(대면, 로컬, 같은 화면, 화면 분할, 오프라인 등)은 쓰지 말 것. 근거가 없으면 빼거나 비워둘 것.';

const LOCAL_RE = /대면|로컬|같은\s?화면|한\s?화면|화면\s?(분할|공유)|분할\s?화면|스플릿|소파|오프라인|local|split.?screen|couch|offline/i;
const LOCAL_CATEGORY_RE = /local|shared\/split|split screen/i;
const CACHE = 'scripts/.cache/steam-categories.json';

let cache;
export function cachedCategories(appid) {
  if (cache === undefined) {
    try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch { cache = {}; }
  }
  return cache[appid]?.categories ?? [];
}

export const hasLocalBasis = (game, categories = []) =>
  game?.has_local_coop === true || categories.some((c) => LOCAL_CATEGORY_RE.test(c));

// 근거 없는 대면·로컬 표현이 있으면 걸린 표현을, 없으면 null
export function inventedPlaystyle(text, game, categories = []) {
  if (hasLocalBasis(game, categories)) return null;
  return String(text ?? '').match(LOCAL_RE)?.[0] ?? null;
}

// 활동 목록에서 근거 없는 항목을 뺌 → { kept, removed }
export function filterActivities(list, game, categories = []) {
  const kept = [], removed = [];
  for (const a of list) (inventedPlaystyle(a, game, categories) ? removed : kept).push(a);
  return { kept, removed };
}
