// scripts/insta/reel-clips.mjs
// 개발사 원본 클립으로 만드는 세로 릴스(1080×1920). 내레이션·BGM 없음, 클립 원본 소리 -14 LUFS.
// 클립: scripts/insta/assets/crack/clips/ (gitignore). 컷마다 가로 크롭 위치(x0→x1)를 지정한다. 컷 경계는 크로스페이드 없이 바로 컷.
// 자막: 흰색 Extra Bold 88px + 검은 외곽선 8px, 0.08초 팝(85%→100%), 최대 2줄, 핵심 단어 민트. 정보 카드는 copy.card.cut 컷에서 올라와 sec초 머문다(자막은 카드 위로).
// 실행: node scripts/insta/reel-clips.mjs crack-trend-v2   (copy/<id>.json → out/crack-trend/reel-v2.mp4 + still-subtitle-v2.png + still-card-v2.png)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync, spawnSync } from 'child_process';
import { chromium } from 'playwright';
import { RS, ff } from './reel-single.mjs';
import { steamFacts } from './reel-trend.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '../..');
const CLIPS = path.join(DIR, 'assets/crack/clips');
const OUT = path.join(DIR, 'out/crack-trend');
const MINT = '#5CF2B0';
const CX = (RS.w - RS.rightGap) / 2, SUB_Y = 900, SUB_Y_CARD = 430, SAFE_BOTTOM = RS.h * 0.75;
const POP = 0.08, POP_FROM = 0.85, CARD_IN = 0.2, CARD_SLIDE = 640;
const T = (v) => v.toFixed(3);
const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const baseCss = (font) => `@font-face { font-family: P; src: url(data:font/woff2;base64,${font}); font-weight: 100 900; }
* { margin: 0; box-sizing: border-box; } html, body { width: ${RS.w}px; height: ${RS.h}px; background: transparent; overflow: hidden; font-family: P, sans-serif; }`;
const logoHtml = (font) => `<!doctype html><meta charset="utf-8"><style>${baseCss(font)}
.logo { position: absolute; left: 44px; top: 150px; display: flex; align-items: center; gap: 10px; opacity: 0.92; }
.logo i { width: 38px; height: 38px; border-radius: 11px; background: #fff; color: #0b0b0b; display: grid; place-items: center; font-style: normal; font-size: 27px; font-weight: 900; line-height: 1; }
.logo b { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; color: #fff; text-shadow: 0 0 8px rgba(0,0,0,.6); }
</style><div class="logo"><i>J</i><b>JamiDuNow</b></div>`;
const subHtml = (font, text) => `<!doctype html><meta charset="utf-8"><style>${baseCss(font)}
.sub { position: absolute; left: ${CX}px; top: ${SUB_Y}px; transform: translate(-50%, -50%); text-align: center; white-space: nowrap; font-size: 88px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.25; color: #fff; -webkit-text-stroke: 16px #000; paint-order: stroke fill; stroke-linejoin: round; }
.sub .k { color: ${MINT}; }
</style><div class="sub" id="s">${esc(text).split(/\s*\/\s*/).map((l) => l.replace(/\[([^\]]+)\]/g, '<span class="k">$1</span>')).join('<br>')}</div>`;
const cardHtml = (font, f, imgB64) => `<!doctype html><meta charset="utf-8"><style>${baseCss(font)}
.card { position: absolute; left: ${CX - 380}px; width: 760px; top: ${SUB_Y}px; transform: translateY(-50%); padding: 28px 28px 24px; border-radius: 44px; background: rgba(10,10,10,.95); border: 3px solid ${MINT}; text-align: center; color: #fff; box-shadow: 0 10px 40px rgba(0,0,0,.5); }
.card img { display: block; width: 100%; border-radius: 26px; }
.t { margin-top: 24px; font-size: 92px; font-weight: 900; letter-spacing: -0.02em; line-height: 1.05; }
.i { margin-top: 14px; font-size: 40px; font-weight: 700; line-height: 1.45; font-variant-numeric: tabular-nums; }
.i em { font-style: normal; color: ${MINT}; }
.u { margin-top: 18px; font-size: 24px; font-weight: 600; color: rgba(255,255,255,.55); letter-spacing: .02em; }
</style><div class="card" id="c"><img src="data:image/jpeg;base64,${imgB64}"><div class="t">CRACK</div>
<div class="i"><em>${esc(f.mmdd)} 출시</em> / ${esc(f.regular ?? f.price)}<br>최대 ${f.max}인 / ${esc(f.korean)}</div><div class="u">jamidunow.com</div></div>`;

