// scripts/insta/site-demo.mjs
// 릴스 끝에 넣는 "사이트 소개 애니메이션"(약 6초, 1080×1920, 30fps): jamidunow.com 홈에서 게임을 검색 → 결과를 눌러 상세로 → 부드럽게 스크롤
// 실제 사이트를 Playwright Chromium(모바일 390×693, deviceScaleFactor 1080/390)으로 열고, 화면 녹화 대신 프레임마다 상태(줌·타이핑·탭 효과·스크롤)를 직접 정해 page.screenshot으로 30fps를 한 장씩 찍어 ffmpeg로 묶는다
// 실행: node scripts/insta/site-demo.mjs --game <id> --query "<검색어>" --label "<표시 이름>" [--out <폴더>] [--base https://jamidunow.com]
//   → out/<label 슬러그>/site-demo.mp4(H.264 High 8Mbps 30fps bt709, 무음) + site-demo-scene2/4/6.png
// --reel-trend --site-demo는 renderSiteDemo()의 raw(crf 10 중간 파일)를 가져다 쓴다(copy.siteDemo = {game, query, label})
// 장면: 0~0.5 홈(줌 1.00→1.03) · 0.5~0.8 검색창 탭 · 0.8~1.9 타이핑(글자당 약 0.08초, 불규칙) · 1.9~2.4 결과 드롭다운 + 결과 줄 탭(2.1~) · 2.4~2.7 상세로 0.3초 크로스페이드 · 2.7~5.3 상세 스크롤(타일에서 0.4초 멈춤) · 5.3~5.6 정지 · 5.6~6.0 페이드아웃
// 안내 문구(Pretendard Bold 48px·외곽선 3px·위쪽 y 300·검정 70% 알약 배경, 860px 넘으면 두 줄)는 DOM이 아니라 별도 PNG로 올려서 줌·크로스페이드와 무관하게 고정
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { execFileSync, spawnSync } from 'child_process';
import { chromium } from 'playwright';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '../..');
const W = 1080, H = 1920, FPS = 30, VW = 390, VH = 693, DSF = W / VW;
export const DEMO_SEC = 6;
const T = { zoomEnd: 0.5, tap1: 0.5, typeStart: 0.8, typeEnd: 1.82, tap2: 2.1, tapDur: 0.3, xfade0: 2.4, xfade1: 2.7, scroll0: 2.7, hold0: 3.6, hold1: 4.0, scroll1: 5.3, fade0: 5.6, end: 6.0 };
const TOUR_OFF = JSON.stringify({ status: 'done', step: 0 }); // app/lib/tour.ts: localStorage jdn_tour_v2 — 사용 가이드 말풍선 끄기

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - (1 - clamp01(x)) ** 3;
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); }; // ease-in-out
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '');

// 글자마다 나타나는 시각(사람처럼 약간 불규칙, 글자 사이 0.065~0.1초 → 전체를 typeStart~typeEnd에 맞춘다). 시드를 고정해 항상 같은 박자
export function typingTimes(text) {
  const n = [...text].length, rnd = mulberry32(7);
  const gaps = Array.from({ length: n - 1 }, () => 0.065 + rnd() * 0.035);
  const sum = gaps.reduce((a, b) => a + b, 0), span = Math.min(T.typeEnd - T.typeStart, n * 0.08), k = sum > 0 ? span / sum : 1; // 글자당 약 0.08초(길면 구간 안으로 압축)
  let t = T.typeStart;
  return [t, ...gaps.map((g) => (t += g * k))];
}

const PREP_CSS = `html{scrollbar-width:none!important}::-webkit-scrollbar{display:none!important}
*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important;scroll-behavior:auto!important}`;

