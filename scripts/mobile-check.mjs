// scripts/mobile-check.mjs
// 모바일 화면 자동 점검: 가로 스크롤 · 화면 밖으로 넘치는 요소 · 44px 미만 터치 영역을 찾아 표로 출력
// 실행: node scripts/mobile-check.mjs                                  (기본 https://game-info-hub.vercel.app)
//       node scripts/mobile-check.mjs https://새도메인
//       node scripts/mobile-check.mjs http://localhost:3000
// - 스크린샷은 scripts/.cache/mobile-check/<시각>/ 에 저장 (gitignore 됨)
// - 글쓰기·의견함·의견 달기는 화면만 열고 입력·제출은 하지 않는다 (DB에 아무것도 쓰지 않음)
// - 비교는 /compare(빈 화면)만 연다. ?ids=를 붙이면 AI 점수 계산(비용·하루 한도 사용)이 돌 수 있어서
// - 가로 스크롤이 하나라도 있으면 종료 코드 1
// 처음 한 번: npm ci (playwright 1.63 — 브라우저가 없으면 npx playwright install chromium)
import fs from 'fs';
import { chromium } from 'playwright';

const SITE = (process.argv[2] || 'https://game-info-hub.vercel.app').replace(/\/$/, '');
const VIEWPORTS = [
  { name: '375', width: 375, height: 812 },
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
];
const MIN_TOUCH = 44;
const OUT = `scripts/.cache/mobile-check/${new Date().toISOString().replace(/[:.]/g, '-')}`;

