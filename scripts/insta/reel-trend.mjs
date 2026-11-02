// scripts/insta/reel-trend.mjs
// --reel-trend: 신작·화제작 세로 릴스(1080×1920, 약 25초). 트레일러가 화면 전체를 채우고(가운데 크롭) 가운데 단어 자막 7비트 + 정보 카드 + 루프(첫 컷·끝 컷이 같은 장면)
// 레이아웃: 영상 전체 화면 · 로고는 왼쪽 위 작은 워터마크 · 자막/카드는 가운데 y≈900, 오른쪽 140px·아래 25%(y>1440)는 비움(가로 기준 x 470 = 오른쪽 140px을 뺀 폭의 가운데)
// 자막: 흰색 Extra Bold 90px + 검은 외곽선 7px, 최대 2줄·줄당 10자 안팎(어절 단위). 비트당 (전체 길이 - 카드 시간) / 비트 수 초
// 정보 카드: beats[cardAfterBeat - 1] 다음에 cardSec초(자막은 그동안 숨김). 가격·인원·한국어는 스팀 appdetails(kr) 값, copy.maxPlayers가 있으면 인원만 덮어씀
// 오디오: 트레일러 원본(컷 경계 0.1초 크로스페이드, -14 LUFS, 끝 0.8초 페이드아웃)
// 실행: npm run insta -- <post-id> --reel-trend   (문구·구간은 copy/<post-id>.json → out/<post-id>/reel.mp4 + still-subtitle.png + still-card.png)
// copy: appid, movie(스팀 영상 이름), segments([시작초, 끝초] 목록), endClip(첫 컷과 같은 장면), beats(7개 문구, 줄바꿈은 \n으로 직접 지정 가능), cardAfterBeat(기본 5), cardSec(기본 2.5), cardTitle(기본 스팀 이름), maxPlayers(선택)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { chromium } from 'playwright';
import { RS, ff, buildAudio, trailerAudioFromDb, steamMovie } from './reel-single.mjs';
import { trailerFromDb } from './reel.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '../..');
const MINT = '#5CF2B0';
const CX = (RS.w - RS.rightGap) / 2; // 자막·카드 가운데 x = 470
const SUB_Y = 900; // 자막·카드 가운데 y
const SAFE_BOTTOM = RS.h * 0.75; // 1440
const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// 어절 단위 줄바꿈: 10자 이하면 1줄, 넘으면 두 줄의 긴 쪽이 가장 짧아지는 지점에서 나눈다. \n이 있으면 그대로 쓴다
export function wrapBeat(text, max = 10) {
  if (text.includes('\n')) return text.split('\n');
  const words = text.split(' ');
  if ([...text].length <= max || words.length < 2) return [text];
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    const w = Math.max([...a].length, [...b].length);
    if (!best || w < best.w) best = { w, lines: [a, b] };
  }
  return best.lines;
}

