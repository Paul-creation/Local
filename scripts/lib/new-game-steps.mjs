// scripts/lib/new-game-steps.mjs
// 새 게임 한 번에 채우기(fill-new-game)가 도는 단계 — 매주 갱신(run-steps weekly)의 순서를 따르되 새 게임 id만 대상
// 각 항목: [스크립트 이름, ...인자]. 'IDS'는 --ids <파일>, 'FUN_IDS'는 --ids-file <한국어 설명이 빈 게임 파일>, 'DAYS'는 일수로 바뀜
export const NEW_GAME_STEPS = [
  ['backfill-steam-categories', '--apply', 'IDS'], // 스팀 카테고리 원문 — 플레이 방식 검사 근거라 AI 단계보다 먼저
  ['fill-players-from-store', '--apply', 'IDS'], // 최대 인원
  ['link-new-game-tags', '--apply', 'IDS'], // 태그 나무 연결 (스팀 태그 투표)
  ['judge-new-games', '--apply', '--days', 'DAYS', 'IDS'], // 진입장벽·혼자 하기 (Haiku)
  ['enrich-fallback', 'IDS'],
  ['enrich-igdb', 'IDS'],
  ['enrich-specs', 'IDS'], // 사양·출시일·한국어·용량
  ['parse-specs', '--apply', 'IDS'],
  ['fill-steam-categories', 'IDS'], // 협동·대전 칸 → 배지
  ['enrich-tags', 'IDS'],
  ['fix-data-gaps', 'IDS'], // 한국어·가격·부족한 태그
  ['fill-tags-desc', 'IDS'],
  ['fill-game-details', 'IDS'],
  ['enrich-card-images', 'IDS'],
  ['enrich-hero-images', 'IDS'],
  ['enrich-cover-vertical', '--apply', 'IDS'],
  ['enrich-screenshots', 'IDS'],
  ['write-fun-descriptions', '--ids-file', 'FUN_IDS'], // 한국어 한 줄 소개 (fun_description이 빈 게임만, Haiku)
  ['fill-search-names', 'IDS'],
  ['fill-activities-v2', '--apply', '--yes', '--new-days', 'DAYS', 'IDS'], // 가능한 활동 (Sonnet 5.5 배치)
  ['fill-english-names', '--apply', 'IDS'],
  ['enrich-update-date', 'IDS'],
];

export function stepArgs(step, { idsFile, funIdsFile, days }) {
  const [name, ...rest] = step;
  return [name, rest.map((a) => (a === 'IDS' ? ['--ids', idsFile] : a === 'FUN_IDS' ? [funIdsFile] : a === 'DAYS' ? [String(days)] : [a])).flat()];
}

// --ids 값: 쉼표로 나눈 게임 id 목록 또는 JSON 파일 경로 → id 배열
export function parseIdsArg(value, readFile) {
  if (!value) return null;
  if (/\.json$/i.test(value)) return JSON.parse(readFile(value)).map((r) => (typeof r === 'string' ? r : r.game_id ?? r.id)).filter(Boolean);
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}
