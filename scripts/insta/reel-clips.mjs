// scripts/insta/reel-clips.mjs
// 개발사 원본 클립으로 만드는 세로 릴스(1080×1920) + ElevenLabs 내레이션.
// 컷 길이 = 내레이션 타이밍(copy.cuts[].endWord 어절이 끝나는 곳에서 컷 전환). 클립은 scripts/insta/assets/crack/clips/(gitignore), 컷마다 가로 크롭 위치(x0→x1)를 지정. 컷 경계는 크로스페이드 없이 바로 컷.
// 자막(레퍼런스 스타일): 한 번에 한 어절, 내레이션에서 말하는 순간 바로 바뀌고 다음 어절까지 유지. x540·y860 고정, Pretendard Bold 56px 흰색 + 검은 외곽선 3px + 약한 그림자(검정 40%, 2px 아래), 팝·강조색 없음. 정보 카드가 뜨는 동안은 자막 숨김.
// 오디오: 내레이션 -14 LUFS, 게임 소리(-14 LUFS로 맞춤)는 내레이션 중 -24 LUFS로 덕킹(내레이션 쉬는 구간·unduckAt 순간은 원래 크기). 배경음악 없음.
// 실행: node scripts/insta/reel-clips.mjs crack-trend-v2   (copy/<id>.json → out/crack-trend/reel-v2.mp4 + still-subtitle-v2.png + still-card-v2.png)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync, spawnSync } from 'child_process';
import { chromium } from 'playwright';
import { RS, ff } from './reel-single.mjs';
import { steamFacts, getNarration } from './reel-trend.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '../..');
const CLIPS = path.join(DIR, 'assets/crack/clips');
const OUT = path.join(DIR, 'out/crack-trend');
const CACHE = path.join(DIR, 'cache');
const MINT = '#5CF2B0';
const CX = RS.w / 2, SUB_Y = 860, CARD_Y = 900, SAFE_BOTTOM = RS.h * 0.75, CARD_W = 800; // 카드는 오른쪽 140px 안전 영역 안(140~940)
const CARD_IN = 0.2, CARD_SLIDE = 640;
const DUCK_DB = -10; // 게임 -14 LUFS → 내레이션 중 -24 LUFS
const T = (v) => v.toFixed(3);
const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const run = (args) => spawnSync('ffmpeg', ['-hide_banner', '-y', ...args], { encoding: 'utf8' });
const loud = (stderr) => JSON.parse(stderr.slice(stderr.lastIndexOf('{'), stderr.lastIndexOf('}') + 1));

