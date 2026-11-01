// scripts/insta/pick-reel-single.mjs
// --reel-single 게임 고르기 (DB 읽기만 함)
// 조건: 지금 할인 중 + 할인 종료가 SALE_BEFORE(KST) 이하(sale_ends_at이 있는 것만) + 온라인 협동/멀티 + 최대 2인 이상 + 스팀 리뷰 5만 개 미만 + 이미 올린 게임·EXCLUDE_NAMES 제외
// 장르: 카드·전략·시뮬레이션 제외, 액션·호러·파티·생존(themes/genres/tags)은 앞으로. 그 안에서는 리뷰 수 많은 순
// 이미 올린 게임: out/ 폴더(이 worktree와 형제 worktree들)에 있는 게시물 id의 posts·copy json에 나오는 숫자 중 스팀 appid와 같은 것
// 실행: node scripts/insta/pick-reel-single.mjs [개수=5]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { gameTitle, latestKrw } from './pick-roundup.mjs';

try { if (!process.env.NEXT_PUBLIC_SUPABASE_URL) process.loadEnvFile('.env.local'); } catch { /* .env.local 없음 */ }
const DIR = path.dirname(fileURLToPath(import.meta.url));
const SALE_BEFORE = new Date('2026-11-03T03:00:00+09:00');
const MAX_REVIEWS = 50000;
const EXCLUDE_NAMES = ['Rain World', 'Shady job'];
const ONLINE = /Online (Co-op|PvP)|Cross-Platform Multiplayer|Remote Play Together/i;
const BAD = /strategy|simulation|card|board|turn-based|tactical|city builder|management/i;
const BAD_TAGS = ['카드', '덱', '전략', '시뮬레이션', '턴제'];
const LIVELY = /action|horror|survival|party|shooter|fighting|battle royale|hack and slash|platform/i;
const FIELDS = 'id, name, display_name, steam_appid, min_players, max_players, review_summary, review_total, fun_description, steam_categories, genres, themes, tags, has_online_coop, release_status, price_type, price_history(price, original_price, discount_percent, sale_ends_at, checked_at)';

// out/에 결과가 있는 게시물 id → 그 게시물의 posts·copy json에 적힌 숫자 전부
function postedNumbers() {
  const repo = path.resolve(DIR, '..', '..'), parent = path.dirname(repo);
  const roots = [repo, '/workspaces/Local', ...fs.readdirSync(parent, { withFileTypes: true }).filter((w) => w.isDirectory() && w.name.startsWith('wt-')).map((w) => path.join(parent, w.name))];
  const ids = new Set();
  for (const r of roots) { try { for (const d of fs.readdirSync(path.join(r, 'scripts/insta/out'), { withFileTypes: true })) if (d.isDirectory()) ids.add(d.name); } catch { /* out 없음 */ } }
  const nums = new Set();
  for (const r of roots) for (const sub of ['posts', 'copy']) for (const id of ids) {
    try { for (const m of fs.readFileSync(path.join(r, 'scripts/insta', sub, `${id}.json`), 'utf8').matchAll(/\d{4,9}/g)) nums.add(m[0]); } catch { /* 파일 없음 */ }
  }
  return { ids: [...ids].sort(), nums };
}

const kst = (iso) => new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const n = Number(process.argv[2]) || 5;
const { ids, nums } = postedNumbers();
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
let all = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from('games').select(FIELDS).eq('hidden', false).is('merged_into', null).gte('max_players', 2).range(from, from + 999);
  if (error) { console.error(`조회 실패: ${error.message}`); process.exit(1); }
  all = all.concat(data);
  if (data.length < 1000) break;
}
const now = new Date();
const picked = all.map((g) => ({ g, r: latestKrw(g) })).filter(({ g, r }) =>
  !EXCLUDE_NAMES.includes(gameTitle(g)) && !nums.has(String(g.steam_appid))
  && (g.has_online_coop || ONLINE.test(JSON.stringify(g.steam_categories ?? [])))
  && !BAD.test([...(g.genres ?? []), ...(g.themes ?? [])].join(' ')) && !(g.tags ?? []).some((t) => BAD_TAGS.some((b) => t.includes(b)))
  && !g.price_type && g.release_status !== 'coming_soon'
  && r?.discount_percent > 0 && r.sale_ends_at && new Date(r.sale_ends_at) > now && new Date(r.sale_ends_at) <= SALE_BEFORE
  && g.review_total != null && g.review_total < MAX_REVIEWS && g.review_summary && g.fun_description)
  .map((x) => ({ ...x, lively: LIVELY.test([...(x.g.genres ?? []), ...(x.g.themes ?? [])].join(' ')) }))
  .sort((a, b) => b.lively - a.lively || b.g.review_total - a.g.review_total);

console.error(`제외(out/ 게시물 ${ids.length}개): ${ids.join(', ')} · 조건 통과 ${picked.length}개 중 활기찬 장르 우선·리뷰 수 많은 순 ${n}개`);
for (const { g, r, lively } of picked.slice(0, n)) {
  console.log(`${process.env.DEBUG_PICK ? `[${lively ? '활기' : '그외'}] ${(g.genres ?? []).join('/')} ${(g.themes ?? []).join('/')} ` : ''}${gameTitle(g)} | ${Math.round(r.price).toLocaleString('ko-KR')}원(-${r.discount_percent}%, ${kst(r.sale_ends_at)}까지) | 최대 ${g.max_players}인 | ${g.review_summary} | ${g.review_total.toLocaleString('ko-KR')}개 | ${g.fun_description} | appid ${g.steam_appid}`);
}
