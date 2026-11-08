// scripts/fill-upcoming-rank.mjs
// 스팀 "인기 출시 예정"(filter=popularcomingsoon, 한국 상점) 상위 200위 순서 → games.upcoming_rank (출시 예정 상세 페이지의 "스팀 인기 출시 예정 N위" 타일)
// 실행: node --env-file=.env.local scripts/fill-upcoming-rank.mjs            (미리보기 — 바뀔 순위만 출력, DB 안 씀)
//       node --env-file=.env.local scripts/fill-upcoming-rank.mjs --apply    (저장)
// - 순위권 밖이거나 출시 예정이 아니게 된 게임은 null로 되돌림 (값이 있을 때만 타일이 보임). 순위 외 칸은 안 건드림
// - 칸이 없으면(마이그레이션 supabase/migrations/20261108090000_description_ko.sql 전) 안내만 하고 정상 종료. 스팀 요청이 실패하면 아무것도 바꾸지 않음
import { createClient } from '@supabase/supabase-js';
import { steamGet } from './lib/steam.mjs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const PAGES = 4; // 50개씩

async function main() {
  const probe = await supabase.from('games').select('upcoming_rank').limit(1);
  if (probe.error) return console.log(`games.upcoming_rank 칸이 없어요 (${probe.error.message}) — supabase/migrations/20261108090000_description_ko.sql 실행 뒤에 다시 돌려 주세요`);
  const rank = new Map();
  for (let p = 0; p < PAGES; p++) {
    const json = await steamGet(`https://store.steampowered.com/search/results?filter=popularcomingsoon&cc=kr&l=korean&json=1&start=${p * 50}&count=50`);
    for (const item of json.items || []) {
      const m = item.logo?.match(/\/apps\/(\d+)\//);
      if (m && !rank.has(m[1])) rank.set(m[1], rank.size + 1);
    }
  }
  if (!rank.size) return console.log('순위를 못 받아서 아무것도 바꾸지 않아요');
  const { data, error } = await supabase.from('games').select('id, name, steam_appid, release_status, upcoming_rank').or('release_status.eq.coming_soon,upcoming_rank.not.is.null');
  if (error) throw new Error(error.message);
  const changes = data.map((g) => ({ g, to: g.release_status === 'coming_soon' ? rank.get(String(g.steam_appid)) ?? null : null })).filter((c) => c.to !== g_rank(c.g));
  function g_rank(g) { return g.upcoming_rank ?? null; }
  console.log(`${APPLY ? '반영' : '미리보기'} — 인기 출시 예정 ${rank.size}개 중 우리 게임 순위 변경 ${changes.length}개`);
  for (const { g, to } of changes) {
    console.log(`  - ${g.name}: ${g.upcoming_rank ?? '-'} → ${to ?? '-'}`);
    if (APPLY) { const { error: e } = await supabase.from('games').update({ upcoming_rank: to }).eq('id', g.id); if (e) console.log(`    저장 실패: ${e.message}`); }
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