const clipFile = (prefix) => {
  const hit = fs.readdirSync(CLIPS).filter((n) => n.startsWith(prefix));
  if (hit.length !== 1) throw new Error(`클립 "${prefix}" 후보 ${hit.length}개`);
  return path.join(CLIPS, hit[0]);
};

const postId = process.argv[2] ?? 'crack-trend-v2';
const copy = JSON.parse(fs.readFileSync(path.join(DIR, 'copy', `${postId}.json`), 'utf8'));
if (JSON.stringify(copy).includes('재밌드나')) throw new Error('화면에는 "재밌드나"를 쓰지 않아요.');
fs.mkdirSync(OUT, { recursive: true });
const CACHE = path.join(DIR, 'cache');
const parts = [], cuts = [];
let t0 = 0;
copy.cuts.forEach((c, i) => {
  const start = t0;
  c.parts.forEach((p) => { parts.push({ ...p, file: clipFile(p.clip), dur: p.b - p.a, cut: i }); t0 += p.b - p.a; });
  cuts.push({ start, end: t0, text: c.text });
});
const total = t0;
const facts = await steamFacts(copy.appid, copy);
console.log('  스팀 값:', JSON.stringify({ ...facts, header: undefined }), `· 영상 ${total.toFixed(1)}초`);
const cc = cuts[copy.card.cut - 1];
const c0 = cc.start + copy.card.delay, c1 = c0 + copy.card.sec;

const font = fs.readFileSync(path.join(ROOT, 'node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2')).toString('base64');
const imgB64 = Buffer.from(await (await fetch(facts.header)).arrayBuffer()).toString('base64');
const logoPng = path.join(CACHE, 'clips-logo.png'), cardPng = path.join(CACHE, 'clips-card.png');
const subs = [];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: RS.w, height: RS.h } });
  const full = { x: 0, y: 0, width: RS.w, height: RS.h };
  const load = async (html) => { await page.setContent(html, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready); };
  await load(logoHtml(font)); await page.screenshot({ path: logoPng, clip: full, omitBackground: true });
  for (let i = 0; i < cuts.length; i++) {
    await load(subHtml(font, cuts[i].text));
    const r = await page.evaluate(() => { const b = document.getElementById('s').getBoundingClientRect(); return { w: b.width, h: b.height }; });
    if (CX + r.w / 2 > RS.w - RS.rightGap || CX - r.w / 2 < 0) throw new Error(`자막 "${cuts[i].text}"가 안전 영역을 넘어요 (${Math.round(r.w)}px)`);
    const W = Math.ceil(r.w / 2) * 2 + 64, H = Math.ceil(r.h / 2) * 2 + 64;
    const file = path.join(CACHE, `clips-sub${i}.png`);
    await page.screenshot({ path: file, clip: { x: Math.round(CX - W / 2), y: Math.round(SUB_Y - H / 2), width: W, height: H }, omitBackground: true });
    subs.push({ file, ...cuts[i] });
  }
  await load(cardHtml(font, facts, imgB64));
  const cr = await page.evaluate(() => { const b = document.getElementById('c').getBoundingClientRect(); return [Math.round(b.right), Math.round(b.bottom)]; });
  if (cr[0] > RS.w - RS.rightGap || cr[1] > SAFE_BOTTOM) throw new Error('정보 카드가 안전 영역을 넘어요');
  await page.screenshot({ path: cardPng, clip: full, omitBackground: true });
} finally { await browser.close(); }