const baseCss = (font) => `@font-face { font-family: P; src: url(data:font/woff2;base64,${font}); font-weight: 100 900; }
* { margin: 0; box-sizing: border-box; } html, body { width: ${RS.w}px; height: ${RS.h}px; background: transparent; overflow: hidden; font-family: P, sans-serif; }`;
const logoHtml = (font) => `<!doctype html><meta charset="utf-8"><style>${baseCss(font)}
.logo { position: absolute; left: 44px; top: 150px; display: flex; align-items: center; gap: 10px; opacity: 0.92; }
.logo i { width: 38px; height: 38px; border-radius: 11px; background: #fff; color: #0b0b0b; display: grid; place-items: center; font-style: normal; font-size: 27px; font-weight: 900; line-height: 1; }
.logo b { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; color: #fff; text-shadow: 0 0 8px rgba(0,0,0,.6); }
</style><div class="logo"><i>J</i><b>JamiDuNow</b></div>`;
// 자막: 56px Bold 흰색, 바깥쪽 3px 검은 외곽선(6px 선 + paint-order) + 아주 약한 그림자
const subHtml = (font, text) => `<!doctype html><meta charset="utf-8"><style>${baseCss(font)}
.sub { position: absolute; left: ${CX}px; top: ${SUB_Y}px; transform: translate(-50%, -50%); white-space: nowrap; font-size: 56px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; color: #fff; -webkit-text-stroke: 6px #000; paint-order: stroke fill; stroke-linejoin: round; text-shadow: 0 2px 0 rgba(0,0,0,.4); }
</style><div class="sub" id="s">${esc(text)}</div>`;
const cardHtml = (font, f, imgB64) => `<!doctype html><meta charset="utf-8"><style>${baseCss(font)}
.card { position: absolute; left: ${CX - CARD_W / 2}px; width: ${CARD_W}px; top: ${CARD_Y}px; transform: translateY(-50%); padding: 28px 28px 24px; border-radius: 44px; background: rgba(10,10,10,.95); border: 3px solid ${MINT}; text-align: center; color: #fff; box-shadow: 0 10px 40px rgba(0,0,0,.5); }
.card img { display: block; width: 100%; border-radius: 26px; }
.t { margin-top: 24px; font-size: 104px; font-weight: 900; letter-spacing: -0.02em; line-height: 1.05; }
.i { margin-top: 16px; font-size: 46px; font-weight: 700; line-height: 1.45; font-variant-numeric: tabular-nums; }
.i em { font-style: normal; color: ${MINT}; }
.u { margin-top: 20px; font-size: 28px; font-weight: 600; color: rgba(255,255,255,.55); letter-spacing: .02em; }
</style><div class="card" id="c"><img src="data:image/jpeg;base64,${imgB64}"><div class="t">CRACK</div>
<div class="i"><em>${esc(f.mmdd)} 출시</em> / ${esc(f.regular ?? f.price)}<br>최대 ${f.max}인 / ${esc(f.korean)}</div><div class="u">jamidunow.com</div></div>`;

const clipFile = (prefix) => {
  const hit = fs.readdirSync(CLIPS).filter((n) => n.startsWith(prefix));
  if (hit.length !== 1) throw new Error(`클립 "${prefix}" 후보 ${hit.length}개`);
  return path.join(CLIPS, hit[0]);
};
const probeDur = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

const postId = process.argv[2] ?? 'crack-trend-v2';
const copy = JSON.parse(fs.readFileSync(path.join(DIR, 'copy', `${postId}.json`), 'utf8'));
if (JSON.stringify(copy).includes('재밌드나')) throw new Error('화면에는 "재밌드나"를 쓰지 않아요.');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(CACHE, { recursive: true });

// ── 내레이션과 어절 타이밍 ──
const nar = await getNarration(OUT, copy.narration);
const words = []; // 공백으로 나눈 어절: {raw, text(표시용), start, end}
{
  let cur = null;
  nar.chars.forEach((ch, i) => {
    if (/\s/.test(ch)) { cur = null; return; }
    if (!cur) { cur = { raw: '', start: nar.starts[i], end: 0 }; words.push(cur); }
    cur.raw += ch; cur.end = nar.ends[i];
  });
  words.forEach((w) => { w.text = w.raw.replace(/[,.…]+$/g, ''); w.plain = w.raw.replace(/[^가-힣A-Za-z0-9]/g, ''); });
}
// 컷 경계: endWord(대본 순서대로 찾음)를 말한 뒤 ~ 다음 어절 시작 사이의 가운데
const cuts = [];
let cursor = 0, t0 = 0;
copy.cuts.forEach((c, i) => {
  const k = words.findIndex((w, j) => j >= cursor && w.plain === c.endWord);
  if (k < 0) throw new Error(`컷 ${i + 1}: 대본에서 어절 "${c.endWord}"를 순서대로 찾지 못했어요`);
  const last = i === copy.cuts.length - 1;
  const end = last ? words[k].end + copy.loopTail : (words[k].end + words[k + 1].start) / 2;
  cuts.push({ ...c, first: cursor, last: k, start: t0, end });
  cursor = k + 1; t0 = end;
});
const total = t0;

