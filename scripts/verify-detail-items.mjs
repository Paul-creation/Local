// 상세 페이지 항목 렌더 확인 — DB에 값이 있는 항목이 화면(해당 섹션)에 보이는지 본다. 읽기 전용.
// 실행: npm run build && npx next start -p 3100  (다른 터미널)  →  BASE_URL=http://localhost:3100 npm run verify-detail
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const BASE = process.env.BASE_URL || 'http://localhost:3100';
const NAMES = ['Lethal Company', 'Stardew Valley', 'It Takes Two', 'Deadly Days: Roadtrip', 'One Tank Trip', 'Finals Week'];
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 멀티 전용(solo_mode none) 게임의 플레이 시간 타일 숨김은 의도된 동작 — page.tsx의 ttb 조건과 같다
const ttbShown = (g) => g.ttb_normally > 0 && g.solo_mode !== 'none'
  && (!g.ttb_hastily || g.ttb_hastily <= g.ttb_normally) && (!g.ttb_completely || g.ttb_completely >= g.ttb_normally);

const COLS = 'id,name,release_status,is_free,price_type,story_length,ttb_hastily,ttb_normally,ttb_completely,solo_mode,max_players,party_max,entry_barrier,korean_support,developer,publisher,release_date,release_date_text,platform,has_ending,heat_rank,achievement_count,has_dlc,steam_appid,family_sharing,storage_gb,has_workshop,recommended_players,session_max';

const browser = await chromium.launch();
let fails = 0;
for (const name of NAMES) {
  const { data } = await s.from('games').select(COLS).eq('hidden', false).ilike('name', name + '%').limit(1);
  const g = data?.[0];
  if (!g) { console.log(`✗ ${name}: DB에서 못 찾음`); fails++; continue; }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/games/${g.id}`, { waitUntil: 'networkidle' });
  const sections = await page.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll('main section.detail-card')].map((el) => [el.querySelector('.detail-card-title')?.textContent.replace('ⓘ', '').trim() ?? '', el.innerText]),
  ));
  await page.close();

  const soon = g.release_status === 'coming_soon';
  const need = []; // [섹션, 문구, 이유]
  const friends = g.party_max ?? g.max_players;
  if (friends) need.push(['한눈에 보기', '인원', 'max_players']);
  if (g.entry_barrier) need.push(['한눈에 보기', '진입장벽', 'entry_barrier']);
  if (g.korean_support) need.push(['한눈에 보기', '한국어', 'korean_support']);
  if (ttbShown(g)) need.push(['한눈에 보기', '플레이 시간', 'ttb_normally']);
  if (!soon) need.push(['가격·할인', g.is_free ? '무료' : g.price_type ? '' : '₩', 'price']);
  if (g.max_players > 1) need.push(['플레이 방식', '인원 범위', 'max_players']);
  if (g.solo_mode) need.push(['플레이 방식', '혼자 하기', 'solo_mode']);
  if (g.recommended_players) need.push(['플레이 방식', '추천 인원', 'recommended_players']);
  if (g.story_length) need.push(['어떤 게임인가요?', '클리어까지', 'story_length']);
  if (g.has_ending != null) need.push(['어떤 게임인가요?', '엔딩', 'has_ending']);
  if (g.developer) need.push(['게임 정보', '개발', 'developer']);
  if (g.publisher && g.publisher !== g.developer) need.push(['게임 정보', '배급', 'publisher']);
  if (g.release_date || (soon && g.release_date_text)) need.push(['게임 정보', '출시일', 'release_date']);
  if (g.platform) need.push(['게임 정보', '플랫폼', 'platform']);
  if (g.heat_rank) need.push(['게임 정보', 'ITAD 인기 순위', 'heat_rank']);
  if (g.achievement_count) need.push(['게임 정보', '도전과제', 'achievement_count']);
  if (g.has_dlc != null) need.push(['게임 정보', 'DLC', 'has_dlc']);
  if (g.steam_appid && g.family_sharing != null) need.push(['게임 정보', '가족 공유', 'family_sharing']);
  if (g.storage_gb) need.push(['게임 정보', '필요 용량', 'storage_gb']);
  if (g.has_workshop) need.push(['게임 정보', '모드 지원', 'has_workshop']);

  const missing = need.filter(([sec, text]) => !(sections[sec] ?? '').includes(text));
  if (missing.length) { fails++; console.log(`✗ ${g.name}: ${missing.map(([sec, t, why]) => `${sec} > ${t || '(가격 문구)'} [${why}]`).join(', ')}`); }
  else console.log(`✓ ${g.name}: ${need.length}개 항목 확인`);
}
await browser.close();
if (fails) { console.error(`\n${fails}개 게임에서 항목 누락`); process.exit(1); }