// 영상 + 오디오: 구간마다 1920 높이로 맞춘 뒤 가로 크롭(x0→x1 선형 이동) → 이어 붙임(크로스페이드 없음)
const { w, h, fps } = RS, n = parts.length;
const vin = parts.flatMap((p) => ['-ss', T(p.a), '-t', T(p.dur), '-i', p.file]);
const oin = [
  ['-loop', '1', '-framerate', String(fps), '-t', T(total), '-i', logoPng],
  ...subs.map((c) => ['-itsoffset', T(c.start), '-loop', '1', '-framerate', String(fps), '-t', T(c.end - c.start + 0.1), '-i', c.file]),
  ['-itsoffset', T(c0), '-loop', '1', '-framerate', String(fps), '-t', T(copy.card.sec + 0.1), '-i', cardPng],
].flat();
const vf = parts.map((p, i) => `[${i}:v]scale=-2:${h},crop=${w}:${h}:x='(iw-${w})*(${p.x0}+(${p.x1 - p.x0})*min(1,t/${T(p.dur)}))':y=0,setsar=1,fps=${fps}[s${i}]`);
const g = [`${vf.join(';')};${parts.map((_, i) => `[s${i}]`).join('')}concat=n=${n}:v=1:a=0[v0]`, `[v0][${n}:v]overlay=format=auto[v1]`];
subs.forEach((c, i) => {
  const k = n + 1 + i, P = `(${POP_FROM}+${1 - POP_FROM}*min(1,max(0,(t-${T(c.start)})/${POP})))`;
  const moves = i === copy.card.cut - 1;
  g.push(`[${k}:v]format=rgba,scale=w='trunc(iw*${P}/2)*2':h='trunc(ih*${P}/2)*2':eval=frame[p${i}]`);
  g.push(`[v${i + 1}][p${i}]overlay=x='${CX}-w/2':y='${moves ? `if(between(t,${T(c0)},${T(c1)}),${SUB_Y_CARD},${SUB_Y})` : SUB_Y}-h/2':eof_action=pass:enable='between(t,${T(c.start)},${T(c.end)})':format=auto[v${i + 2}]`);
});
const kc = n + 1 + subs.length;
g.push(`[v${subs.length + 1}][${kc}:v]overlay=x=0:y='if(lt(t-${T(c0)},${CARD_IN}),${CARD_SLIDE}*pow(1-(t-${T(c0)})/${CARD_IN},2),0)':eof_action=pass:enable='between(t,${T(c0)},${T(c1)})':format=auto,format=yuv420p[o]`);
const silent = path.join(CACHE, 'clips-silent.mp4');
ff(['-filter_threads', '1', ...vin, ...oin, '-filter_complex', g.join(';'), '-map', '[o]', '-an', '-t', T(total), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', silent]);

// 오디오: 구간 소리를 이어 붙이고(구간 끝마다 5ms 페이드로 클릭 방지) 2패스 loudnorm -14 LUFS
const af = parts.map((p, i) => `[${i}:a]aresample=48000,aformat=channel_layouts=stereo,afade=t=in:d=0.005,afade=t=out:st=${T(p.dur - 0.005)}:d=0.005[a${i}]`);
const rawWav = path.join(CACHE, 'clips-audio-raw.wav');
ff([...vin, '-filter_complex', `${af.join(';')};${parts.map((_, i) => `[a${i}]`).join('')}concat=n=${n}:v=0:a=1[o]`, '-map', '[o]', '-c:a', 'pcm_s16le', rawWav]);
const m1 = spawnSync('ffmpeg', ['-hide_banner', '-i', rawWav, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
const m = JSON.parse(m1.stderr.slice(m1.stderr.lastIndexOf('{'), m1.stderr.lastIndexOf('}') + 1));
const m4a = path.join(CACHE, 'clips-audio.m4a');
ff(['-i', rawWav, '-af', `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`, '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', m4a]);
const mp4 = path.join(OUT, 'reel-v2.mp4');
ff(['-i', silent, '-i', m4a, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-movflags', '+faststart', '-shortest', mp4]);
// 정지 이미지: 자막 장면(다이너마이트 폭발), 정보 카드(다 올라온 뒤)
ff(['-ss', T(cuts[3].start + 1.9), '-i', mp4, '-frames:v', '1', path.join(OUT, 'still-subtitle-v2.png')]);
ff(['-ss', T(c0 + 1.0), '-i', mp4, '-frames:v', '1', path.join(OUT, 'still-card-v2.png')]);
const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString());
const vs = spawnSync('ffmpeg', ['-hide_banner', '-i', mp4, '-af', 'loudnorm=I=-14:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
const mm = JSON.parse(vs.stderr.slice(vs.stderr.lastIndexOf('{'), vs.stderr.lastIndexOf('}') + 1));
console.log(`${path.relative(ROOT, mp4)} (${dur.toFixed(2)}초, 소리 ${m.input_i} → 최종 ${mm.input_i} LUFS)`);
console.log('컷:', cuts.map((c) => `${c.start.toFixed(1)}~${c.end.toFixed(1)}`).join(' '), `· 카드 ${c0.toFixed(1)}~${c1.toFixed(1)}`);
