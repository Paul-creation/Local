// scripts/insta/generate.mjs
// 인스타 게시물 이미지 생성: scripts/insta/posts/<post-id>.json → scripts/insta/out/<post-id>/01.png … (1080×1350)
// 실행: npm run insta -- <post-id>             (카드 벽·스크린샷은 cache/에 저장해 재사용)
//       npm run insta -- <post-id> --refresh   (jamidunow.com에서 벽·스크린샷을 다시 찍음)
//       SITE=http://localhost:3000 npm run insta -- <post-id> --refresh
// 처음 한 번: npm ci (브라우저가 없으면 npx playwright install chromium)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { renderSlide, SIZE } from './template.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '../..');
const CACHE = path.join(DIR, 'cache');
const SITE = (process.env.SITE || 'https://jamidunow.com').replace(/\/$/, '');
const args = process.argv.slice(2);
const refresh = args.includes('--refresh');
const postId = args.find((a) => !a.startsWith('--'));
if (!postId) { console.error('사용법: npm run insta -- <post-id> [--refresh]'); process.exit(1); }

const postFile = path.join(DIR, 'posts', `${postId}.json`);
if (!fs.existsSync(postFile)) { console.error(`게시물 파일이 없어요: ${path.relative(ROOT, postFile)}`); process.exit(1); }
const raw = fs.readFileSync(postFile, 'utf8');
if (raw.includes('재밌드나')) { console.error('화면에는 "재밌드나"를 쓰지 않아요. JamiDuNow만 쓰세요.'); process.exit(1); }
const slides = JSON.parse(raw);
if (!Array.isArray(slides) || slides.length === 0) { console.error('json은 슬라이드 배열이어야 해요.'); process.exit(1); }

const dataUri = (file) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
const wallFile = path.join(CACHE, 'wall.png');
const shotFile = path.join(CACHE, 'screenshot.png');

// 메인 히어로 표지 벽만 남기고 4:5(1080×1350) 6열×5줄로 다시 깔아 찍는다 — 가운데 크롭 대신 처음부터 4:5로 그려 해상도를 지킨다
async function captureWall(browser) {
  const page = await browser.newPage({ viewport: { width: SIZE.width, height: SIZE.height } });
  await page.goto(SITE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.mn-hero-bg img', { state: 'attached', timeout: 30000 });
  await page.addStyleTag({ content: `
    body, html { background: #0b0b0b !important; }
    body * { visibility: hidden !important; }
    .mn-hero::after, .mn-hero::before { display: none !important; }
    .mn-hero-bg, .mn-hero-bg * { visibility: visible !important; }
    .mn-hero-bg { position: fixed !important; inset: 0 !important; z-index: 2147483647 !important; opacity: 1 !important; -webkit-mask-image: none !important; mask-image: none !important;
      display: grid !important; grid-template-columns: repeat(6, 1fr) !important; grid-template-rows: repeat(5, 1fr) !important; grid-auto-flow: row !important; grid-auto-columns: auto !important; gap: 4px !important; overflow: hidden !important; }
    .mn-hero-bg img { width: 100% !important; height: 100% !important; display: block !important; object-fit: cover !important; }
    .mn-hero-bg img:nth-child(n + 31) { display: none !important; }
  ` });
  await page.evaluate(() => document.querySelectorAll('.mn-hero-bg img').forEach((i) => { i.loading = 'eager'; }));
  await page.waitForFunction(() => [...document.querySelectorAll('.mn-hero-bg img')].slice(0, 30).every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 30000 });
  await page.screenshot({ path: wallFile });
  await page.close();
}

// 모바일 뷰포트로 메인을 열어 인원 탭(4인)을 누른 뒤 "N인 추천 게임" 섹션을 찍는다
async function captureScreenshot(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(SITE, { waitUntil: 'domcontentloaded' });
  const tab = page.locator('.mn-tabs.is-section .mn-tab', { hasText: '4' }).first();
  await tab.waitFor({ timeout: 30000 });
  await tab.click();
  const sec = page.locator('section[aria-labelledby="mn-people-title"]');
  await sec.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...document.querySelectorAll('section[aria-labelledby="mn-people-title"] img')].filter((i) => i.getBoundingClientRect().left < innerWidth).every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 30000 });
  await page.waitForTimeout(500);
  await sec.screenshot({ path: shotFile });
  await ctx.close();
}

fs.mkdirSync(CACHE, { recursive: true });
const need = {
  wall: slides.some((s) => s.type === 'wall-cover') && (refresh || !fs.existsSync(wallFile)),
  shot: slides.some((s) => s.type === 'screenshot') && (refresh || !fs.existsSync(shotFile)),
};
const browser = await chromium.launch();
try {
  if (need.wall) { console.log('카드 벽 캡처…'); await captureWall(browser); }
  if (need.shot) { console.log('모바일 스크린샷 캡처…'); await captureScreenshot(browser); }

  const font = fs.readFileSync(path.join(ROOT, 'node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2')).toString('base64');
  const outDir = path.join(DIR, 'out', postId);
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) if (/^\d\d\.png$/.test(f)) fs.unlinkSync(path.join(outDir, f));

  const page = await browser.newPage({ viewport: SIZE });
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    const ctx = { font };
    if (s.type === 'wall-cover') ctx.wall = dataUri(wallFile);
    if (s.type === 'screenshot') ctx.screenshot = dataUri(shotFile);
    if (s.type === 'photo-cover' && s.image) {
      ctx.photo = /^https?:/.test(s.image) ? s.image : dataUri(path.resolve(path.dirname(postFile), s.image));
    }
    await page.setContent(renderSlide(s, i, slides.length, ctx), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const file = path.join(outDir, `${String(i + 1).padStart(2, '0')}.png`);
    await page.screenshot({ path: file, clip: { x: 0, y: 0, ...SIZE } });
    console.log(path.relative(ROOT, file));
  }
} finally {
  await browser.close();
}
