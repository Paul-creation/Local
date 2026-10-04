// scripts/lib/only-ids.mjs
// --ids <파일>: 지정한 게임만 처리하도록 games 조회에 id 조건을 붙임
// - 파일 형식: [{ "id": "...", ... }] 배열 JSON (예: data/meta/new-games-1007.json)
// - --ids가 없으면 조회를 그대로 둠 (매주 갱신은 지금처럼 전체 대상)
import { readFileSync } from 'node:fs';

const at = process.argv.indexOf('--ids');
export const ONLY_IDS = at > 0 ? JSON.parse(readFileSync(process.argv[at + 1], 'utf8')).map((g) => g.id).filter(Boolean) : null;
if (ONLY_IDS) console.log(`--ids: 지정한 게임 ${ONLY_IDS.length}개만 처리\n`);

export const onlyIds = (query) => (ONLY_IDS ? query.in('id', ONLY_IDS) : query);
