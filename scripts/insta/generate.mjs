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
import { resolveGame, pickCandidates, gameTitle } from './pick.mjs';

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
const shotPeople = (s) => Number(s.people ?? 4);

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

// 메인 "N인 추천 게임" 섹션 캡처 (모바일 뷰포트, 가로 스크롤 줄에서 완전히 보이는 카드만 clip에 넣는다)
//  chips: 인원 칩 줄부터 카드까지 / cards: 카드만 + 배지 조건(need)에 맞는 인원을 찾을 때까지 2~5인을 훑는다
async function capturePeople(browser, { people, chips, width, need = [], file }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(SITE, { waitUntil: 'domcontentloaded' });
  const secSel = 'section[aria-labelledby="mn-people-title"]';
  await page.locator(`${secSel} .mn-tab`).first().waitFor({ timeout: 30000 });
  await page.addStyleTag({ content: `${secSel} .mn-more { display: none !important; }` });
  const measure = () => page.evaluate((sel) => {
    const sec = document.querySelector(sel);
    const row = sec.querySelector('.mn-row');
    const r = row.getBoundingClientRect();
    const full = [...row.children].filter((c) => { const b = c.getBoundingClientRect(); return b.left >= r.left - 1 && b.right <= r.right + 1; });
    const t = sec.querySelector('.mn-tabs').getBoundingClientRect();
    const lastTab = [...sec.querySelector('.mn-tabs').children].map((c) => c.getBoundingClientRect()).filter((c) => c.right <= innerWidth).pop();
    return {
      badges: full.map((c) => c.querySelector('.mn-badge')?.textContent ?? ''),
      cards: full.map((c) => { const b = c.getBoundingClientRect(); return { left: b.left + scrollX, right: b.right + scrollX, top: b.top + scrollY, bottom: b.bottom + scrollY }; }),
      tabs: { left: t.left + scrollX, top: t.top + scrollY, right: (lastTab?.right ?? 0) + scrollX },
    };
  }, secSel);
  const choose = async (n) => {
    await page.locator(`${secSel} .mn-tab`, { hasText: new RegExp(`^${n}인`) }).first().click();
    await page.locator(secSel).scrollIntoViewIfNeeded();
    await page.waitForFunction((sel) => [...document.querySelectorAll(`${sel} img`)].filter((i) => i.getBoundingClientRect().left < innerWidth).every((i) => i.complete && i.naturalWidth > 0), secSel, { timeout: 30000 });
    await page.waitForTimeout(500);
    return measure();
  };
  let m, n = people;
  if (n) m = await choose(n);
  else {
    for (const c of [3, 2, 4, 5]) { m = await choose(c); if (need.every((b) => m.badges.includes(b))) { n = c; break; } }
    if (!n) { n = 3; m = await choose(3); console.warn(`경고: ${need.join('·')} 배지가 함께 보이는 인원이 없어서 3인으로 찍었어요 (${m.badges.join(', ')})`); }
  }
  if (!m.cards.length) throw new Error('완전히 보이는 카드가 없어요');
  if (people && need.length && !need.every((b) => m.badges.includes(b))) console.warn(`경고: ${people}인 화면의 배지가 ${m.badges.join(', ')}라서 ${need.join('·')}이(가) 다 보이지 않아요`);
  const pad = 12;
  const left = Math.min(...m.cards.map((c) => c.left), chips ? m.tabs.left : Infinity);
  const right = Math.max(...m.cards.map((c) => c.right), chips ? m.tabs.right : 0);
  const top = chips ? m.tabs.top - 6 : Math.min(...m.cards.map((c) => c.top)) - pad;
  const bottom = Math.max(...m.cards.map((c) => c.bottom)) + pad;
  const clip = { x: Math.max(0, left - pad), y: top, width: right - left + pad * 2, height: bottom - top };
  console.log(`${n}인 · 카드 ${m.cards.length}개(${m.badges.map((b) => b || '-').join(', ')}), clip ${Math.round(clip.width)}×${Math.round(clip.height)}`);
  await page.screenshot({ path: file(n), clip, fullPage: true });
  await ctx.close();
}

