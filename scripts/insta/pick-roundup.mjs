// scripts/insta/pick-roundup.mjs
// --roundup 게임 고르기 (DB 읽기만 함)
// 조건: 지금 할인 중 + 공포(태그 호러·심리 공포·서바이벌 호러 또는 테마 Horror) + 2인 이상 멀티 + 스팀 평가 "대체로 긍정적" 이상, 출시 전 제외
// 정렬: 협동(온라인·로컬) 우선 → 한국어 지원 우선 → 인기(리뷰 수, 같으면 동접)
// 실행: node scripts/insta/pick-roundup.mjs [개수=10] [제외 appid …]  → 표 출력
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

try { if (!process.env.NEXT_PUBLIC_SUPABASE_URL) process.loadEnvFile('.env.local'); } catch { /* .env.local 없음 */ }
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const FIELDS = 'id, name, display_name, steam_appid, tags, themes, review_summary, review_total, review_positive_percent, current_players, korean_support, min_players, max_players, has_online_coop, has_local_coop, release_status, screenshots, price_history(price, original_price, discount_percent, sale_ends_at, checked_at)';
const GOOD = ['대체로 긍정적', '긍정적', '매우 긍정적', '압도적으로 긍정적'];
const HORROR_TAGS = ['호러', '심리 공포', '서바이벌 호러'];
export const DEFAULT_SALE_END = '11/3';

export const gameTitle = (g) => g.display_name || g.name;
export const hasKorean = (g) => !!g.korean_support && g.korean_support !== '한국어 없음' && g.korean_support !== '없음';
export const latestKrw = (g) => (g.price_history ?? []).filter((p) => p.price >= 100).sort((a, b) => new Date(b.checked_at) - new Date(a.checked_at))[0];
const kstMD = (iso) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' }).formatToParts(new Date(iso)).map((x) => [x.type, x.value])); return `${p.month}/${p.day}`; };
// 할인 종료일(M/D): ITAD 만료일(price_history.sale_ends_at)이 미래면 그 날짜, 없으면 DEFAULT_SALE_END
export const saleEndOf = (row) => (row?.sale_ends_at && new Date(row.sale_ends_at) > new Date() ? kstMD(row.sale_ends_at) : DEFAULT_SALE_END);

export async function selectRoundup(n = 10, exclude = []) {
  let all = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from('games').select(FIELDS).eq('hidden', false).is('merged_into', null).range(from, from + 999);
    if (error) throw new Error(`후보 조회 실패: ${error.message}`);
    all = all.concat(data);
    if (data.length < 1000) break;
  }
  const skip = new Set(exclude.map(String));
  return all.filter((g) => {
    const now = latestKrw(g);
    return !skip.has(String(g.steam_appid)) && g.release_status !== 'coming_soon' && now?.discount_percent > 0
      && ((g.tags ?? []).some((t) => HORROR_TAGS.includes(t)) || (g.themes ?? []).includes('Horror'))
      && g.max_players >= 2 && GOOD.includes(g.review_summary) && (g.screenshots ?? []).length >= 2;
  }).sort((a, b) => (b.has_online_coop || b.has_local_coop) - (a.has_online_coop || a.has_local_coop)
    || hasKorean(b) - hasKorean(a) || (b.review_total ?? 0) - (a.review_total ?? 0) || (b.current_players ?? 0) - (a.current_players ?? 0)).slice(0, n);
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(new URL(import.meta.url).pathname)) {
  const [n, ...ex] = process.argv.slice(2);
  const list = await selectRoundup(Number(n) || 10, ex);
  console.log('| # | 게임 | appid | 정가 | 할인가 | 할인율 | 종료 | 한글 | 평가 | 리뷰 수 | 동접 | 멀티 |\n|---|---|---|---|---|---|---|---|---|---|---|---|');
  list.forEach((g, i) => {
    const r = latestKrw(g);
    console.log(`| ${i + 1} | ${gameTitle(g)} | ${g.steam_appid} | ${r.original_price ? r.original_price.toLocaleString('ko-KR') : '-'} | ${r.price.toLocaleString('ko-KR')} | -${r.discount_percent}% | ${saleEndOf(r)}${r.sale_ends_at && new Date(r.sale_ends_at) > new Date() ? '' : '(기본값)'} | ${hasKorean(g) ? 'O' : 'X'} | ${g.review_summary} | ${g.review_total ?? '-'} | ${g.current_players ?? '-'} | ${g.min_players}-${g.max_players}인 ${[g.has_online_coop && '온라인', g.has_local_coop && '로컬'].filter(Boolean).join('/')} |`);
  });
}
