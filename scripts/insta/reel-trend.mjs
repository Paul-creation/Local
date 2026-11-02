// scripts/insta/reel-trend.mjs
// --reel-trend: 신작·화제작 세로 릴스(1080×1920, 약 25초). 트레일러가 화면 전체를 채우고(가운데 크롭) 가운데 단어 자막 7비트 + 정보 카드 + 루프(첫 컷·끝 컷이 같은 장면)
// 레이아웃: 영상 전체 화면 · 로고는 왼쪽 위 작은 워터마크 · 자막/카드는 가운데 y≈900, 오른쪽 140px·아래 25%(y>1440)는 비움(가로 기준 x 470 = 오른쪽 140px을 뺀 폭의 가운데)
// 자막: 흰색 Extra Bold 90px + 검은 외곽선 7px, 최대 2줄·줄당 10자 안팎(어절 단위). 비트당 (전체 길이 - 카드 시간) / 비트 수 초
// 정보 카드: beats[cardAfterBeat - 1] 다음에 cardSec초(자막은 그동안 숨김). 가격·인원·한국어는 스팀 appdetails(kr) 값(할인 중이면 "₩6,790 (-15%, 11/3까지)" — 종료일은 상점 페이지의 할인 타이머에서 읽고 못 찾으면 "₩6,790 (-15%)"), copy.maxPlayers가 있으면 인원만 덮어씀
// 내레이션(copy.narration = {voiceId, text, anchors[7]}): ElevenLabs with-timestamps로 만들어 out/<post-id>/narration.mp3·json에 캐시. 자막은 말하는 타이밍에 바뀌고, 카드는 "더 센 장비" 비트 뒤 내레이션 쉼에 끼운다(내레이션도 그동안 쉼). 영상 길이는 내레이션에 맞춰 컷을 비율로 줄인다. 내레이션 -14 LUFS, 게임 소리는 말 구간에서 -10dB(≈-24 LUFS)
// 오디오: 트레일러 원본(컷 경계 0.1초 크로스페이드, -14 LUFS, 끝 0.8초 페이드아웃)
// 실행: npm run insta -- <post-id> --reel-trend   (문구·구간은 copy/<post-id>.json → out/<post-id>/reel.mp4 + still-subtitle.png + still-card.png)
// copy: appid, movie(스팀 영상 이름), segments([시작초, 끝초] 목록), endClip(첫 컷과 같은 장면), beats(7개 문구, 줄바꿈은 \n으로 직접 지정 가능), cardAfterBeat(기본 5), cardSec(기본 2.5), cardTitle(기본 스팀 이름), maxPlayers(선택)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { execFileSync, spawnSync } from 'child_process';
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
  const won = (v) => `₩${Math.round(v / 100).toLocaleString('ko-KR')}`;
  let price = d.is_free ? '무료' : po ? won(po.initial) : null;
  let saleEnd = null;
  if (po?.discount_percent > 0) { // 할인 중: "₩6,790 (-15%, 11/3까지)". 종료일은 appdetails에 없어 상점 페이지의 할인 타이머(InitDailyDealTimer, 종료 시각)에서 읽고, 못 찾으면 종료일은 뺀다
    try {
      const html = await (await fetch(`https://store.steampowered.com/app/${appid}/?l=koreana&cc=kr`, { headers: { cookie: 'birthtime=0; wants_mature_content=1' } })).text();
      const ts = Number(/InitDailyDealTimer\(\s*\$DiscountCountdown,\s*(\d+)/.exec(html)?.[1]);
      if (ts > Date.now() / 1000) { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' }).formatToParts(new Date(ts * 1000)).map((x) => [x.type, x.value])); saleEnd = `${p.month}/${p.day}`; }
    } catch { /* 종료일 없이 진행 */ }
    price = `${won(po.final)} (-${po.discount_percent}%${saleEnd ? `, ${saleEnd}까지` : ''})`;
  }
  const kor = /Korean(<strong>\*<\/strong>)?/.exec(en.supported_languages ?? '');
  const range = /(\d+)\s*~\s*(\d+)\s*인/.exec(d.short_description ?? '');
  const max = copy.maxPlayers ?? (range ? Number(range[2]) : null);
  if (!rel || !price || !kor || !max) throw new Error(`--reel-trend: 출시일·가격·한국어·인원 중 빠진 게 있어요 ${JSON.stringify({ rel: !!rel, price, kor: !!kor, max })} (인원은 copy.maxPlayers로 지정)`);
  return { name: en.name, header: d.header_image, mmdd: `${rel[2].padStart(2, '0')}.${rel[3].padStart(2, '0')}`, price, regular: d.is_free ? null : po ? won(po.initial) : null, saleEnd, korean: kor[1] ? '한국어 자막+더빙' : '한국어 자막', max, moviesCount: d.movies?.length ?? 0 };
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

// ── ElevenLabs 내레이션 ──
// 내레이션 mp3·글자별 타이밍은 out/<post-id>/narration.mp3·json에 캐시(대본·목소리가 같으면 API를 다시 부르지 않는다)
async function getNarration(outDir, cfg) {
  const mp3 = path.join(outDir, 'narration.mp3'), js = path.join(outDir, 'narration.json');
  const key = crypto.createHash('sha1').update(`${cfg.voiceId}|eleven_multilingual_v2|${cfg.text}`).digest('hex');
  if (fs.existsSync(mp3) && fs.existsSync(js)) {
    const c = JSON.parse(fs.readFileSync(js, 'utf8'));
    if (c.key === key) { console.log('  내레이션: 캐시 사용(API 호출 없음)'); return { mp3, ...c }; }
  }
  try { if (!process.env.ELEVENLABS_API_KEY) process.loadEnvFile(path.join(ROOT, '.env.local')); } catch { /* .env.local 없음 */ }
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('--reel-trend: ELEVENLABS_API_KEY가 없어요(.env.local)');
  console.log(`  내레이션: ElevenLabs 호출(글자 ${[...cfg.text].length}자)`);
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${cfg.voiceId}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ text: cfg.text, model_id: 'eleven_multilingual_v2' }),
  });
  if (!r.ok) { const t = await r.text(); throw new Error(`--reel-trend: ElevenLabs ${r.status} ${t.slice(0, 300).replaceAll(apiKey, '***')}`); }
  const j = await r.json();
  const al = j.alignment;
  if (!j.audio_base64 || !al?.characters?.length) throw new Error('--reel-trend: ElevenLabs 응답에 오디오·타이밍이 없어요');
  fs.writeFileSync(mp3, Buffer.from(j.audio_base64, 'base64'));
  const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]).toString());
  const c = { key, text: cfg.text, chars: al.characters, starts: al.character_start_times_seconds, ends: al.character_end_times_seconds, duration };
  fs.writeFileSync(js, JSON.stringify(c));
  return { mp3, ...c };
}