// 주소가 그때그때 달라지는 페이지(게임·글)는 사이트에서 직접 찾는다
async function discover(browser) {
  const page = await browser.newPage();
  const found = { withVideo: null, noVideo: null, post: null };
  try {
    // 카드는 브라우저에서 그려지므로 링크가 생길 때까지 기다린다. 메인 게임은 대부분 영상이 있어서 검색 결과(무료·전체)까지 모은다
    const games = new Set();
    for (const path of ['/', '/?r=1&free=1', '/?r=1']) {
      await page.goto(SITE + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('a[href^="/games/"]', { timeout: 30000 }).catch(() => {});
      for (const h of await page.$$eval('a[href^="/games/"]', (as) => as.map((a) => a.getAttribute('href').split(/[?#]/)[0]))) {
        if (/^\/games\/[^/]+$/.test(h)) games.add(h);
      }
    }
    // 상세 HTML은 서버에서 그려지므로 브라우저 없이 요청만으로 영상 칸 여부를 본다
    for (const href of [...games].slice(0, 60)) {
      if (found.withVideo && found.noVideo) break;
      const html = await (await page.request.get(SITE + href, { timeout: 30000 })).text().catch(() => '');
      if (!html) continue;
      const hasVideo = html.includes('video-section');
      if (hasVideo && !found.withVideo) found.withVideo = href;
      if (!hasVideo && !found.noVideo) found.noVideo = href;
    }
    await page.goto(SITE + '/community', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('a[href^="/community/post/"]', { timeout: 15000 }).catch(() => {});
    found.post = await page.$eval('a[href^="/community/post/"]', (a) => a.getAttribute('href')).catch(() => null);
  } finally {
    await page.close();
  }
  return found;
}

// 페이지 안에서 실행: 문제 요소 찾기 (scope가 있으면 그 영역 안만)
function inspect({ minTouch, scope }) {
  const vw = document.documentElement.clientWidth;
  const root = scope ? document.querySelector(scope) : document.body;
  if (!root) return { hscroll: 0, overflow: [], small: [], missing: true };

  const label = (el) => {
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    const text = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim().slice(0, 20);
    return `${el.tagName.toLowerCase()}${id}${cls}${text ? ` "${text}"` : ''}`;
  };
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  // 가로 스크롤 영역(캐러셀 등)이나 잘라내는 부모 안에 있으면 의도된 넘침으로 본다
  const clipped = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'hidden' || ox === 'auto' || ox === 'scroll' || ox === 'clip') return true;
    }
    return false;
  };

  const hscroll = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - vw;

  const overflow = [];
  for (const el of root.querySelectorAll('*')) {
    if (!visible(el) || clipped(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) {
      // 이미 잡힌 부모 안의 자식은 빼고 가장 바깥 요소만
      if (overflow.some((o) => o.el.contains(el))) continue;
      overflow.push({ el, desc: `${label(el)} (left ${Math.round(r.left)}, right ${Math.round(r.right)}, 화면 ${vw})` });
    }
  }

  const small = [];
  const targets = root.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [onclick]');
  for (const el of targets) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    // 문장 속 글자 링크는 WCAG 예외 (블록 안에 다른 글자와 섞인 inline 링크)
    if (el.tagName === 'A' && s.display === 'inline' && el.parentElement && el.parentElement.innerText.trim() !== el.innerText.trim()) continue;
    const r = el.getBoundingClientRect();
    if (r.width < minTouch || r.height < minTouch) {
      small.push({ desc: `${label(el)} (${Math.round(r.width)}×${Math.round(r.height)})` });
    }
  }

  return { hscroll: hscroll > 1 ? hscroll : 0, overflow: overflow.map((o) => o.desc), small: small.map((s) => s.desc) };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  console.log(`\n모바일 점검: ${SITE}\n점검할 게임·글 찾는 중...`);
  const f = await discover(browser);

  const pages = [
    { name: '메인', path: '/' },
    { name: '검색 결과', path: '/?r=1&q=' + encodeURIComponent('협동') },
    f.withVideo ? { name: '게임 상세(영상 있음)', path: f.withVideo } : null,
    f.noVideo ? { name: '게임 상세(영상 없음)', path: f.noVideo } : null,
    { name: '비교', path: '/compare' },
    { name: '커뮤니티 목록', path: '/community' },
    f.post ? { name: '커뮤니티 글', path: f.post } : null,
    { name: '글쓰기', path: '/community/write' },
    (f.noVideo || f.withVideo) ? { name: '의견 달기', path: f.noVideo || f.withVideo, scope: '.detail-section-v2:has(.cm-opinion-form)' } : null,
    { name: '의견함', path: '/feedback' },
    { name: '소개', path: '/about' },
    { name: 'FAQ', path: '/faq' },
  ].filter(Boolean);
  if (!f.withVideo) console.log('  ⚠️  영상 있는 게임을 찾지 못해 건너뜀');
  if (!f.noVideo) console.log('  ⚠️  영상 없는 게임을 찾지 못해 건너뜀');
  if (!f.post) console.log('  ⚠️  커뮤니티 글이 없어 건너뜀');

  const rows = [];
  const details = [];
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      isMobile: vp.width < 768,
      hasTouch: true,
      locale: 'ko-KR',
    });
    const page = await ctx.newPage();
    const seen = new Set(); // 헤더·푸터처럼 페이지마다 반복되는 요소는 자세히 목록에서 한 번만
    for (const p of pages) {
      const shot = `${OUT}/${vp.name}-${p.name.replace(/[^\p{L}\p{N}]+/gu, '_')}.png`;
      let res;
      try {
        await page.goto(SITE + p.path, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
        // 늦게 뜨는 이미지·차트를 위해 끝까지 한 번 내렸다 올림
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(500);
        res = await page.evaluate(inspect, { minTouch: MIN_TOUCH, scope: p.scope || null });
        if (p.scope && !res.missing) await page.locator(p.scope).first().screenshot({ path: shot });
        else await page.screenshot({ path: shot, fullPage: true });
      } catch (e) {
        res = { error: e.message.split('\n')[0] };
      }
      rows.push({
        화면: vp.name,
        페이지: p.name,
        가로스크롤: res.error ? '오류' : res.missing ? '영역 없음' : res.hscroll ? `❌ ${res.hscroll}px` : '✅',
        넘침: res.overflow?.length ?? '-',
        '작은 터치': res.small?.length ?? '-',
      });
      if (res.error) details.push({ vp: vp.name, page: p.name, kind: '오류', items: [res.error] });
      for (const [kind, list] of [['넘침', res.overflow], [`${MIN_TOUCH}px 미만`, res.small]]) {
        if (!list?.length) continue;
        const fresh = list.filter((x) => !seen.has(kind + x));
        list.forEach((x) => seen.add(kind + x));
        if (fresh.length) details.push({ vp: vp.name, page: p.name, kind, items: fresh, repeated: list.length - fresh.length });
      }
    }
    await ctx.close();
  }
  await browser.close();

  console.log('\n[요약]');
  console.table(rows);

  if (details.length) {
    console.log('\n[자세히] (페이지마다 최대 10개, 같은 화면 크기의 앞 페이지에서 이미 나온 요소는 생략)');
    for (const d of details) {
      console.log(`\n${d.vp} · ${d.page} · ${d.kind} 새로 ${d.items.length}개${d.repeated ? ` (앞과 같은 ${d.repeated}개 생략)` : ''}`);
      console.table(d.items.slice(0, 10).map((x) => ({ 요소: x })));
    }
  }

  console.log(`\n스크린샷: ${OUT}/`);
  console.log('점검한 주소:', pages.map((p) => `${p.name} ${p.path}`).join(' · '));
  if (rows.some((r) => String(r.가로스크롤).startsWith('❌'))) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
