// scripts/build-similar-games.mjs
// 게임마다 가장 비슷한 18개를 계산해 game_similar에 저장 (상세 "이 게임과 비슷한 게임"·메인 "찜한 게임과 비슷한 게임"이 읽음)
// 실행: node --env-file=.env.local scripts/build-similar-games.mjs                       (미리보기만 — 기본, DB 변경 없음. --dry-run도 같음)
//       node --env-file=.env.local scripts/build-similar-games.mjs --apply               (바뀐 게임만 저장)
//       node --env-file=.env.local scripts/build-similar-games.mjs --show="Satisfactory,Stardew Valley"   (그 게임들의 상위 6개를 출력)
// - 유사도는 app/lib/taste.ts: 태그 √(득표/최대 득표) + 확인된 활동(activities_confirmed) 0.5, 코사인
// - 숨긴 게임(hidden)과 메인 노출 제외 게임(home_excluded)은 기준에도 후보에도 넣지 않음
// - 동점은 인기순(heat_rank 작은 순 → 리뷰 수 많은 순). AI·외부 요청 없음
// - 이미 저장된 목록과 같은 게임은 건너뜀(같은 값을 다시 쓰지 않음). 지우는 쿼리는 없음 — 저장된 칸보다 새 목록이 짧으면 남는 순위는 그대로 두고 경고만 출력
// - game_similar 표가 아직 없으면(마이그레이션 전) 미리보기는 "전부 새로 저장"으로 보고, --apply는 실패로 끝남
import { createClient } from '@supabase/supabase-js';
import { gameVector, topSimilar } from '../app/lib/taste.ts';

const APPLY = process.argv.includes('--apply');
const K = 18;
const SHOW_N = 6;
const showArg = process.argv.find((a) => a.startsWith('--show='));
const SHOW = showArg ? showArg.slice(7).split(',').map((s) => s.trim()).filter(Boolean) : [];
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const norm = (s) => String(s || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');

// 1000행씩 끝까지 읽기 (정렬이 고정돼야 페이지가 겹치지 않음)
async function readAll(table, columns, orders, filter = (q) => q) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let q = filter(supabase.from(table).select(columns));
    for (const o of orders) q = q.order(o);
    const { data, error } = await q.range(from, from + 999);
    if (error) return { rows, error };
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return { rows, error: null };
}

async function main() {
  const g = await readAll('games', 'id, name, search_name_ko, heat_rank, review_total, activities_confirmed', ['id'], (q) => q.eq('hidden', false).eq('home_excluded', false));
  if (g.error) throw new Error(`게임 목록을 못 불러옴: ${g.error.message}`);
  const t = await readAll('game_tags', 'game_id, tag_id, votes', ['game_id', 'tag_id']);
  if (t.error) throw new Error(`게임 태그를 못 불러옴: ${t.error.message}`);

  // 인기순(동점 처리 기준): heat_rank 작은 순(없으면 뒤) → 리뷰 수 많은 순 → id
  const games = g.rows.sort((a, b) => (a.heat_rank ?? Infinity) - (b.heat_rank ?? Infinity) || (b.review_total ?? 0) - (a.review_total ?? 0) || (a.id < b.id ? -1 : 1));
  const tagsOf = new Map();
  for (const r of t.rows) (tagsOf.get(r.game_id) ?? tagsOf.set(r.game_id, []).get(r.game_id)).push(r);
  const items = games.map((x) => ({ ...x, vec: gameVector(tagsOf.get(x.id) ?? [], x.activities_confirmed) }));
  const withVec = items.filter((x) => x.vec.norm > 0);
  console.log(`게임 ${items.length}개 (태그·활동이 있어 계산하는 게임 ${withVec.length}개) — ${APPLY ? '저장' : '미리보기'}\n`);

  const byId = new Map(items.map((x) => [x.id, x]));
  const result = new Map();
  for (const src of withVec) result.set(src.id, topSimilar(src, withVec, K));

  // 저장된 목록
  const stored = await readAll('game_similar', 'game_id, rank, similar_id, score', ['game_id', 'rank']);
  const tableMissing = !!stored.error;
  if (tableMissing) {
    if (APPLY) throw new Error(`game_similar를 못 읽음(마이그레이션 전이면 먼저 실행): ${stored.error.message}`);
    console.log(`⚠️ game_similar를 못 읽음(${stored.error.message}) — 마이그레이션 전이라 전부 새로 저장하는 것으로 봅니다\n`);
  }
  const storedBy = new Map();
  for (const r of stored.rows) (storedBy.get(r.game_id) ?? storedBy.set(r.game_id, []).get(r.game_id)).push(r);

  const upserts = [];
  let changed = 0, same = 0, short = 0;
  for (const [id, list] of result) {
    const old = (storedBy.get(id) ?? []).sort((a, b) => a.rank - b.rank);
    const identical = old.length >= list.length && list.every((x, i) => old[i].similar_id === x.id && Math.abs(old[i].score - x.score) < 1e-5);
    if (identical && old.length === list.length) { same++; continue; }
    if (list.length < K) short++;
    if (old.length > list.length) console.log(`⚠️ ${byId.get(id).name}: 새 목록 ${list.length}개 < 저장된 ${old.length}개 — 남는 순위는 그대로 둠`);
    changed++;
    list.forEach((x, i) => upserts.push({ game_id: id, rank: i + 1, similar_id: x.id, score: Math.round(x.score * 1e6) / 1e6 }));
  }

  if (SHOW.length) {
    for (const q of SHOW) {
      const hit = items.find((x) => norm(x.name) === norm(q)) ?? items.find((x) => [x.name, ...(x.search_name_ko || '').split(',')].some((n) => norm(n) && norm(n).includes(norm(q))));
      if (!hit) { console.log(`❓ ${q}: 게임을 못 찾음\n`); continue; }
      console.log(`■ ${hit.name}`);
      (result.get(hit.id) ?? []).slice(0, SHOW_N).forEach((r, i) => console.log(`  ${i + 1}. ${byId.get(r.id).name}  (${r.score.toFixed(3)})`));
      console.log('');
    }
  }

  if (APPLY) {
    for (let i = 0; i < upserts.length; i += 500) {
      const { error } = await supabase.from('game_similar').upsert(upserts.slice(i, i + 500), { onConflict: 'game_id,rank' });
      if (error) throw new Error(`저장 실패(${i}번째 행부터): ${error.message}`);
    }
  }
  console.log(`완료 — ${APPLY ? '저장' : '저장 예정'} ${changed}게임(${upserts.length}행) · 그대로 ${same}게임 · 18개 미만 ${short}게임`);
}

main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