// 비트별 자막 구간·카드 구간·전체 길이. anchors[i] = 대본에서 i번째 비트가 시작하는 말(앞에서부터 순서대로 찾는다)
// 카드는 after번째 비트 말이 끝난 뒤, 다음 비트 첫 글자 직전(말 사이 쉼 안)에 끼우고 그 뒤 내레이션은 cardSec만큼 밀린다
export function narrationTimeline(nar, anchors, after, cardSec, tail = 0.5) {
  const joined = nar.chars.join('');
  let from = 0;
  const idx = anchors.map((a) => { const k = joined.indexOf(a, from); if (k < 0) throw new Error(`--reel-trend: 대본에서 "${a}"를 못 찾았어요`); from = k + a.length; return k; });
  const st = idx.map((k) => nar.starts[k]);
  const gapStart = nar.ends[idx[after] - 1]; // 카드 앞 비트의 마지막 글자 끝
  const tb = Math.min(Math.max(gapStart + 0.03, st[after] - 0.12), st[after] - 0.02); // 내레이션을 가를 지점(말 사이 쉼 안, 다음 비트 첫 글자보다는 반드시 앞)
  const at = (i) => (i < after ? st[i] : st[i] + cardSec); // 카드 뒤 비트는 cardSec만큼 밀린다
  const total = nar.duration + cardSec + tail;
  const win = idx.map((_, i) => [i === 0 ? 0 : at(i), i === idx.length - 1 ? total : i === after - 1 ? tb : at(i + 1)]);
  const speech = [[st[0], tb], [st[after] + cardSec, nar.duration + cardSec]]; // 덕킹 구간(내레이션이 나오는 곳)
  return { win, cardWin: [tb, tb + cardSec], total, tb, speech };
}

