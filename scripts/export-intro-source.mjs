// scripts/export-intro-source.mjs
// 인기 상위 100개 게임의 한 줄 소개(fun_description) 원본을 파일로 내보내기 — DB는 읽기만 함
// 순위 기준: heat_rank 오름차순 → current_players 내림차순 (write-fun-descriptions.mjs와 같은 기준)
// 실행: node --env-file=.env.local scripts/export-intro-source.mjs
//       node --env-file=.env.local scripts/export-intro-source.mjs --force   (이미 있는 파일을 새로 덮어씀)
// 결과: data/intros/top100-source.json — 이 파일을 커밋하면 새 소개를 이걸 기준으로 씀
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const OUT = 'data/intros/top100-source.json';
const TOP_N = 100;

async function main() {
  if (existsSync(OUT) && !process.argv.includes('--force')) {
    return console.log(`${OUT} 파일이 이미 있어요. 새로 받으려면 --force를 붙여 주세요`);
  }
  const { data: games, error } = await supabase
    .from('games')
    .select('id, name, fun_description, description, tags, min_players, max_players, recommended_players, solo_playable, difficulty, activities, heat_rank, current_players')
    .order('heat_rank', { ascending: true, nullsFirst: false })
    .order('current_players', { ascending: false, nullsFirst: false })
    .limit(TOP_N);
  if (error) return console.error('조회 실패:', error.message);

  const rows = games.map((g, i) => ({
    rank: i + 1,
    game_id: g.id,
    name: g.name,
    old_intro: g.fun_description ?? null,
    description: String(g.description || '').replace(/\s+/g, ' ').trim().slice(0, 400),
    tags: g.tags || [],
    players: `${g.min_players ?? '?'}-${g.max_players ?? '?'}`,
    recommended_players: g.recommended_players ?? null,
    solo_playable: g.solo_playable ?? null,
    difficulty: g.difficulty ?? null,
    activities: g.activities || [],
    heat_rank: g.heat_rank ?? null,
    current_players: g.current_players ?? null,
  }));

  mkdirSync('data/intros', { recursive: true });
  writeFileSync(OUT, JSON.stringify(rows, null, 2) + '\n');
  console.log(`✅ ${rows.length}개 저장 → ${OUT}`);
  console.log(rows.slice(0, 10).map((r) => `  ${r.rank}. ${r.name}`).join('\n'));
}

main();