async function waitImages(page, ms = 20000) { // 이미지가 다 로드될 때까지(lazy는 즉시 로드로 바꿔서)
  await page.evaluate(() => { document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; }); });
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && (i.naturalWidth > 0 || !i.currentSrc)), null, { timeout: ms }).catch(() => { console.warn('  경고: 이미지 일부가 제때 로드되지 않았어요'); });
  await page.evaluate(() => Promise.all([...document.images].map((i) => (i.decode ? i.decode().catch(() => {}) : null))));
  await page.evaluate(() => document.fonts.ready);
}
const raf2 = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
async function prep(page) {
  await page.addStyleTag({ content: PREP_CSS });
  await page.evaluate(() => { const d = document.createElement('div'); d.id = '__tap'; d.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;border-radius:50%;pointer-events:none;z-index:2147483647;background:rgba(255,255,255,.55);box-shadow:0 0 0 2px rgba(255,255,255,.8);opacity:0;transform:translate(-50%,-50%)'; document.body.appendChild(d); });
}
const setZoom = (page, s) => page.evaluate((s) => { const e = document.documentElement; e.style.transformOrigin = `${innerWidth / 2}px 0px`; e.style.transform = s === 1 ? '' : `scale(${s})`; }, s);
// 탭 효과: 누른 순간 작은 흰 점 → 지름이 커지며 옅어지는 원(손가락 터치 느낌). p: 0~1(탭 시작부터), null이면 숨김
const setTap = (page, pt, p) => page.evaluate(([pt, p]) => {
  const d = document.getElementById('__tap');
  if (p === null || p < 0 || p > 1) { d.style.opacity = '0'; return; }
  const r = 7 + 53 * (1 - (1 - p) ** 3);
  d.style.cssText += `;left:${pt.x}px;top:${pt.y}px;width:${2 * r}px;height:${2 * r}px;opacity:${(0.8 * (1 - p) ** 1.3).toFixed(3)}`;
}, [pt, p]);

// 안내 문구: Pretendard Bold 48px 흰 글씨 + 검은 외곽선 3px(바깥쪽: 6px 선 + paint-order), 뒤에 검정 70% 알약 배경(좌우 여백 32px, 둥근 모서리).
// 위치: 화면 위쪽 y 300(인스타 상단 메뉴 바로 아래 — 아래 35%는 캡션 영역이라 피한다). 가로는 오른쪽 버튼 줄(140px)을 피해 가운데 x 470, 문구 폭 최대 860px — 한 줄이 넘치면 두 줄로 나눈다(줄바꿈 위치는 text에 \n)
// 2배 해상도로 그려 절반으로 줄여 합성
const CAPTION_Y = 300, CAPTION_CX = (W - 140) / 2, CAPTION_MAX_W = 860, CAPTION_PAD_X = 32;
async function captionPng(file, lines) { // lines: 한 줄짜리 [text] 또는 두 줄 [a, b]. 한 줄이 860px를 넘으면 두 줄 쪽을 쓴다
  const font = fs.readFileSync(path.join(ROOT, 'node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2')).toString('base64');
  const b = await chromium.launch();
  try {
    const page = await (await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 })).newPage();
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>@font-face{font-family:P;src:url(data:font/woff2;base64,${font});font-weight:100 900}
*{margin:0}html,body{width:${W}px;height:${H}px;background:transparent;overflow:hidden;font-family:P,sans-serif}
.pill{position:absolute;left:${CAPTION_CX}px;top:${CAPTION_Y}px;transform:translate(-50%,-50%);padding:18px ${CAPTION_PAD_X}px;background:rgba(0,0,0,.7);border-radius:44px;text-align:center}
.t{display:block;white-space:nowrap;font-size:48px;font-weight:700;letter-spacing:-0.02em;line-height:1.3;color:#fff;-webkit-text-stroke:6px #000;paint-order:stroke fill;stroke-linejoin:round}</style><div class="pill" id="p"></div>`);
    const draw = async (ls) => page.evaluate(async (ls) => { const p = document.getElementById('p'); p.innerHTML = ''; for (const l of ls) { const e = document.createElement('span'); e.className = 't'; e.textContent = l; p.appendChild(e); } await document.fonts.ready; return Math.max(...[...p.children].map((e) => e.getBoundingClientRect().width)); }, ls);
    const oneW = await draw([lines.join(' ')]);
    const useLines = oneW <= CAPTION_MAX_W ? [lines.join(' ')] : lines;
    const textW = await draw(useLines);
    if (textW > CAPTION_MAX_W) throw new Error(`site-demo: 안내 문구 한 줄이 ${Math.round(textW)}px예요(최대 ${CAPTION_MAX_W}px) — 문구를 줄이세요`);
    const r = await page.evaluate(() => { const x = document.getElementById('p').getBoundingClientRect(); return { x: x.left, y: x.top, w: x.width, h: x.height }; });
    console.log(`  안내 문구 ${useLines.length}줄, 글자 폭 ${Math.round(textW)}px, 알약 x ${Math.round(r.x)}~${Math.round(r.x + r.w)}, y ${Math.round(r.y)}~${Math.round(r.y + r.h)}`);
    const pad = 4, x = Math.max(0, Math.floor(r.x - pad)), y = Math.floor(r.y - pad), w = Math.min(W - x, Math.ceil(r.w + pad * 2)), h = Math.ceil(r.h + pad * 2);
    await page.screenshot({ path: file, clip: { x, y, width: w, height: h }, omitBackground: true });
    return { x, y };
  } finally { await b.close(); }
}

export async function renderSiteDemo({ game, query, label, base = 'https://jamidunow.com', outDir, cacheDir = path.join(DIR, 'cache'), refresh = false, final = true }) {
  if (!game || !query || !label) throw new Error('site-demo: game·query·label이 모두 필요해요');
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });
  const key = crypto.createHash('sha1').update(JSON.stringify({ game, query, label, base, v: 2 })).digest('hex').slice(0, 10);
  const raw = path.join(cacheDir, `site-demo-${key}-raw.mp4`);
  const finalMp4 = path.join(outDir, 'site-demo.mp4');
  const stills = { 2: path.join(outDir, 'site-demo-scene2.png'), 4: path.join(outDir, 'site-demo-scene4.png'), 6: path.join(outDir, 'site-demo-scene6.png') };
  if (!refresh && fs.existsSync(raw) && !final) return { raw, sec: DEMO_SEC };
  const fdir = path.join(cacheDir, `site-demo-${key}-frames`);
  fs.rmSync(fdir, { recursive: true, force: true });
  fs.mkdirSync(fdir, { recursive: true });
  const fname = (i) => path.join(fdir, `f${String(i).padStart(4, '0')}.png`);
  const N = Math.round(DEMO_SEC * FPS);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DSF, isMobile: true, hasTouch: true, locale: 'ko-KR', colorScheme: 'dark' });
  await ctx.addInitScript((v) => { try { localStorage.setItem('jdn_tour_v2', v); } catch { /* 저장소 못 쓰면 가이드가 뜰 수 있음 */ } }, TOUR_OFF);
  const home = await ctx.newPage(), det = await ctx.newPage();
  try {
    // 준비: 홈·상세를 따로 열어 이미지가 다 로드될 때까지 기다린다. 상세는 끝까지 한 번 내려가 lazy 이미지를 불러온 뒤 맨 위로
    await home.goto(base, { waitUntil: 'networkidle' });
    await prep(home); await waitImages(home);
    const detUrl = `${base}/games/${game}`;
    const resp = await det.goto(detUrl, { waitUntil: 'networkidle' });
    if (!resp?.ok()) throw new Error(`site-demo: 상세 페이지 ${detUrl}가 ${resp?.status()}예요`);
    await prep(det); await waitImages(det);
    const scrollEnd = Math.round(await det.evaluate(() => { const h = document.getElementById('소개') ?? [...document.querySelectorAll('h2')].find((e) => e.textContent.startsWith('소개')); return h ? h.getBoundingClientRect().top + scrollY - 110 : 2400; })); // 소개 제목이 화면 위쪽에 오는 위치까지
    const tileY = Math.round(await det.evaluate(() => { const t = document.querySelector('[data-tour="stat-tiles"]'); return t ? t.getBoundingClientRect().top + scrollY - 70 : 640; })); // 타일 묶음이 헤더 밑에 오는 위치(멈추는 자리)
    for (let y = 0; y <= scrollEnd + VH; y += 500) { await det.evaluate((y) => scrollTo(0, y), y); await det.waitForTimeout(150); await waitImages(det, 8000); }
    await det.evaluate(() => scrollTo(0, 0));
    await raf2(det);
    console.log(`  스크롤: 0 → 타일 ${tileY}px(0.4초 멈춤) → 소개 ${scrollEnd}px`);

    const input = home.locator('input[role=combobox]').first();
    const ib = await input.boundingBox();
    const tapInput = { x: ib.x + ib.width / 2, y: ib.y + ib.height / 2 };
    const chars = [...query], times = typingTimes(query);
    let typed = 0, tappedRow = null;
    const settle = async () => { // 자동완성 목록이 안 바뀔 때까지(최대 1.5초)
      let prev = null, same = 0;
      for (let k = 0; k < 25 && same < 2; k++) { const cur = await home.evaluate(() => document.getElementById('search-suggest')?.innerHTML ?? ''); same = cur === prev ? same + 1 : 0; prev = cur; await home.waitForTimeout(60); }
    };
    let last = null, lastKey = '';
    for (let i = 0; i < N; i++) {
      const t = i / FPS;
      // 홈 상태: 줌, 탭 1(검색창), 타이핑, 탭 2(결과 줄)
      const zoom = 1 + 0.03 * smooth(t / T.zoomEnd);
      let mode = 'home', blend = 0, scrollY = 0;
      if (t >= T.xfade0) { mode = 'x'; blend = smooth((t - T.xfade0) / (T.xfade1 - T.xfade0)); }
      if (t >= T.xfade1) mode = 'det';
      if (mode === 'det') scrollY = t < T.hold0 ? tileY * smooth((t - T.scroll0) / (T.hold0 - T.scroll0)) : t < T.hold1 ? tileY : tileY + (scrollEnd - tileY) * smooth((t - T.hold1) / (T.scroll1 - T.hold1));
      if (mode !== 'det') {
        if (t >= T.tap1 && typed === 0 && !(await home.evaluate(() => document.activeElement?.tagName === 'INPUT'))) { await setZoom(home, zoom); const b = await input.boundingBox(); await home.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); } // 실제로 눌러 포커스
        while (typed < chars.length && t >= times[typed] - 1e-6) { const c = chars[typed++]; if (/^[\x20-\x7e]$/.test(c)) await home.keyboard.type(c); else await home.keyboard.insertText(c); await settle(); }
        if (t >= T.typeEnd && tappedRow === null) {
          await settle();
          tappedRow = await home.evaluate((lab) => {
            const items = [...document.querySelectorAll('#search-suggest .search-suggest-item')];
            const el = items.find((e) => e.textContent.toLowerCase().includes(lab.toLowerCase())) ?? items[0];
            if (!el) return false; const r = el.getBoundingClientRect(); return { x: r.left + Math.min(r.width / 2, 150), y: r.top + r.height / 2 };
          }, label);
          if (!tappedRow) throw new Error('site-demo: 검색 결과 줄을 못 찾았어요(검색어·표시 이름 확인)');
          console.log(`  결과 줄 탭 위치 (${Math.round(tappedRow.x)}, ${Math.round(tappedRow.y)}) css px`);
        }
      }
      const k = JSON.stringify([mode, zoom.toFixed(4), typed, t >= T.tap1 && t < T.tap1 + T.tapDur ? ((t - T.tap1) / T.tapDur).toFixed(3) : 0, t >= T.tap2 && t < T.tap2 + T.tapDur ? ((t - T.tap2) / T.tapDur).toFixed(3) : 0, blend.toFixed(4), scrollY.toFixed(2)]);
      if (k === lastKey) { fs.copyFileSync(last, fname(i)); continue; } // 상태가 같으면 앞 프레임 재사용
      if (mode !== 'det') {
        await setZoom(home, mode === 'x' ? 1.03 : zoom);
        const tp = t >= T.tap1 && t < T.tap1 + T.tapDur ? tapInput : tappedRow;
        const p = t >= T.tap1 && t < T.tap1 + T.tapDur ? (t - T.tap1) / T.tapDur : t >= T.tap2 && t < T.tap2 + T.tapDur ? (t - T.tap2) / T.tapDur : null;
        await setTap(home, tp ?? tapInput, p === null ? null : p);
        if (p !== null && tp === tapInput) { const b = await input.boundingBox(); await setTap(home, { x: b.x + b.width / 2, y: b.y + b.height / 2 }, p); }
        await raf2(home);
      }
      if (mode === 'x' || mode === 'det') { await det.evaluate((y) => scrollTo(0, y), scrollY); await raf2(det); }
      if (mode === 'x') {
        const a = path.join(fdir, `_a${i}.png`), b = path.join(fdir, `_b${i}.png`);
        await home.screenshot({ path: a }); await det.screenshot({ path: b });
        ff(['-i', a, '-i', b, '-filter_complex', `[0:v][1:v]blend=all_expr='A*(1-${blend.toFixed(4)})+B*${blend.toFixed(4)}'`, '-frames:v', '1', fname(i)]);
        fs.rmSync(a); fs.rmSync(b);
      } else await (mode === 'home' ? home : det).screenshot({ path: fname(i) });
      last = fname(i); lastKey = k;
      if (i % 30 === 0) console.log(`  프레임 ${i}/${N} (${t.toFixed(2)}초, ${mode}${mode === 'det' ? ` 스크롤 ${Math.round(scrollY)}` : ` 입력 ${typed}/${chars.length}`})`);
    }
  } finally { await browser.close(); }

  // 안내 문구 PNG + 인코딩: 프레임 → 문구 올리기 → 마지막 0.4초 검은 화면으로 페이드아웃 → bt709 중간 파일(crf 10)
  const capFile = path.join(cacheDir, `site-demo-${key}-caption.png`);
  const cap = await captionPng(capFile, ['jamidunow.com에서', `'${label}' 검색해보세요`]);
  const sizeOf = (f) => { const o = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f]).toString().trim().split(','); return { w: +o[0], h: +o[1] }; };
  const cs = sizeOf(capFile);
  const first = sizeOf(fname(0));
  if (first.w !== W || Math.abs(first.h - H) > 2) throw new Error(`site-demo: 프레임이 ${first.w}×${first.h}예요(1080×1920이어야 함)`); // 693×(1080/390) = 1919.08이라 스크린샷은 1919 — 아래 scale로 1920에 맞춘다(0.05% 차이)
  const g = `[0:v]scale=${W}:${H}:flags=bicubic,format=rgb24[bg];[1:v]format=rgba,scale=${cs.w / 2}:${cs.h / 2}:flags=lanczos[cap];[bg][cap]overlay=x=${cap.x}:y=${cap.y}:format=auto,fade=t=out:st=${T.fade0}:d=${T.end - T.fade0},scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[o]`;
  ff(['-framerate', String(FPS), '-i', path.join(fdir, 'f%04d.png'), '-loop', '1', '-i', capFile, '-filter_complex', g, '-map', '[o]', '-frames:v', String(N), '-r', String(FPS), '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '10', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', raw]);
  fs.rmSync(fdir, { recursive: true, force: true });
  const out = { raw, sec: DEMO_SEC };
  if (final) {
    encodeFinalSilent({ video: raw, out: finalMp4, passlog: path.join(cacheDir, `site-demo-${key}-x264pass`) });
    // 장면 2(탭)·4(결과 줄 탭)·6(타일에서 멈춘 순간) 프레임
    for (const [n, at] of [[2, T.tap1 + 0.12], [4, T.tap2 + 0.12], [6, (T.scroll0 + T.hold0 + T.hold1) / 3 + 0.2]]) ff(['-ss', at.toFixed(3), '-i', finalMp4, '-frames:v', '1', stills[n]]);
    out.final = finalMp4; out.stills = stills;
  }
  return out;
}