// 게임 상세 페이지 모바일 캡처 두 장: 왼쪽 = 상단 요약(커버·인원·가격·할인), 오른쪽 = PC 사양 카드 아래쪽 + 영상 섹션
async function captureDetail(browser, game, files) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${SITE}/games/${game.id}`, { waitUntil: 'networkidle' });
  await page.locator('.dx-title').waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  // 오른쪽: 영상 섹션 아래 끝이 화면 아래에 닿게 스크롤 → 위쪽에 PC 사양 카드가 같이 보인다 (다른 영상 썸네일 줄은 숨겨 사양 표가 더 보이게)
  await page.addStyleTag({ content: '.video-rail { display: none !important; }' });
  const y = await page.evaluate(() => {
    const sec = [...document.querySelectorAll('section')].find((e) => e.querySelector('h3')?.textContent.trim() === '영상으로 미리 보기');
    if (!sec) return null;
    const r = sec.getBoundingClientRect();
    return Math.max(0, r.bottom + scrollY - innerHeight + 12);
  });
  if (y == null) throw new Error('영상 섹션을 못 찾았어요');
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: files.spec });
  // 왼쪽: 한 화면에 요약이 들어오게 사이 블록(뒤로가기·소개·장르 칩·다른 지표 칸·구매 버튼)을 숨긴다 — 남는 값은 그대로 사이트 값
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.addStyleTag({ content: '.back-link, .dx-lead, .dx-chips, .dx-credits, .price-card-buttons, .price-card-note, .price-card-lowest, .price-card-compare-status, .dx-trailer, .detail-main, footer { display: none !important; }' });
  await page.evaluate(() => document.querySelectorAll('.dx-tiles > li').forEach((li) => { if (li.querySelector('.dx-tile-label')?.textContent.trim() !== '인원') li.style.display = 'none'; }));
  await page.waitForTimeout(500);
  await page.screenshot({ path: files.top });
  await ctx.close();
}

fs.mkdirSync(CACHE, { recursive: true });
const slideOf = (type) => slides.find((s) => s.type === type);
const shotSlide = slideOf('screenshot');
const trendSlide = slideOf('trending');
const detailSlide = slideOf('detail-pair');
const shotFile = (n) => path.join(CACHE, `screenshot-${n}.png`);
const trendFile = (n) => path.join(CACHE, `trending-${n ?? 'auto'}.png`);
const detailKey = (slug) => String(slug ?? 'auto').replace(/[^\w.-]+/g, '_');
const detailFiles = (slug) => ({ top: path.join(CACHE, `detail-${detailKey(slug)}-top.png`), spec: path.join(CACHE, `detail-${detailKey(slug)}-spec.png`) });
const stale = (f) => refresh || !fs.existsSync(f);
const TREND_NEED = ['신작', '다시 뜨는 중'];
const browser = await chromium.launch();
try {
  const trendPeople = trendSlide?.people ? Number(trendSlide.people) : null;
  const trendCache = () => (trendPeople ? trendFile(trendPeople) : trendFile(null));
  if (slideOf('wall-cover') && stale(wallFile)) { console.log('카드 벽 캡처…'); await captureWall(browser); }
  if (shotSlide && stale(shotFile(shotPeople(shotSlide)))) { console.log('인원 추천 스크린샷 캡처…'); await capturePeople(browser, { people: shotPeople(shotSlide), chips: true, width: 480, file: shotFile }); }
  if (trendSlide && stale(trendCache())) {
    console.log('뜨는 게임 캡처…');
    await capturePeople(browser, { people: trendPeople, chips: false, width: 640, need: TREND_NEED, file: (n) => (trendPeople ? trendFile(trendPeople) : trendFile(null)) });
  }
  if (detailSlide) {
    const files = detailFiles(detailSlide.slug);
    if (stale(files.top) || stale(files.spec)) {
      console.log('게임 상세 캡처…');
      let game;
      if (detailSlide.slug) game = await resolveGame(detailSlide.slug);
      else {
        const list = await pickCandidates();
        if (!list.length) throw new Error('detail-pair 후보가 없어요 (slug를 지정하세요)');
        console.log('후보:\n' + list.slice(0, 3).map((g, i) => `  ${i + 1}. ${gameTitle(g)} (-${g.sale}%, ${g.min_players}-${g.max_players}인)`).join('\n'));
        game = list[0];
      }
      console.log(`상세: ${gameTitle(game)}`);
      await captureDetail(browser, game, files);
    }
  }

  const font = fs.readFileSync(path.join(ROOT, 'node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2')).toString('base64');
  const outDir = path.join(DIR, 'out', postId);
  fs.rmSync(outDir, { recursive: true, force: true }); // 옛 파일이 안 남게 폴더째 비움 (out/은 생성물만 있는 폴더)
  fs.mkdirSync(outDir, { recursive: true });

  const page = await browser.newPage({ viewport: SIZE });
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    const ctx = { font };
    if (s.type === 'wall-cover') ctx.wall = dataUri(wallFile);
    if (s.type === 'screenshot') ctx.screenshot = dataUri(shotFile(shotPeople(s)));
    if (s.type === 'trending') ctx.screenshot = dataUri(trendCache());
    if (s.type === 'detail-pair') { const f = detailFiles(s.slug); ctx.top = dataUri(f.top); ctx.spec = dataUri(f.spec); }
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
