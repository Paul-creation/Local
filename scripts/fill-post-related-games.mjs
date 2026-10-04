// scripts/fill-post-related-games.mjs
// 기존 게시글의 관련 게임(posts.related_game_ids)을 한 번 채우는 일회성 스크립트 — 새 글은 작성·수정 때 서버가 자동으로 채움
// 실행: node --env-file=.env.local scripts/fill-post-related-games.mjs           (미리보기 — 매칭 결과만 출력, DB는 안 건드림)
//       node --env-file=.env.local scripts/fill-post-related-games.mjs --apply   (실제 반영)
// - supabase/migrations/20261007090000_post_related_games.sql을 먼저 실행해야 함
// - related_game_ids가 비어 있는(null) 글만 처리. 이미 값이 있는 글은 덮어쓰지 않음 → 여러 번 돌려도 안전
// - 관련 게임이 없는 글은 빈 목록({})으로 저장해서 다음에 다시 처리하지 않음
// - 매칭 규칙은 사이트와 같은 app/lib/gameMatch.mjs를 씀. posts 표의 related_game_ids 한 칸만 바꿈
import { createClient } from '@supabase/supabase-js';
import { buildMatchers, matchGames, MAX_RELATED } from '../app/lib/gameMatch.mjs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const PAGE = 1000;

async function readAll(table, cols, filter = (q) => q) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await filter(supabase.from(table).select(cols)).order('id').range(from, from + PAGE - 1);
    if (error) throw new Error(`${table} 조회 실패: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

async function main() {
  const games = await readAll('games', 'id, name, search_name_ko');
  const names = new Map(games.map((g) => [g.id, g.name]));
  const matchers = buildMatchers(games);
  const posts = await readAll('posts', 'id, title, body, game_id', (q) => q.is('related_game_ids', null));
  console.log(`게임 ${games.length}개, 아직 매칭 안 한 글 ${posts.length}개\n`);

  const todo = posts.map((p) => {
    const found = matchGames(`${p.title}\n${p.body}`, matchers, MAX_RELATED + 1);
    const ids = [...new Set([...(p.game_id ? [p.game_id] : []), ...found])].slice(0, MAX_RELATED);
    return { id: p.id, title: p.title, ids };
  });

  for (const t of todo.filter((t) => t.ids.length)) {
    console.log(`🔗 #${t.id} ${t.title}\n    → ${t.ids.map((id) => names.get(id) || id).join(', ')}`);
  }
  const empty = todo.filter((t) => !t.ids.length).length;
  console.log(`\n관련 게임 있음 ${todo.length - empty}개 · 없음 ${empty}개 (없음은 빈 목록으로 저장)`);

  if (!APPLY) return console.log('미리보기만 했어요. 반영하려면 --apply를 붙여 주세요');

  let ok = 0;
  for (const t of todo) {
    // 그 사이 글 수정으로 값이 채워졌으면 건드리지 않음
    const { error, count } = await supabase.from('posts').update({ related_game_ids: t.ids }, { count: 'exact' }).eq('id', t.id).is('related_game_ids', null);
    if (error) console.log(`❌ #${t.id}: ${error.message}`);
    else if (count) ok++;
  }
  console.log(`✅ ${ok}/${todo.length}개 반영 완료`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