// 기존 릴스(reel-trend.mjs encodeInstaFinal)와 같은 설정: H.264 High · 1080×1920 · 30fps · yuv420p · BT.709 · 2-pass VBR 평균 8M/최대 10M/버퍼 16M · GOP 60 · faststart. 단독 영상은 내레이션이 없어 오디오 없음
// (reel-trend.mjs가 이 파일을 불러오므로 거꾸로 불러오지 않고 같은 값을 여기에 둔다)
function encodeFinalSilent({ video, out, passlog }) {
  const run = (a) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-y', ...a], { encoding: 'utf8' }); if (r.status !== 0) throw new Error(`site-demo: 인코딩 실패\n${r.stderr.slice(-500)}`); };
  const v = ['-vf', `scale=${W}:${H},fps=${FPS}`, '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-b:v', '8M', '-maxrate', '10M', '-bufsize', '16M',
    '-g', String(FPS * 2), '-keyint_min', String(FPS * 2), '-sc_threshold', '0', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-passlogfile', passlog];
  run(['-i', video, ...v, '-pass', '1', '-an', '-f', 'null', '/dev/null']);
  run(['-i', video, ...v, '-pass', '2', '-an', '-movflags', '+faststart', out]);
  for (const f of fs.readdirSync(path.dirname(passlog))) if (f.startsWith(path.basename(passlog))) fs.rmSync(path.join(path.dirname(passlog), f), { force: true });
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const a = process.argv.slice(2), get = (n) => { const i = a.indexOf(`--${n}`); return i >= 0 ? a[i + 1] : undefined; };
  const game = get('game'), query = get('query'), label = get('label');
  if (!game || !query || !label) { console.error('사용법: node scripts/insta/site-demo.mjs --game <id> --query "<검색어>" --label "<표시 이름>" [--out <폴더>] [--base <주소>]'); process.exit(1); }
  const outDir = path.resolve(get('out') ?? path.join(DIR, 'out', slug(label)));
  try {
    const r = await renderSiteDemo({ game, query, label, base: get('base'), outDir, refresh: true });
    console.log(path.relative(ROOT, r.final));
    for (const f of Object.values(r.stills)) console.log(path.relative(ROOT, f));
  } catch (e) { console.error(e.message); process.exit(1); }
}