// ── 컷 → 클립 구간 ──
const parts = [];
cuts.forEach((c, i) => {
  let rem = c.end - c.start;
  const startOfCut = c.start;
  let acc = 0;
  c.parts.forEach((p, j) => {
    const len = j === c.parts.length - 1 ? rem : Math.min(rem, p.max ?? rem);
    if (len <= 0.01) return;
    const file = clipFile(p.clip);
    const a = p.endAt != null ? p.endAt - len : p.a;
    const cl = probeDur(file);
    if (a < 0 || a + len > cl + 0.05) throw new Error(`컷 ${i + 1}: 클립 "${p.clip}" ${a.toFixed(2)}~${(a + len).toFixed(2)}초가 원본(${cl.toFixed(1)}초) 밖이에요`);
    if (c.unduckAt != null && !(c.unduckAt >= a && c.unduckAt <= a + len)) console.warn(`  경고: 컷 ${i + 1}의 unduckAt ${c.unduckAt}초가 구간 ${a.toFixed(2)}~${(a + len).toFixed(2)}초 밖이에요`);
    if (c.unduckAt != null && c.unduckAt >= a && c.unduckAt <= a + len) c.unduckT = startOfCut + acc + (c.unduckAt - a);
    parts.push({ ...p, file, a, dur: len, cut: i });
    rem -= len; acc += len;
  });
});

const facts = await steamFacts(copy.appid, copy);
console.log('  스팀 값:', JSON.stringify({ ...facts, header: undefined }));
const cc = cuts[copy.card.cut - 1];
const c0 = words[cc.first + copy.card.afterWords].start, c1 = c0 + copy.card.sec;
console.log(`  내레이션 ${nar.duration.toFixed(2)}초(마지막 어절 ${words.at(-1).end.toFixed(2)}초) → 영상 ${total.toFixed(2)}초 · 카드 ${c0.toFixed(2)}~${c1.toFixed(2)}초`);
console.log('  컷:', cuts.map((c, i) => `${i + 1}:${c.start.toFixed(2)}~${c.end.toFixed(2)}`).join(' '));

// ── 자막 어절 타임라인(카드 동안 숨김, 빈 구간은 빈 이미지) ──
const intervals = words.map((w, i) => ({ text: w.text, start: w.start, end: i + 1 < words.length ? words[i + 1].start : Math.min(w.end + 0.4, total) }));
const shown = [];
let tl = 0;
const push = (text, a, b) => { if (b - a > 0.001) shown.push({ text, start: a, end: b }); };
// 0초부터 마지막까지 빈틈없이: 어절 사이/앞/뒤는 빈 화면(text null)
intervals.forEach((iv) => {
  push(null, tl, iv.start);
  const a = iv.start, b = iv.end;
  if (b <= c0 || a >= c1) push(iv.text, a, b);
  else { push(iv.text, a, Math.min(b, c0)); push(null, Math.max(a, c0), Math.min(b, c1)); if (b > c1) push(iv.text, c1, b); }
  tl = b;
});
push(null, tl, total);
// 카드 구간 자체도 빈 화면(어절이 없는 구간 포함) — 겹친 항목 정리
const timeline = [];
for (const s of shown.sort((x, y) => x.start - y.start)) {
  const prev = timeline.at(-1);
  if (prev && s.start < prev.end - 1e-6) s.start = prev.end;
  if (s.end > s.start + 1e-6) timeline.push(s);
}

