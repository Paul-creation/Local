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
const slides = JSON.parse(raw).flatMap((s) => (s.type === 'detail-split' ? Array.from({ length: s.slides ?? 1 }, (_, part) => ({ ...s, part, parts: s.slides ?? 1 })) : [s])); // detail-split 한 줄 = slides장
if (!Array.isArray(slides) || slides.length === 0) { console.error('json은 슬라이드 배열이어야 해요.'); process.exit(1); }

// 첫 방문자 투어(jdn_tour_v2)가 화면을 덮어 클릭을 막으니, 투어를 건너뛴 상태로 시작한다
async function newContext(browser, opts) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(() => { try { localStorage.setItem('jdn_tour_v2', JSON.stringify({ status: 'skipped', step: 0 })); } catch { /* 저장소 없음 */ } });
  return ctx;
}

const dataUri = (file) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
const wallFile = path.join(CACHE, 'wall.png');

// 메인 히어로 표지 벽만 남기고 4:5(1080×1350) 6열×5줄로 다시 깔아 찍는다 — 가운데 크롭 대신 처음부터 4:5로 그려 해상도를 지킨다
async function captureWall(browser) {
  const page = await (await newContext(browser, { viewport: { width: SIZE.width, height: SIZE.height } })).newPage();
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
//  chips: 인원 칩 줄부터 카드까지(아니면 카드만). people이 없으면 배지 조건(need)에 맞는 인원을 찾을 때까지 2~5인을 훑고, 칩도 그 인원이 선택된 상태
async function capturePeople(browser, { people, chips, width, need = [], file }) {
  const ctx = await newContext(browser, { viewport: { width, height: 900 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
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

// 게임 상세 페이지 모바일 캡처 4조각(deviceScaleFactor 3): 인원 / 가격·역대 최저가 / PC 사양 표 / 영상 썸네일
// 각 조각은 해당 요소(들)의 상자만 clip으로 찍는다 — 카드가 따로 테두리를 두르니 섹션 자체의 테두리·여백은 뺀다
async function captureDetail(browser, game, files) {
  const ctx = await newContext(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${SITE}/games/${game.id}`, { waitUntil: 'networkidle' });
  await page.locator('.dx-title').waitFor({ timeout: 30000 });
  await page.addStyleTag({ content: 'html, body, .mn-inner { background: #121212 !important; } .price-card-buttons, .price-card-note, .price-card-compare-status, .pcs-raw { display: none !important; }' });
  await page.waitForTimeout(1000);
  // 각 조각 = 요소 선택자 목록의 합친 상자 (JS에서 찾아 문서 좌표로 돌려준다)
  const clipOf = (find) => page.evaluate((src) => {
    const els = new Function(`return (${src})()`)();
    if (!els.length) return null;
    const rs = els.map((e) => e.getBoundingClientRect());
    const l = Math.min(...rs.map((r) => r.left)), t = Math.min(...rs.map((r) => r.top));
    return { x: l + scrollX, y: t + scrollY, width: Math.max(...rs.map((r) => r.right)) - l, height: Math.max(...rs.map((r) => r.bottom)) - t };
  }, find.toString());
  const parts = {
    people: () => [...document.querySelectorAll('.dx-tile')].filter((e) => e.querySelector('.dx-tile-label')?.textContent.trim() === '인원'),
    price: () => ['.price-card-head', '.price-card-was', '.price-card-now', '.lowest-gauge'].flatMap((q) => [...document.querySelectorAll(q)]),
    spec: () => [...document.querySelectorAll('.pcs-table tbody')],
    video: () => ['.video-stage', '.video-stage-info'].flatMap((q) => [...document.querySelectorAll(q)]),
  };
  for (const [name, find] of Object.entries(parts)) {
    let clip = await clipOf(find);
    if (!clip) throw new Error(`상세 페이지에 "${name}" 부분이 없어요 (${game.name})`);
    await page.evaluate((y) => window.scrollTo(0, y - 200), clip.y);
    await page.waitForFunction((c) => [...document.querySelectorAll('img')].filter((i) => { const r = i.getBoundingClientRect(); return r.bottom + scrollY > c.y && r.top + scrollY < c.y + c.height; }).every((i) => i.complete && i.naturalWidth > 0), clip, { timeout: 30000 });
    await page.waitForTimeout(400);
    clip = await clipOf(find);
    await page.screenshot({ path: files[name], clip, fullPage: true });
  }
  await ctx.close();
}

// 게임 상세 페이지 전체를 모바일(폭 430, deviceScaleFactor 3)로 찍어 1000px 높이 띠(band)들로 cache에 저장한다 (한 번에 fullPage로 찍으면 16384px 한도를 넘음)
// 이 게임 정보가 아닌 부분(상단 메뉴·뒤로가기·푸터·시리즈·비슷한 게임·의견 달기 입력)만 숨기고 나머지는 전부 남긴다
const SPLIT_W = 430;
const BAND = 1000;
const splitFiles = (slug) => ({ json: path.join(CACHE, `split-${detailKey(slug)}.json`), band: (i) => path.join(CACHE, `split-${detailKey(slug)}-${i}.png`) });
async function captureSplit(browser, game, files, split) {
  const ctx = await newContext(browser, { viewport: { width: SPLIT_W, height: 900 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${SITE}/games/${game.id}`, { waitUntil: 'networkidle' });
  await page.locator('.dx-title').waitFor({ timeout: 30000 });
  await page.addStyleTag({ content: '.site-header, .back-link, footer, .similar-section, .series-section { display: none !important; }' });
  await page.evaluate(() => [...document.querySelectorAll('section')].forEach((e) => { if (e.querySelector('h3')?.textContent.trim() === '의견 달기') e.style.display = 'none'; }));
  // 끝까지 천천히 내려 lazy 이미지를 받는다
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < total; y += 600) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(120); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => [...document.querySelectorAll('main img')].filter((i) => i.getBoundingClientRect().height > 0).every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 })
    .catch(async () => console.warn('경고: 안 받아진 이미지가 있어요:', await page.evaluate(() => [...document.querySelectorAll('main img')].filter((i) => i.getBoundingClientRect().height > 0 && !(i.complete && i.naturalWidth > 0)).map((i) => i.currentSrc || i.src).slice(0, 5))));
  await page.waitForTimeout(800);
  // 단계별로 숨길 부분을 늘려 가며, 페이지 전체가 slides×columns 조각에 100% 들어갈 때까지 줄인다 (반드시 남길 것: 커버·제목, 인원, 가격·할인·역대 최저가, PC 사양, 대표 영상 1개)
  await page.evaluate(() => {
    const sec = (t) => [...document.querySelectorAll('.detail-main > section')].find((e) => e.querySelector('h3')?.textContent.trim().startsWith(t));
    sec('소개')?.setAttribute('data-hide', 'intro');
    for (const t of ['같이 하기', '할인 전적']) sec(t)?.setAttribute('data-hide', 'misc');
    const video = sec('영상으로 미리 보기');
    video?.setAttribute('data-keep', '1');
    document.querySelector('.pcs-card')?.setAttribute('data-keep', '1');
    [...document.querySelectorAll('.dx-tile')].forEach((li) => { if (li.querySelector('.dx-tile-label')?.textContent.trim() !== '인원') li.setAttribute('data-hide', 'tiles'); });
  });
  const LEVELS = [
    { name: '긴 소개글', css: '[data-hide="intro"]' },
    { name: '장르 칩', css: '.dx-chips' },
    { name: '다른 영상 썸네일 줄', css: '.video-rail-wrap' },
    { name: '투표', css: '.dx-votes' },
    { name: '트레일러·스크린샷·링크 줄', css: '.dx-trailer, .shots, .detail-links' },
    { name: '인원 외 지표 칸(평가·동접·플레이 시간·진입장벽·한국어·역대 최저가 칸)', css: '[data-hide="tiles"]' },
    { name: '같이 하기·ITAD 순위·정보 행·할인 전적·더 자세히', css: '[data-hide="misc"], .steam-card, .info-row, .detail-two' },
    { name: '그 밖의 섹션·한 줄 소개·개발사 줄·구매 버튼·안내 문구·PC 사양 설명·원문 사양', css: '.detail-main > *:not([data-keep]):not(.detail-price), .dx-lead, .dx-credits, .price-card-buttons, .price-card-note, .price-card-compare-status, .pcs-sub, .pcs-raw' },
  ];
  const measure = () => page.evaluate(() => {
    const m = document.querySelector('main');
    const units = [...m.querySelectorAll(':scope > header.dx-head, :scope > ul.dx-tiles, .detail-price, .detail-main > *')].filter((e) => e.getBoundingClientRect().height > 0);
    const tops = units.map((e) => Math.round(e.getBoundingClientRect().top + scrollY));
    const last = units[units.length - 1].getBoundingClientRect();
    // 자르면 안 되는 덩어리(글줄·제목·카드·썸네일 등)의 세로 범위와 제목 위치
    const box = (e) => { const r = e.getBoundingClientRect(); return [r.top + scrollY, r.bottom + scrollY]; };
    const inUnits = (e) => units.some((u) => u.contains(e));
    const atoms = [...m.querySelectorAll('*')].filter((e) => !e.children.length || e.matches('h1, h2, h3, p, li, img, picture, button, a, dt, dd, tr, svg, canvas, .dx-tile, .dx-badges > *, .dx-chips > *, .chip, .video-stage, .video-stage-info, .lowest-gauge, .price-card-was, .price-card-now, .detail-links > *'))
      .filter((e) => inUnits(e) && e.getBoundingClientRect().height > 0).map(box).map(([a, b]) => [Math.round(a), Math.round(b)]);
    // 제목: h2·h3, 그리고 h가 아닌 섹션 제목(예: 할인 전적)도 잡도록 detail-main 안의 큼직한 굵은 짧은 글자
    const isHead = (e) => e.matches('h2, h3') || (e.closest('.detail-main') && !e.children.length && e.textContent.trim().length < 20 && parseFloat(getComputedStyle(e).fontSize) >= 20 && parseInt(getComputedStyle(e).fontWeight, 10) >= 600);
    const heads = [...m.querySelectorAll('*')].filter((e) => isHead(e) && inUnits(e) && e.getBoundingClientRect().height > 0).map((e) => Math.round(e.getBoundingClientRect().bottom + scrollY));
    const vis = (e, q) => [...e.querySelectorAll(q)].filter((x) => x.getBoundingClientRect().height > 0).map((x) => x.textContent.trim());
    const kept = units.map((e) => e.matches('header.dx-head') ? '커버·제목' : e.matches('ul.dx-tiles') ? `지표 칸(${vis(e, '.dx-tile-label').join('·')})` : e.matches('.detail-price') ? 'Steam 가격·할인·역대 최저가'
      : vis(e, 'h1, h2, h3, .dx-tile-label')[0] || (e.className.toString().includes('info-row') ? '마지막 업데이트·필요 용량 줄' : e.className.toString().includes('steam-card') ? 'ITAD 순위·도전과제·가족 공유·DLC' : e.textContent.trim().slice(0, 14)));
    return { bounds: tops, atoms, heads, kept, end: Math.round(last.bottom + scrollY) + 16 };
  });
  const hidden = ['상단 메뉴', '뒤로가기', '푸터', '시리즈(다른 게임)', '비슷한 게임(다른 게임 추천)', '의견 달기 입력'];
  let layout = null;
  for (let lv = 0; lv <= LEVELS.length; lv++) {
    if (lv > 0) { await page.addStyleTag({ content: `${LEVELS[lv - 1].css} { display: none !important; }` }); hidden.push(LEVELS[lv - 1].name); await page.waitForTimeout(150); }
    layout = await measure();
    const { covered } = planSplit({ width: SPLIT_W, ...layout, height: layout.end }, split.parts, split.columns);
    if (covered >= layout.end) break;
    if (lv === LEVELS.length) throw new Error(`숨길 수 있는 부분을 다 숨겨도 ${split.parts}장 × ${split.columns}단에 안 들어가요. 남은 구획: ${layout.kept.join(' / ')}`);
  }
  const { bounds, atoms, heads, end, kept } = layout;
  console.log(`숨긴 것: ${hidden.join(', ')}\n남긴 것: ${kept.join(', ')}`);
  const bands = [];
  for (let y = 0, i = 0; y < end; y += BAND, i++) {
    const h = Math.min(BAND, end - y);
    await page.screenshot({ path: files.band(i), clip: { x: 0, y, width: SPLIT_W, height: Math.min(h + 2, (await page.evaluate(() => document.documentElement.scrollHeight)) - y) }, fullPage: true });
    bands.push({ y, h });
  }
  fs.writeFileSync(files.json, JSON.stringify({ width: SPLIT_W, height: end, bounds, atoms, heads, bands, hidden, kept }));
  await ctx.close();
}

// 상세 캡처를 slides장 × columns단 조각으로 위에서부터 이어 나눈다. 조각 높이는 단 폭에 맞춘 배율로 정해지고,
// 조각 끝은 구획 경계로 옮긴다(절반 이상 찼을 때). 그래도 구획이 조각보다 크면 그 자리에서 자른다.
const CANVAS_W = 1080;
const SIDE = 72;
const COL_GAP = 24;
const AREA_BOTTOM = 1170; // 로고·넘김 표시·jamidunow.com 줄 위
const areaTop = (part) => (part === 0 ? 280 : 110); // 첫 장은 라벨 아래, 나머지는 페이지 번호 아래
function planSplit(layout, slidesN, cols) {
  const outerW = (CANVAS_W - SIDE * 2 - COL_GAP * (cols - 1)) / cols;
  const W = outerW - 3;
  const sc = W / layout.width;
  const plan = [];
  let y = 0;
  let hardCuts = 0;
  for (let part = 0; part < slidesN; part++) {
    const areaH = AREA_BOTTOM - areaTop(part);
    const cap = (areaH - 3) / sc;
    const pieces = [];
    for (let c = 0; c < cols; c++) {
      const ideal = y + cap;
      let end;
      if (ideal >= layout.height) end = layout.height;
      else {
        // 글줄·카드·썸네일 한가운데가 아니고, 제목이 조각 맨 끝에 혼자 남지 않는 가장 아래 자리 (구획·덩어리 사이 빈틈)
        const okCut = (c) => !layout.atoms.some(([a, b]) => a - 1 < c && c < b + 1) && !layout.heads.some((h) => h - 6 <= c && c - h < 60);
        let b = null;
        for (let c = Math.floor(ideal); c > y + cap * 0.3; c--) if (okCut(c)) { b = c; break; }
        if (b != null) { let lo = b; while (lo - 1 > y + cap * 0.3 && okCut(lo - 1)) lo--; end = Math.round((lo + b) / 2); } // 빈틈의 가운데에서 자른다
        else { end = ideal; hardCuts++; }
      }
      if (y >= layout.height) { pieces.push(null); continue; }
      pieces.push({ y0: y, y1: end, sc, W, outerW, areaH });
      y = end;
    }
    plan.push(pieces);
  }
  return { plan, covered: y, hardCuts };
}

fs.mkdirSync(CACHE, { recursive: true });
const slideOf = (type) => slides.find((s) => s.type === type);
const shotSlide = slideOf('screenshot');
const detailSlide = slideOf('detail-grid');
const splitSlide = slideOf('detail-split');
const shotPeople = (s) => (s.people ? Number(s.people) : null); // 비우면 배지가 다 보이는 인원을 자동으로 찾는다
const shotFile = (n) => path.join(CACHE, `screenshot-${n ?? 'auto'}.png`);
const detailKey = (slug) => String(slug ?? 'auto').replace(/[^\w.-]+/g, '_');
const DETAIL_PARTS = ['people', 'price', 'spec', 'video'];
const detailFiles = (slug) => Object.fromEntries(DETAIL_PARTS.map((p) => [p, path.join(CACHE, `detail-${detailKey(slug)}-${p}.png`)]));
const stale = (f) => refresh || !fs.existsSync(f);
const SHOT_NEED = ['요즘 뜨는 중', '다시 뜨는 중', '신작'];
const browser = await chromium.launch();
try {
  if (slideOf('wall-cover') && stale(wallFile)) { console.log('카드 벽 캡처…'); await captureWall(browser); }
  if (shotSlide && stale(shotFile(shotPeople(shotSlide)))) {
    console.log('인원 추천 스크린샷 캡처…');
    await capturePeople(browser, { people: shotPeople(shotSlide), chips: true, width: 640, need: SHOT_NEED, file: () => shotFile(shotPeople(shotSlide)) });
  }
  let splitLayout = null;
  if (splitSlide) {
    const sf = splitFiles(splitSlide.slug);
    if (stale(sf.json)) {
      console.log('게임 상세 전체 캡처…');
      const game = splitSlide.slug ? await resolveGame(splitSlide.slug) : (await pickCandidates())[0];
      if (!game) throw new Error('detail-split 게임을 못 찾았어요 (slug를 지정하세요)');
      console.log(`상세: ${gameTitle(game)}`);
      await captureSplit(browser, game, sf, { parts: splitSlide.parts, columns: splitSlide.columns ?? 1 });
    }
    splitLayout = JSON.parse(fs.readFileSync(sf.json, 'utf8'));
    if (splitLayout.hidden) console.log(`숨긴 것: ${splitLayout.hidden.join(', ')}\n남긴 것: ${splitLayout.kept.join(', ')}`);
    const { plan, covered, hardCuts } = planSplit(splitLayout, splitSlide.parts, splitSlide.columns ?? 1);
    splitLayout.planned = plan;
    const pct = Math.round((covered / splitLayout.height) * 100);
    console.log(`상세 나누기: ${splitSlide.parts}장 × ${splitSlide.columns ?? 1}단 → 페이지의 ${pct}% 표시 (${Math.round(covered)}/${splitLayout.height}px)${hardCuts ? `, 구획 중간에서 자른 곳 ${hardCuts}곳` : ''}`);
    if (covered < splitLayout.height) {
      for (let n = splitSlide.parts + 1; n <= 40; n++) if (planSplit(splitLayout, n, splitSlide.columns ?? 1).covered >= splitLayout.height) { console.warn(`경고: 이 배율로 페이지 전체를 보이려면 ${n}장 × ${splitSlide.columns ?? 1}단이 필요해요 (뒤쪽 ${100 - pct}%는 빠짐)`); break; }
    }
  }
  if (detailSlide) {
    const files = detailFiles(detailSlide.slug);
    if (DETAIL_PARTS.some((p) => stale(files[p]))) {
      console.log('게임 상세 캡처…');
      let game;
      if (detailSlide.slug) game = await resolveGame(detailSlide.slug);
      else {
        const list = await pickCandidates();
        if (!list.length) throw new Error('detail-grid 후보가 없어요 (slug를 지정하세요)');
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
    if (s.type === 'detail-split') {
      const sf = splitFiles(s.slug);
      ctx.split = { first: s.part === 0, last: s.part === s.parts - 1, top: areaTop(s.part), areaH: AREA_BOTTOM - areaTop(s.part), gap: COL_GAP, side: SIDE,
        pieces: splitLayout.planned[s.part].filter(Boolean).map((p) => ({
          W: p.W, outerW: p.outerW, h: (p.y1 - p.y0) * p.sc,
          imgs: splitLayout.bands.map((b, i) => ({ b, i })).filter(({ b }) => b.y + b.h > p.y0 && b.y < p.y1).map(({ b, i }) => ({ src: dataUri(sf.band(i)), top: (b.y - p.y0) * p.sc, w: p.W })),
        })) };
    }
    if (s.type === 'detail-grid') { const f = detailFiles(s.slug); ctx.parts = Object.fromEntries(DETAIL_PARTS.map((p) => [p, dataUri(f[p])])); }
    if ((s.type === 'photo-cover' || s.type === 'game-card') && s.image) {
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
