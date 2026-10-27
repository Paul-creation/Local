// scripts/insta/pick-halloween.mjs
// posts/halloween.json을 DB에서 자동으로 채운다 (DB 읽기만 함)
// 조건: 공포 태그(홈 할로윈 이벤트와 같은 태그) · 최대 2인 이상 · 지금 할인 중 · 긍정 평가 높은 순 4개
// 실행: node scripts/insta/pick-halloween.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

try { if (!process.env.NEXT_PUBLIC_SUPABASE_URL) process.loadEnvFile('.env.local'); } catch { /* .env.local 없음 */ }
const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, 'posts', 'halloween.json');
const HORROR_TAGS = ['호러', '서바이벌 호러', '심리 공포', '좀비']; // app/lib/event.ts 할로윈 주간 이벤트 태그
const COUNT = 4;
const MIN_REVIEWS = 1000; // 리뷰가 너무 적은 게임이 퍼센트만으로 위에 오르지 않게

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const FIELDS = 'id, name, display_name, steam_appid, tags, min_players, max_players, review_positive_percent, review_total, fun_description, screenshots, cover_image_url, release_status, price_type, price_history(price, discount_percent, original_price, checked_at)';

// 가장 최근 원화(100원 이상) 가격 기록 — app/lib/price.ts getPriceInfo와 같은 기준
const latestPrice = (g) => (g.price_history ?? []).filter((p) => p.price >= 100).sort((a, b) => new Date(b.checked_at) - new Date(a.checked_at))[0];
const won = (n) => `₩${Math.round(n).toLocaleString('ko-KR')}`;

const { data, error } = await db.from('games').select(FIELDS)
  .eq('hidden', false).is('merged_into', null).overlaps('tags', HORROR_TAGS).gte('max_players', 2).limit(1000);
if (error) { console.error(`게임 조회 실패: ${error.message}`); process.exit(1); }

const picked = (data ?? [])
  .map((g) => ({ g, price: latestPrice(g) }))
  .filter(({ g, price }) => !g.price_type && g.release_status !== 'coming_soon' && price?.discount_percent > 0
    && g.review_positive_percent && g.review_total >= MIN_REVIEWS && g.fun_description)
  .sort((a, b) => b.g.review_positive_percent - a.g.review_positive_percent || b.g.review_total - a.g.review_total)
  .slice(0, COUNT);
if (picked.length < COUNT) { console.error(`조건에 맞는 게임이 ${picked.length}개뿐이에요 (필요 ${COUNT}개)`); process.exit(1); }

const slides = picked.map(({ g, price }) => {
  const shot = Array.isArray(g.screenshots) ? g.screenshots.find((s) => typeof s?.path_full === 'string')?.path_full : null;
  const stored = Number(price.original_price);
  return {
    type: 'game-card',
    name: g.display_name || g.name,
    people: g.min_players === g.max_players ? `${g.max_players}인` : `최대 ${g.max_players}인`,
    discount: price.discount_percent,
    price: won(price.price),
    ...(Number.isFinite(stored) && stored > price.price ? { original: won(stored) } : {}), // 수집한 정가만 쓰고 역산하지 않는다
    tagline: g.fun_description,
    image: shot || g.cover_image_url,
  };
});

const post = [
  { type: 'collage-cover', kicker: `할로윈 특가 · 최대 -${Math.max(...slides.map((s) => s.discount))}%`, headline: '친구랑 비명 지를\n게임.jpg', images: slides.map((s) => s.image) },
  ...slides,
  { type: 'cta', small: '인원·할인·내 PC까지 한 번에', big: '여기서\n{골라와}', footer: '프로필 링크 → jamidunow.com' },
];
fs.writeFileSync(OUT, JSON.stringify(post, null, 2) + '\n');

console.log(`${path.relative(process.cwd(), OUT)} 저장`);
for (const [i, { g, price }] of picked.entries()) {
  const matched = (g.tags ?? []).filter((t) => HORROR_TAGS.includes(t)).join('/');
  console.log(`${i + 1}. ${g.display_name || g.name} | ${g.min_players}-${g.max_players}인 | -${price.discount_percent}% ${won(price.price)} | 긍정 ${g.review_positive_percent}% (${g.review_total.toLocaleString('ko-KR')}개) | ${matched} | ${slides[i].image === g.cover_image_url ? '헤더 이미지' : '스크린샷'}`);
}