const font = fs.readFileSync(path.join(ROOT, 'node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2')).toString('base64');
const imgB64 = Buffer.from(await (await fetch(facts.header)).arrayBuffer()).toString('base64');
const logoPng = path.join(CACHE, 'clips-logo.png'), cardPng = path.join(CACHE, 'clips-card.png'), blankPng = path.join(CACHE, 'clips-blank.png');
const subDir = path.join(CACHE, 'clips-subs');
fs.rmSync(subDir, { recursive: true, force: true }); fs.mkdirSync(subDir, { recursive: true });
const browser = await chromium.launch();
const imgFor = new Map();
try {
  const page = await browser.newPage({ viewport: { width: RS.w, height: RS.h } });
  const full = { x: 0, y: 0, width: RS.w, height: RS.h };
  const load = async (html) => { await page.setContent(html, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready); };
  await load(logoHtml(font)); await page.screenshot({ path: logoPng, clip: full, omitBackground: true });
  await load('<!doctype html><body style="background:transparent">'); await page.screenshot({ path: blankPng, clip: full, omitBackground: true });
  for (const s of timeline) {
    if (s.text == null || imgFor.has(s.text)) continue;
    await load(subHtml(font, s.text));
    const r = await page.evaluate(() => { const b = document.getElementById('s').getBoundingClientRect(); return { w: b.width }; });
    if (r.w > RS.w - 80) throw new Error(`자막 "${s.text}"가 화면 폭을 넘어요`);
    const file = path.join(subDir, `${imgFor.size}.png`);
    await page.screenshot({ path: file, clip: full, omitBackground: true });
    imgFor.set(s.text, file);
  }
  await load(cardHtml(font, facts, imgB64));
  const cr = await page.evaluate(() => { const b = document.getElementById('c').getBoundingClientRect(); return [Math.round(b.right), Math.round(b.bottom)]; });
  if (cr[0] > RS.w - RS.rightGap || cr[1] > SAFE_BOTTOM) throw new Error('정보 카드가 안전 영역을 넘어요');
  await page.screenshot({ path: cardPng, clip: full, omitBackground: true });
} finally { await browser.close(); }
const list = path.join(CACHE, 'clips-subs.txt');
fs.writeFileSync(list, timeline.map((s) => `file '${(s.text == null ? blankPng : imgFor.get(s.text)).replaceAll("'", "'\\''")}'\nduration ${T(s.end - s.start)}`).join('\n') + `\nfile '${blankPng}'\n`);

