// scripts/insta/pick.mjs
// detail-pair 슬라이드용 게임 고르기 (DB 읽기만 함)
// 조건: 2~4인 · 영상 있음 · PC 사양 있음 · 지금 할인 중 · 메인 커버 벽(첫 30장)에 나오는 게임
// 실행: node scripts/insta/pick.mjs            → 후보 목록 출력
// 모듈: resolveGame(key)   — key는 게임 id(uuid) · 스팀 appid(숫자) · 게임 이름(name/display_name 정확히 일치)
//       pickCandidates()   — 위 조건을 만족하는 후보(커버 벽 앞쪽 순서)
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

try { if (!process.env.NEXT_PUBLIC_SUPABASE_URL) process.loadEnvFile('.env.local'); } catch { /* .env.local 없음 */ }
const SITE = (process.env.SITE || 'https://jamidunow.com').replace(/\/$/, '');
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const FIELDS = 'id, name, display_name, steam_appid, min_players, max_players, spec_parsed, min_spec, hidden, merged_into, release_status, game_videos(kind), price_history(price, discount_percent, checked_at)';

export const gameTitle = (g) => g.display_name || g.name;

// 가장 최근 원화(100원 이상) 가격 기록의 할인율 — app/lib/price.ts getPriceInfo와 같은 기준
const saleOf = (g) => {
  const rows = (g.price_history ?? []).filter((p) => p.price >= 100).sort((a, b) => new Date(b.checked_at) - new Date(a.checked_at));
  return rows[0]?.discount_percent ?? 0;
};

export async function resolveGame(key) {
  const q = db().from('games').select(FIELDS).eq('hidden', false).is('merged_into', null);
  const s = String(key);
  const { data, error } = /^[0-9a-f-]{36}$/i.test(s) ? await q.eq('id', s) : /^\d+$/.test(s) ? await q.eq('steam_appid', s) : await q.or(`name.eq."${s}",display_name.eq."${s}"`);
  if (error) throw new Error(`게임 조회 실패(${s}): ${error.message}`);
  if (!data?.length) throw new Error(`게임을 못 찾았어요: ${s}`);
  return data[0];
}

async function wallAppids() {
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 1080, height: 1350 } })).newPage();
    await page.goto(SITE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.mn-hero-bg img', { state: 'attached', timeout: 30000 });
    const srcs = await page.evaluate(() => [...document.querySelectorAll('.mn-hero-bg img')].map((i) => i.currentSrc || i.src));
    return srcs.map((u) => u.match(/\/apps\/(\d+)\//)?.[1]).filter(Boolean);
  } finally { await browser.close(); }
}

export async function pickCandidates() {
  const appids = await wallAppids();
  const { data, error } = await db().from('games').select(FIELDS).in('steam_appid', appids).eq('hidden', false).is('merged_into', null);
  if (error) throw new Error(`후보 조회 실패: ${error.message}`);
  const ok = (data ?? []).filter((g) => g.release_status !== 'coming_soon' && g.max_players >= 2 && g.max_players <= 4
    && (g.game_videos ?? []).length > 0 && (g.min_spec || g.spec_parsed) && saleOf(g) > 0);
  const order = (g) => appids.indexOf(String(g.steam_appid));
  const first30 = (g) => order(g) < 30;
  return [...ok.filter(first30), ...ok.filter((g) => !first30(g))].sort((a, b) => order(a) - order(b))
    .map((g) => ({ ...g, sale: saleOf(g), onWall: first30(g) }));
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(new URL(import.meta.url).pathname)) {
  const list = await pickCandidates();
  if (!list.length) console.log('조건에 맞는 게임이 없어요');
  for (const g of list) console.log(`${g.onWall ? '벽' : '벽(뒤쪽)'} | ${gameTitle(g)} | ${g.min_players}-${g.max_players}인 | -${g.sale}% | 영상 ${g.game_videos.length}개 | appid ${g.steam_appid} | ${g.id}`);
}