const run = (args) => spawnSync('ffmpeg', ['-hide_banner', '-y', ...args], { encoding: 'utf8' });

// 내레이션(카드 자리 cardSec초는 무음) -14 LUFS + 게임 소리 -14 LUFS(이미 맞춤)를 내레이션 구간에서 -10dB(≈-24 LUFS)로 낮춰 섞는다
function mixNarration({ game, narr, cardSec, total, out }) {
  const DUCK = 0.316; // -10dB
  const tb = narr.tb.toFixed(3);
  const pre = `[0:a]atrim=0:${tb},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[na];[0:a]atrim=start=${tb},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[nb];anullsrc=r=48000:cl=stereo,atrim=0:${cardSec},asetpts=PTS-STARTPTS[ng];[na][ng][nb]concat=n=3:v=0:a=1`;
  const m1 = run(['-i', narr.mp3, '-filter_complex', `${pre},loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json[o]`, '-map', '[o]', '-f', 'null', '-']);
  const m = JSON.parse(m1.stderr.slice(m1.stderr.lastIndexOf('{'), m1.stderr.lastIndexOf('}') + 1));
  const ln = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  // 덕킹: 말 구간 앞 0.2초에 내려가고 뒤 0.3초에 올라오는 이득 곡선
  const g = narr.speech.map(([a, b]) => `clip(min((t-${(a - 0.2).toFixed(3)})/0.2,(${(b + 0.3).toFixed(3)}-t)/0.3),0,1)`);
  const vol = `1-${(1 - DUCK).toFixed(3)}*max(${g.join(',')})`;
  const fc = `${pre},${ln},apad=whole_dur=${total.toFixed(3)}[n];[1:a]volume='${vol}':eval=frame[g];[g][n]amix=inputs=2:duration=longest:normalize=0,atrim=0:${total.toFixed(3)},afade=t=out:st=${(total - 0.8).toFixed(2)}:d=0.8[o]`;
  const r = run(['-i', narr.mp3, '-i', game, '-filter_complex', fc, '-map', '[o]', '-c:a', 'aac', '-b:a', '192k', out]);
  if (r.status !== 0) throw new Error(`--reel-trend: 오디오 믹스 실패\n${r.stderr.slice(-600)}`);
  console.log(`  내레이션 측정 ${m.input_i} LUFS → -14 LUFS, 게임 소리 말 구간 -10dB(≈-24 LUFS)`);
}

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
  const outDir = path.join(DIR, 'out', postId);
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of ['reel.mp4', 'still-subtitle.png', 'still-card.png']) fs.rmSync(path.join(outDir, f), { force: true }); // narration.mp3·json(캐시)과 voice-samples는 남긴다

  let segments = copy.segments, win, cardWin, total, narr = null;
  if (copy.narration) { // 내레이션 모드: 자막·카드 타이밍은 내레이션 글자별 타이밍, 영상 길이는 내레이션 길이에 맞춘다
    const nar = await getNarration(outDir, copy.narration);
    const tl = narrationTimeline(nar, copy.narration.anchors, after, cardSec);
    ({ win, cardWin, total } = tl);
    narr = { ...tl, mp3: nar.mp3 };
    const endDur = copy.endClip[1] - copy.endClip[0];
    const sum = copy.segments.reduce((t, [x, y]) => t + y - x, 0);
    const f = (total - endDur) / sum; // 컷 길이를 비율로 맞춘다(줄이는 쪽은 장면 안이라 안전)
    if (f > 1.05) console.warn(`  경고: 컷을 ${f.toFixed(2)}배로 늘려요 — 장면 경계를 넘을 수 있어요`);
    segments = copy.segments.map(([x, y]) => [x, x + (y - x) * f]);
    console.log(`  내레이션 ${nar.duration.toFixed(2)}초 + 카드 ${cardSec}초 → 영상 ${total.toFixed(2)}초 (컷 ×${f.toFixed(2)})`);
  } else {
    const sum = [...copy.segments, copy.endClip].reduce((t, [x, y]) => t + y - x, 0);
    total = sum;
    const d = (total - cardSec) / beats.length; // 비트당 길이
    win = beats.map((_, i) => { const st = i < after ? i * d : i * d + cardSec; return [st, st + d]; });
    cardWin = [after * d, after * d + cardSec];
    console.log(`  총 ${total.toFixed(2)}초 · 비트당 ${d.toFixed(2)}초`);
  }
  console.log('  자막 구간:', win.map(([x, y]) => `${x.toFixed(2)}~${y.toFixed(2)}`).join(' | '), `· 카드 ${cardWin[0].toFixed(2)}~${cardWin[1].toFixed(2)}`);
  const parts = [...segments, copy.endClip];
  const font = fs.readFileSync(path.join(ROOT, 'node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2')).toString('base64');
  const imgB64 = Buffer.from(await (await fetch(facts.header)).arrayBuffer()).toString('base64');

  const shot = async (page, html, file, sel) => {
    if (html) { await page.setContent(html, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready); }
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
    await page.setContent(cardHtml(font, facts, title, imgB64), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const fit = await page.evaluate(() => { const el = document.querySelector('.i'); const max = el.clientWidth; let sz = 40; el.style.whiteSpace = 'nowrap'; el.style.display = 'inline-block'; el.style.width = 'auto'; while (el.scrollWidth > max && sz > 26) { sz -= 1; el.style.fontSize = `${sz}px`; } const ok = el.scrollWidth <= max; el.style.display = ''; el.style.width = ''; return { sz, ok }; });
    console.log(`  카드 정보 줄 ${fit.sz}px${fit.ok ? '' : ' (넘침)'}`);
    const cr = await shot(page, null, cf, '#c');
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
  const gameM4a = path.join(CACHE, `trend-${postId}-game.m4a`);
  const { measured } = buildAudio({ audio: await trailerAudioFromDb(src, CACHE, refresh), copy: { segments, endClip: copy.endClip }, out: narr ? gameM4a : m4a });
  if (narr) mixNarration({ game: gameM4a, narr, cardSec, total, out: m4a });
  const mp4 = path.join(outDir, 'reel.mp4');
  ff(['-i', silent, '-i', m4a, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-movflags', '+faststart', '-shortest', mp4]);

  // 정지 이미지: 자막 장면(곡괭이 비트 가운데) 1장, 정보 카드 1장
  const subAt = (win[2][0] + win[2][1]) / 2, cardAt = (cardWin[0] + cardWin[1]) / 2;
  ff(['-ss', subAt.toFixed(2), '-i', mp4, '-frames:v', '1', path.join(outDir, 'still-subtitle.png')]);
  ff(['-ss', cardAt.toFixed(2), '-i', mp4, '-frames:v', '1', path.join(outDir, 'still-card.png')]);
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString());
  console.log(`${path.relative(ROOT, mp4)} (${dur.toFixed(2)}초, ${narr ? '내레이션 + 덕킹한 ' : ''}원본 오디오 측정 ${measured} LUFS → -14 LUFS, 구간 경계 0.1초 크로스페이드)`);
  console.log(path.relative(ROOT, path.join(outDir, 'still-subtitle.png')), path.relative(ROOT, path.join(outDir, 'still-card.png')));
}