// ── 영상: 구간을 1920 높이로 맞춰 가로 크롭(x0→x1 선형 이동) → 이어 붙임 → 워터마크 → 자막(어절 이미지 시퀀스) → 카드 ──
const { w, h, fps } = RS, n = parts.length;
const vin = parts.flatMap((p) => ['-ss', T(p.a), '-t', T(p.dur), '-i', p.file]);
const oin = [
  ['-loop', '1', '-framerate', String(fps), '-t', T(total), '-i', logoPng],
  ['-f', 'concat', '-safe', '0', '-i', list],
  ['-itsoffset', T(c0), '-loop', '1', '-framerate', String(fps), '-t', T(copy.card.sec + 0.1), '-i', cardPng],
].flat();
const vf = parts.map((p, i) => `[${i}:v]scale=-2:${h},crop=${w}:${h}:x='(iw-${w})*(${p.x0}+(${p.x1 - p.x0})*min(1,t/${T(p.dur)}))':y=0,setsar=1,fps=${fps}[s${i}]`);
const g = [
  `${vf.join(';')};${parts.map((_, i) => `[s${i}]`).join('')}concat=n=${n}:v=1:a=0[v0]`,
  `[v0][${n}:v]overlay=format=auto[v1]`,
  `[${n + 1}:v]fps=${fps},format=rgba[sub]`,
  `[v1][sub]overlay=x=0:y=0:eof_action=pass:format=auto[v2]`,
  `[v2][${n + 2}:v]overlay=x=0:y='if(lt(t-${T(c0)},${CARD_IN}),${CARD_SLIDE}*pow(1-(t-${T(c0)})/${CARD_IN},2),0)':eof_action=pass:enable='between(t,${T(c0)},${T(c1)})':format=auto,format=yuv420p[o]`,
];
const silent = path.join(CACHE, 'clips-silent.mp4');
ff(['-filter_threads', '1', ...vin, ...oin, '-filter_complex', g.join(';'), '-map', '[o]', '-an', '-t', T(total), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', silent]);

// ── 오디오 ──
// 1) 게임 소리: 구간 소리를 이어 붙이고(구간 끝 5ms 페이드) 2패스 loudnorm -14 LUFS
const af = parts.map((p, i) => `[${i}:a]aresample=48000,aformat=channel_layouts=stereo,afade=t=in:d=0.005,afade=t=out:st=${T(p.dur - 0.005)}:d=0.005[a${i}]`);
const rawWav = path.join(CACHE, 'clips-audio-raw.wav'), gameWav = path.join(CACHE, 'clips-audio-game.wav');
ff([...vin, '-filter_complex', `${af.join(';')};${parts.map((_, i) => `[a${i}]`).join('')}concat=n=${n}:v=0:a=1[o]`, '-map', '[o]', '-c:a', 'pcm_s16le', rawWav]);
const gm = loud(run(['-i', rawWav, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']).stderr);
const lnArg = (m) => `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
ff(['-i', rawWav, '-af', lnArg(gm), '-ar', '48000', '-c:a', 'pcm_s16le', gameWav]);
// 2) 내레이션 -14 LUFS + 게임 소리를 말하는 구간에 -10dB(≈-24 LUFS)로 덕킹. 말 사이 0.3초 넘는 쉼과 unduckAt(폭발 등) 순간은 원래 크기
const nm = loud(run(['-i', nar.mp3, '-af', 'aresample=48000,aformat=channel_layouts=stereo,loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']).stderr);
const DUCK = Math.pow(10, DUCK_DB / 20);
const win = [];
nar.chars.forEach((ch, i) => { if (/\s/.test(ch)) return; const last = win.at(-1); if (last && nar.starts[i] - last[1] <= 0.3) last[1] = nar.ends[i]; else win.push([nar.starts[i], nar.ends[i]]); });
const gw = win.map(([a, b]) => `clip(min((t-(${T(a - 0.1)}))/0.1,(${T(b + 0.2)}-t)/0.2),0,1)`).reduce((x, y) => `max(${x},${y})`);
const un = cuts.filter((c) => c.unduckT != null).map((c) => `clip(min((t-(${T(c.unduckT - 0.2)}))/0.08,(${T(c.unduckT + 0.6)}-t)/0.2),0,1)`).reduce((x, y) => `max(${x},${y})`, '0');
const vol = `1-${(1 - DUCK).toFixed(4)}*(${gw})*(1-${un})`;
const m4a = path.join(CACHE, 'clips-audio.m4a');
const fc = `[0:a]aresample=48000,aformat=channel_layouts=stereo,${lnArg(nm)},apad=whole_dur=${T(total)}[n];[1:a]volume='${vol}':eval=frame[g];[g][n]amix=inputs=2:duration=longest:normalize=0,atrim=0:${T(total)}[o]`;
const mr = run(['-i', nar.mp3, '-i', gameWav, '-filter_complex', fc, '-map', '[o]', '-c:a', 'aac', '-b:a', '192k', m4a]);
if (mr.status !== 0) throw new Error(`오디오 믹스 실패\n${mr.stderr.slice(-600)}`);
console.log(`  내레이션 ${nm.input_i} → -14 LUFS · 게임 ${gm.input_i} → -14 LUFS, 말 구간 ${DUCK_DB}dB(≈-24 LUFS), 덕킹 구간 ${win.length}개${cuts.some((c) => c.unduckT != null) ? `, 원래 크기 순간 ${cuts.filter((c) => c.unduckT != null).map((c) => c.unduckT.toFixed(2)).join('/')}초` : ''}`);

const mp4 = path.join(OUT, 'reel-v2.mp4');
ff(['-i', silent, '-i', m4a, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-movflags', '+faststart', '-shortest', mp4]);
// 정지 이미지: 자막 장면(다이너마이트를 말하는 순간), 정보 카드(다 올라온 뒤)
const dyn = words.find((x) => x.plain === '다이너마이트');
ff(['-ss', T(dyn.start + 0.3), '-i', mp4, '-frames:v', '1', path.join(OUT, 'still-subtitle-v2.png')]);
ff(['-ss', T(c0 + 1.0), '-i', mp4, '-frames:v', '1', path.join(OUT, 'still-card-v2.png')]);
const dur = probeDur(mp4);
const fin = loud(run(['-i', mp4, '-af', 'loudnorm=I=-14:print_format=json', '-f', 'null', '-']).stderr);
console.log(`${path.relative(ROOT, mp4)} (${dur.toFixed(2)}초, 최종 믹스 ${fin.input_i} LUFS)`);