// 스팀 appdetails(kr) — 가격(정가)·출시일·한국어·최대 인원. DB에 없는 게임도 쓸 수 있게 스팀에서 직접 읽는다
export async function steamFacts(appid, copy) {
  const get = async (l) => (await (await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&l=${l}&cc=kr`)).json())[appid]?.data;
  const [d, en] = [await get('koreana'), await get('english')];
  if (!d || !en) throw new Error(`--reel-trend: 스팀 appdetails를 못 받았어요 (${appid})`);
  const rel = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/.exec(d.release_date?.date ?? '');
  const po = d.price_overview;
  const price = d.is_free ? '무료' : po ? `₩${Math.round(po.initial / 100).toLocaleString('ko-KR')}` : null;
  const kor = /Korean(<strong>\*<\/strong>)?/.exec(en.supported_languages ?? '');
  const range = /(\d+)\s*~\s*(\d+)\s*인/.exec(d.short_description ?? '');
  const max = copy.maxPlayers ?? (range ? Number(range[2]) : null);
  if (!rel || !price || !kor || !max) throw new Error(`--reel-trend: 출시일·가격·한국어·인원 중 빠진 게 있어요 ${JSON.stringify({ rel: !!rel, price, kor: !!kor, max })} (인원은 copy.maxPlayers로 지정)`);
  return { name: en.name, header: d.header_image, mmdd: `${rel[2].padStart(2, '0')}.${rel[3].padStart(2, '0')}`, price, sale: po?.discount_percent > 0 ? `${po.discount_percent}% 할인 중 ₩${Math.round(po.final / 100).toLocaleString('ko-KR')}` : null, korean: kor[1] ? '한국어 자막+더빙' : '한국어 자막', max, moviesCount: d.movies?.length ?? 0 };
}

const baseCss = (font) => `@font-face { font-family: P; src: url(data:font/woff2;base64,${font}); font-weight: 100 900; }
* { margin: 0; box-sizing: border-box; } html, body { width: ${RS.w}px; height: ${RS.h}px; background: transparent; overflow: hidden; font-family: P, sans-serif; }`;

const logoHtml = (font) => `<!doctype html><meta charset="utf-8"><style>${baseCss(font)}
.logo { position: absolute; left: 44px; top: 150px; display: flex; align-items: center; gap: 10px; opacity: 0.92; }
.logo i { width: 38px; height: 38px; border-radius: 11px; background: #fff; color: #0b0b0b; display: grid; place-items: center; font-style: normal; font-size: 27px; font-weight: 900; line-height: 1; }
.logo b { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; color: #fff; text-shadow: 0 0 8px rgba(0,0,0,.6); }
</style><div class="logo"><i>J</i><b>JamiDuNow</b></div>`;

// 자막: 흰 글씨 + 검은 외곽선 7px(바깥쪽). 글줄 묶음의 세로 가운데가 y=900
const subHtml = (font, lines) => `<!doctype html><meta charset="utf-8"><style>${baseCss(font)}
.sub { position: absolute; left: 0; width: ${RS.w - RS.rightGap}px; top: ${SUB_Y}px; transform: translateY(-50%); text-align: center; white-space: nowrap; font-size: 90px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.2; color: #fff; -webkit-text-stroke: 14px #000; paint-order: stroke fill; stroke-linejoin: round; }
</style><div class="sub" id="s">${lines.map(esc).join('<br>')}</div>`;

// 정보 카드: 둥근 검은 카드 + 민트 포인트. 대표 이미지(스팀 header) · 이름 · 정보 2줄 · 아래 작게 jamidunow.com
const cardHtml = (font, f, title, imgB64) => `<!doctype html><meta charset="utf-8"><style>${baseCss(font)}
.card { position: absolute; left: ${CX - 380}px; width: 760px; top: ${SUB_Y}px; transform: translateY(-50%); padding: 28px 28px 24px; border-radius: 44px; background: rgba(10,10,10,.95); border: 3px solid ${MINT}; text-align: center; color: #fff; box-shadow: 0 10px 40px rgba(0,0,0,.5); }
.card img { display: block; width: 100%; border-radius: 26px; }
.t { margin-top: 24px; font-size: 92px; font-weight: 900; letter-spacing: -0.02em; line-height: 1.05; }
.i { margin-top: 14px; font-size: 40px; font-weight: 700; line-height: 1.45; font-variant-numeric: tabular-nums; }
.i em { font-style: normal; color: ${MINT}; }
.u { margin-top: 18px; font-size: 24px; font-weight: 600; color: rgba(255,255,255,.55); letter-spacing: .02em; }
</style><div class="card" id="c"><img src="data:image/jpeg;base64,${imgB64}"><div class="t">${esc(title)}</div>
<div class="i"><em>${esc(f.mmdd)} 출시</em> / ${esc(f.price)}<br>최대 ${f.max}인 / ${esc(f.korean)}</div><div class="u">jamidunow.com</div></div>`;

export async function runReelTrend(postId, { refresh = false } = {}) {
  const copyFile = path.join(DIR, 'copy', `${postId}.json`);
  if (!fs.existsSync(copyFile)) throw new Error(`--reel-trend: ${path.relative(ROOT, copyFile)}이 없어요`);
  const copy = JSON.parse(fs.readFileSync(copyFile, 'utf8'));
  if (JSON.stringify(copy).includes('재밌드나')) throw new Error('화면에는 "재밌드나"를 쓰지 않아요. JamiDuNow만 쓰세요.');
  const beats = copy.beats ?? [];
  if (beats.length !== 7) throw new Error('--reel-trend: beats는 7개여야 해요');
  const after = copy.cardAfterBeat ?? 5, cardSec = copy.cardSec ?? 2.5;
  const facts = await steamFacts(copy.appid, copy);
  const title = copy.cardTitle ?? facts.name;
  console.log('  스팀 값:', JSON.stringify({ ...facts, header: undefined }));

  const CACHE = path.join(DIR, 'cache');
  fs.mkdirSync(CACHE, { recursive: true });
  const src = await steamMovie({ name: facts.name, steam_appid: copy.appid }, copy.movie);
  const trailer = await trailerFromDb(src, CACHE, refresh);
  const parts = [...copy.segments, copy.endClip];
  const total = parts.reduce((t, [a, b]) => t + b - a, 0);
  const d = (total - cardSec) / beats.length; // 비트당 길이
  const win = beats.map((_, i) => { const s = i < after ? i * d : i * d + cardSec; return [s, s + d]; });
  const cardWin = [after * d, after * d + cardSec];
  console.log(`  총 ${total.toFixed(2)}초 · 비트당 ${d.toFixed(2)}초 · 카드 ${cardWin[0].toFixed(2)}~${cardWin[1].toFixed(2)}초`);

  const outDir = path.join(DIR, 'out', postId);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const font = fs.readFileSync(path.join(ROOT, 'node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2')).toString('base64');
  const imgB64 = Buffer.from(await (await fetch(facts.header)).arrayBuffer()).toString('base64');

  const shot = async (page, html, file, sel) => {
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const r = sel ? await page.evaluate((q) => { const b = document.querySelector(q).getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; }, sel) : null;
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: RS.w, height: RS.h }, omitBackground: true });
    return r;
  };
  const overlays = [];
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: RS.w, height: RS.h } });
    const wm = path.join(CACHE, `trend-${postId}-logo.png`);
    await shot(page, logoHtml(font), wm);
    overlays.push({ file: wm, from: 0, to: total });
    for (let i = 0; i < beats.length; i++) {
      const lines = wrapBeat(beats[i]);
      if (lines.length > 2 || lines.some((l) => [...l].length > 11)) throw new Error(`--reel-trend: "${beats[i]}"는 2줄·줄당 10자 안팎을 넘어요`);
      const f = path.join(CACHE, `trend-${postId}-sub${i}.png`);
      const r = await shot(page, subHtml(font, lines), f, '#s');
      console.log(`  자막 ${i + 1}: ${lines.join(' / ')}  영역 ${JSON.stringify(r)}`);
      if (r[2] > RS.w - RS.rightGap || r[0] < 0 || r[3] > SAFE_BOTTOM) throw new Error(`--reel-trend: 자막 ${i + 1}이 안전 영역(오른쪽 140px·아래 25%)을 넘어요`);
      overlays.push({ file: f, from: win[i][0], to: win[i][1] });
    }
    const cf = path.join(CACHE, `trend-${postId}-card.png`);
    const cr = await shot(page, cardHtml(font, facts, title, imgB64), cf, '#c');
    console.log(`  카드 영역 ${JSON.stringify(cr)}`);
    if (cr[2] > RS.w - RS.rightGap || cr[3] > SAFE_BOTTOM) throw new Error('--reel-trend: 정보 카드가 안전 영역을 넘어요');
    overlays.push({ file: cf, from: cardWin[0], to: cardWin[1] });
  } finally { await browser.close(); }

  // 영상: 구간 이어 붙이고 1920 높이로 맞춘 뒤 가운데 크롭(1080×1920), 워터마크·자막·카드를 시간대별로 얹는다
  const { w, h, fps } = RS;
  const n = parts.length;
  const inputs = parts.flatMap(([a, b]) => ['-ss', String(a), '-t', String(b - a), '-i', trailer]);
  const ovIn = overlays.flatMap((o) => ['-loop', '1', '-framerate', String(fps), '-t', total.toFixed(3), '-i', o.file]);
  const scaled = parts.map((_, i) => `[${i}:v]scale=-2:${h},crop=${w}:${h}:(iw-${w})/2:0,setsar=1,fps=${fps}[s${i}]`);
  let chain = '[v]';
  const ov = overlays.map((o, i) => { const out = `[o${i}]`; const s = `${chain}[${n + i}:v]overlay=format=auto:enable='between(t,${o.from.toFixed(3)},${o.to.toFixed(3)})'${out}`; chain = out; return s; });
  const fc = `${scaled.join(';')};${parts.map((_, i) => `[s${i}]`).join('')}concat=n=${n}:v=1:a=0[v];${ov.join(';')};${chain}format=yuv420p[o]`;
  const silent = path.join(CACHE, `trend-${postId}-silent.mp4`);
  ff([...inputs, ...ovIn, '-filter_complex', fc, '-map', '[o]', '-an', '-t', total.toFixed(3), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', silent]);

  const m4a = path.join(CACHE, `trend-${postId}-audio.m4a`);
  const { measured } = buildAudio({ audio: await trailerAudioFromDb(src, CACHE, refresh), copy: { segments: copy.segments, endClip: copy.endClip }, out: m4a });
  const mp4 = path.join(outDir, 'reel.mp4');
  ff(['-i', silent, '-i', m4a, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-movflags', '+faststart', '-shortest', mp4]);

  // 정지 이미지: 자막 장면(곡괭이 비트 가운데) 1장, 정보 카드 1장
  const subAt = (win[2][0] + win[2][1]) / 2, cardAt = (cardWin[0] + cardWin[1]) / 2;
  ff(['-ss', subAt.toFixed(2), '-i', mp4, '-frames:v', '1', path.join(outDir, 'still-subtitle.png')]);
  ff(['-ss', cardAt.toFixed(2), '-i', mp4, '-frames:v', '1', path.join(outDir, 'still-card.png')]);
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString());
  console.log(`${path.relative(ROOT, mp4)} (${dur.toFixed(2)}초, 원본 오디오 측정 ${measured} LUFS → -14 LUFS, 구간 경계 0.1초 크로스페이드)`);
  console.log(path.relative(ROOT, path.join(outDir, 'still-subtitle.png')), path.relative(ROOT, path.join(outDir, 'still-card.png')));
}
