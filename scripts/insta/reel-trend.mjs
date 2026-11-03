// scripts/insta/reel-trend.mjs
// --reel-trend: 신작·화제작 세로 릴스(1080×1920). 트레일러가 화면 전체를 채우고(가운데 크롭) ElevenLabs 내레이션 + 말하는 어절에 맞춰 팝으로 바뀌는 가운데 자막 + 정보 카드 + 루프(첫 컷·끝 컷이 같은 장면)
// 레이아웃: 영상 전체 화면 · 로고는 왼쪽 위 작은 워터마크 · 자막/카드는 가운데 y≈900, 오른쪽 140px·아래 25%(y>1440)는 비움(가로 기준 x 470 = 오른쪽 140px을 뺀 폭의 가운데)
// 자막: 1~2어절씩, 내레이션 글자별 타이밍(with-timestamps)에 맞춰 바뀐다. 흰색 Extra Bold 100px + 검은 외곽선 8px, 핵심 단어([ ]로 표시)는 민트. 나올 때 0.08초 동안 85%→100% 팝, 그 외 움직임·페이드 없음
// 정보 카드: 지정한 말(card.chunk) 시작에 화면 아래에서 0.2초 동안 올라와 card.sec초 머문다. 그동안 자막은 카드 위(y 430)로 비켜서 계속 나온다. 가격·인원·한국어는 스팀 appdetails(kr) 값(할인 종료가 3일 넘게 남았을 때만 "₩6,790 (-15%, 11/3까지)", 3일 이내·종료 시각 불명이면 정가만), copy.maxPlayers가 있으면 인원만 덮어씀
// 내레이션: ElevenLabs(eleven_multilingual_v2, voiceSettings) with-timestamps를 대본 통째로 한 번에 생성해 out/<post-id>/<cacheName>.mp3·json에 캐시(대본·목소리·설정이 같으면 API를 다시 부르지 않는다)
// 오디오: 배경음악 없음. 내레이션 -14 LUFS, 트레일러 원본은 -14 LUFS로 맞춘 뒤 내레이션 중에 -8dB(≈-22 LUFS)로 덕킹(말 사이 0.7초 넘는 쉼에는 원래대로), 컷 경계 0.1초 크로스페이드, 끝 0.8초 페이드아웃
// 영상 길이 = 내레이션 길이 + 1초(마지막 1초는 첫 컷과 같은 알 장면 — 루프). 컷은 copy.cuts의 t(초, 내레이션 기준)에서 바뀐다
// 실행: npm run insta -- <post-id> --reel-trend   (copy/<post-id>.json → out/<post-id>/reel.mp4 + still-subtitle.png + still-card.png)
// copy: appid, movie(스팀 영상 이름), maxPlayers(선택), cardTitle(선택), narration{voiceId, cacheName, voiceSettings, text}, chunks[](자막 어절 묶음, 대본 순서, [핵심]), card{chunk, sec}, cuts[{t, src:[시작초, 끝초]}](t=0부터), endClip(첫 컷과 같은 알 장면, 1초만 쓴다)
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
const OUTRO_GAME_TAIL = 0.3, OUTRO_PAD = 0.6; // 엔딩 길이 = 시그니처 음성 길이 + 0.6초, 게임 소리는 엔딩 진입 0.3초 안에 사라진다
const SUB_X = 540, SUB_Y = 1000; // 자막 가운데(고정)
const FG_Y = 285, FG_W = 1080, FG_H = 1350; // 영상은 원본 높이 기준 4:5로 가운데 크롭(컷마다 cut.x 0~1로 가로 위치 조정, 기본 0.5)해 y 285~1635에 두고, 위아래는 같은 영상을 크게 블러·어둡게 깐다
const FG_X = 0;
const CARD_Y = 900; // 카드 가운데 y
const SUB_Y_CARD = 430; // 카드가 떠 있는 동안 자막 y(카드 위)
const SAFE_BOTTOM = RS.h * 0.75; // 1440
const POP = 0.08, POP_FROM = 0.85, CARD_IN = 0.2, CARD_SLIDE = 640;
const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

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
  if (po?.discount_percent > 0) { // 할인 종료가 3일 넘게 남았을 때만 "₩6,790 (-15%, 11/3까지)". 3일 이내이거나 종료 시각을 못 찾으면 정가만 쓴다(영상이 올라갈 때쯤 할인이 끝나 있을 수 있어서)
    try {
      const html = await (await fetch(`https://store.steampowered.com/app/${appid}/?l=koreana&cc=kr`, { headers: { cookie: 'birthtime=0; wants_mature_content=1' } })).text();
      const ts = Number(/InitDailyDealTimer\(\s*\$DiscountCountdown,\s*(\d+)/.exec(html)?.[1]); // 종료 시각(appdetails에는 없어 상점 페이지에서 읽음)
      if (ts * 1000 - Date.now() > 3 * 864e5) { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' }).formatToParts(new Date(ts * 1000)).map((x) => [x.type, x.value])); saleEnd = `${p.month}/${p.day}`; }
    } catch { /* 종료 시각을 못 읽으면 정가 */ }
    if (saleEnd) price = `${won(po.final)} (-${po.discount_percent}%, ${saleEnd}까지)`;
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
.logo { position: absolute; left: ${FG_X + 28}px; top: ${FG_Y + 26}px; display: flex; align-items: center; gap: 10px; opacity: 0.92; }
.logo i { width: 38px; height: 38px; border-radius: 11px; background: #fff; color: #0b0b0b; display: grid; place-items: center; font-style: normal; font-size: 27px; font-weight: 900; line-height: 1; }
.logo b { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; color: #fff; text-shadow: 0 0 8px rgba(0,0,0,.6); }
</style><div class="logo"><i>J</i><b>JamiDuNow</b></div>`;

// 자막 한 덩어리: 흰 글씨 72px Black(900) + 검은 외곽선 5px(바깥쪽, 10px 선 + paint-order). [ ]로 감싼 말, 그리고 KEY_WORDS는 민트
const KEY_WORDS = ['컨닝으로', '지우개가', '무전기로', '기절시키고', '다 같이', '파이널스 위크'];
const subMark = (text) => (/\[/.test(text) ? text : KEY_WORDS.includes(text.trim()) ? `[${text.trim()}]` : text);
const subHtml = (font, text) => `<!doctype html><meta charset="utf-8"><style>${baseCss(font)}
.sub { position: absolute; left: ${SUB_X}px; top: ${SUB_Y}px; transform: translate(-50%, -50%); white-space: nowrap; font-size: 72px; font-weight: 900; letter-spacing: -0.03em; line-height: 1.2; color: #fff; -webkit-text-stroke: 10px #000; paint-order: stroke fill; stroke-linejoin: round; }
.sub .k { color: ${MINT}; }
</style><div class="sub" id="s">${esc(subMark(text)).replace(/\[([^\]]+)\]/g, '<span class="k">$1</span>')}</div>`;

// 정보 카드: 둥근 검은 카드 + 민트 포인트. 대표 이미지(스팀 header) · 이름 · 정보 2줄 · 아래 작게 jamidunow.com
const cardHtml = (font, f, title, imgB64) => `<!doctype html><meta charset="utf-8"><style>${baseCss(font)}
.card { position: absolute; left: ${CX - 380}px; width: 760px; top: ${CARD_Y}px; transform: translateY(-50%); padding: 28px 28px 24px; border-radius: 44px; background: rgba(10,10,10,.95); border: 3px solid ${MINT}; text-align: center; color: #fff; box-shadow: 0 10px 40px rgba(0,0,0,.5); }
.card img { display: block; width: 100%; border-radius: 26px; }
.t { margin-top: 24px; font-size: 92px; font-weight: 900; letter-spacing: -0.02em; line-height: 1.05; }
.i { margin-top: 14px; font-size: 40px; font-weight: 700; line-height: 1.45; font-variant-numeric: tabular-nums; }
.i em { font-style: normal; color: ${MINT}; }
.u { margin-top: 18px; font-size: 24px; font-weight: 600; color: rgba(255,255,255,.55); letter-spacing: .02em; }
</style><div class="card" id="c"><img src="data:image/jpeg;base64,${imgB64}"><div class="t">${esc(title)}</div>
<div class="i"><em>${esc(f.mmdd)} 출시</em> / ${esc(f.price)}<br>최대 ${f.max}인 / ${esc(f.korean)}</div><div class="u">jamidunow.com</div></div>`;

// ── ElevenLabs 내레이션 ──
const DEFAULT_VOICE = 'uyVNoMrnUku1dZyVEXwD';
const DEFAULT_VOICE_SETTINGS = { stability: 0.4, similarity_boost: 0.8, style: 0.15, speed: 1.2 };
// 내레이션 mp3·글자별 타이밍은 out/<post-id>/narration.mp3·json에 캐시(대본·목소리가 같으면 API를 다시 부르지 않는다)
export async function getNarration(outDir, cfg) {
  cfg = { voiceId: DEFAULT_VOICE, ...cfg, voiceSettings: { ...DEFAULT_VOICE_SETTINGS, ...cfg.voiceSettings } }; // 기본 목소리·설정(속도 1.2 = ElevenLabs 최대값). copy에서 적은 값이 우선
  const name = cfg.cacheName ?? 'narration'; // narration-v2 → out/<post-id>/narration-v2.mp3·json
  const mp3 = path.join(outDir, `${name}.mp3`), js = path.join(outDir, `${name}.json`);
  const key = crypto.createHash('sha1').update(`${cfg.voiceId}|eleven_multilingual_v2|${cfg.text}|${JSON.stringify(cfg.voiceSettings ?? null)}`).digest('hex');
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
    body: JSON.stringify({ text: cfg.text, model_id: 'eleven_multilingual_v2', ...(cfg.voiceSettings ? { voice_settings: cfg.voiceSettings } : {}) }),
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


// ── 무음 압축 + 속도(--reel-trend 기본 후처리) ──
// with-timestamps의 글자 타이밍으로 어절 사이 무음을 찾아 줄인다: 문장 안 0.18초 초과 → 0.08초, 문장 사이 0.3초 초과 → 0.18초, 마지막 문장은 어절 사이를 0.06초까지(한 호흡). 그다음 atempo 1.06배.
// 자르는 곳은 10ms 크로스페이드. 줄인 만큼·빨라진 만큼 글자 타이밍을 당겨 새 mp3(wav)·타이밍을 돌려준다. 끄려면 copy.narration.tighten=false, 값은 copy.narration.silence로 바꾼다
const SILENCE = { word: 0.18, wordTo: 0.08, sentence: 0.3, sentenceTo: 0.18, lastGap: 0.06, atempo: 1.06 }; // atempo: 무음을 줄인 뒤 전체 내레이션을 음높이 유지로 이만큼 빠르게
export function silenceSpans(nar, cfg = {}) {
  const o = { ...SILENCE, ...cfg };
  const tokens = [];
  let cur = null;
  nar.chars.forEach((c, i) => {
    if (/\s/.test(c)) { cur = null; return; }
    if (!cur) { cur = { text: '', a: null, b: null }; tokens.push(cur); }
    cur.text += c;
    if (!/[.,!?~…]/.test(c)) { cur.a ??= nar.starts[i]; cur.b = nar.ends[i]; } // 구두점은 무음을 같이 먹어서 시작·끝 계산에서 뺀다
  });
  const words = tokens.filter((t) => t.a !== null);
  let sent = 0;
  words.forEach((t) => { t.sent = sent; if (/[.!?…]$/.test(t.text)) sent++; });
  const last = words[words.length - 1].sent;
  const spans = [];
  for (let k = 0; k + 1 < words.length; k++) {
    const gap = words[k + 1].a - words[k].b, w = words[k];
    let to = null;
    if (/[.!?…]$/.test(w.text)) { if (gap > o.sentence) to = o.sentenceTo; }
    else if (w.sent === last && o.lastGap != null) { if (gap > o.lastGap) to = o.lastGap; }
    else if (gap > o.word) to = o.wordTo;
    if (to !== null) spans.push({ a: w.b + to / 2, b: words[k + 1].a - to / 2 });
  }
  return spans;
}
export function tightenNarration(outDir, nar, cfgName, cfg = {}) {
  const spans = silenceSpans(nar, cfg);
  const key = crypto.createHash('sha1').update(`${nar.key}|${JSON.stringify({ ...SILENCE, ...cfg })}`).digest('hex');
  const wav = path.join(outDir, `${cfgName}-tight.wav`), js = path.join(outDir, `${cfgName}-tight.json`);
  const tempo = { ...SILENCE, ...cfg }.atempo;
  const remap = (t) => (t - spans.reduce((s, p) => s + Math.max(0, Math.min(t, p.b) - p.a), 0)) / tempo;
  const base = (duration) => ({ mp3: wav, key, text: nar.text, chars: nar.chars, starts: nar.starts.map(remap), ends: nar.ends.map(remap), duration });
  if (fs.existsSync(wav) && fs.existsSync(js) && JSON.parse(fs.readFileSync(js, 'utf8')).key === key) { const d = JSON.parse(fs.readFileSync(js, 'utf8')); console.log(`  무음 압축: 캐시 사용(${spans.length}곳, ${d.removed.toFixed(2)}초 줄임)`); return { ...base(d.duration), removed: d.removed }; }
  const X = 0.01; // 크로스페이드 10ms: 조각 끝에 10ms를 더 떠서, 겹친 만큼을 보충한다
  const edges = [0, ...spans.flatMap((p) => [p.a, p.b]), nar.duration];
  const pieces = [];
  for (let i = 0; i < edges.length; i += 2) pieces.push([edges[i], edges[i + 1]]);
  const inputs = pieces.flatMap(([a, b], i) => ['-ss', a.toFixed(4), '-t', (b - a + (i < pieces.length - 1 ? X : 0)).toFixed(4), '-i', nar.mp3]);
  const cut = pieces.map((_, i) => `[${i}:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS[a${i}]`);
  let chain = '[a0]';
  const xf = [];
  for (let i = 1; i < pieces.length; i++) { xf.push(`${chain}[a${i}]acrossfade=d=${X}:c1=tri:c2=tri[x${i}]`); chain = `[x${i}]`; }
  const r = run([...inputs, '-filter_complex', `${cut.join(';')}${xf.length ? ';' + xf.join(';') : ''};${chain}atempo=${tempo}[t]`, '-map', '[t]', '-c:a', 'pcm_s16le', wav]);
  if (r.status !== 0) throw new Error(`--reel-trend: 무음 압축 실패\n${r.stderr.slice(-500)}`);
  const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav]).toString());
  const removed = nar.duration - duration; // 무음 + 속도로 줄어든 전체 길이
  fs.writeFileSync(js, JSON.stringify({ key, duration, removed }));
  console.log(`  무음 압축 ${spans.length}곳 + atempo ${tempo}: ${nar.duration.toFixed(2)}초 → ${duration.toFixed(2)}초(${removed.toFixed(2)}초 줄임)`);
  return { ...base(duration), removed };
}

const run = (args) => spawnSync('ffmpeg', ['-hide_banner', '-y', ...args], { encoding: 'utf8' });
const chunkPlain = (c) => c.replace(/[\[\]\s.,!?~]/g, '');

// 자막 덩어리를 내레이션 글자 타이밍에 붙인다(공백·문장부호 빼고 대본 순서대로 찾음). 덩어리는 다음 덩어리가 시작할 때까지(최대 자기 말이 끝난 뒤 0.4초) 보인다
export function chunkTimeline(nar, chunks, total) {
  const keep = nar.chars.map((c, i) => (/[\s.,!?~]/.test(c) ? -1 : i)).filter((i) => i >= 0);
  const compact = keep.map((i) => nar.chars[i]).join('');
  let from = 0;
  const found = chunks.map((c) => {
    const p = chunkPlain(c);
    const k = compact.indexOf(p, from);
    if (k < 0) throw new Error(`--reel-trend: 대본에서 자막 "${c}"를 순서대로 찾지 못했어요`);
    from = k + p.length;
    return { text: c, start: nar.starts[keep[k]], end: nar.ends[keep[k + p.length - 1]] };
  });
  return found.map((f, i) => ({ ...f, to: i + 1 < found.length ? Math.min(found[i + 1].start, f.end + 0.4) : Math.min(f.end + 0.6, total) }));
}

// 컷: t(내레이션 기준)에서 바뀐다. 마지막은 endClip 1초(루프용 알 장면). 컷 길이만큼 원본을 시작초부터 쓴다
export function cutTimeline(cuts, endClip, narDur) {
  if (cuts[0].t !== 0) throw new Error('--reel-trend: 첫 컷의 t는 0이어야 해요');
  const segs = cuts.map((c, i) => {
    const dur = (cuts[i + 1]?.t ?? narDur) - c.t;
    if (dur > c.src[1] - c.src[0] + 0.1) console.warn(`  경고: 컷 t=${c.t} ${dur.toFixed(2)}초가 원본 구간(${c.src.join('~')})보다 길어요 — 장면 경계를 넘을 수 있어요`);
    return { t: c.t, dur, src: [c.src[0], c.src[0] + dur] };
  });
  return { parts: [...segs.map((s) => s.src), ...(endClip ? [[endClip[0], endClip[0] + 1]] : [])], segs, total: narDur + (endClip ? 1 : 0) }; // endClip이 없으면(공통 엔딩 샷을 붙일 때) 내레이션 끝에서 컷이 끝난다
}

// 내레이션 -14 LUFS + 트레일러 소리(-14 LUFS로 맞춘 것)를 내레이션 중에 -8dB(≈-22 LUFS)로 덕킹해 섞는다
// ── 엔딩 샷 자산(assets/brand 우선, 없으면 public/brand) ──
const BRAND_DIRS = [path.join(DIR, 'assets/brand'), path.join(ROOT, 'public/brand')];
const brandFile = (n) => BRAND_DIRS.map((d) => path.join(d, n)).find((p) => fs.existsSync(p)) ?? null;
// 시그니처 음성: outro-voice.mp3(고른 테이크)가 있으면 그것, 없으면 take1. "재미두나우" 시작 시각은 같은 이름의 .json 글자 타이밍에서, 없으면 마지막 쉼 뒤로 잡는다
function loadOutro() {
  const voice = brandFile('outro-voice.mp3') ?? brandFile('outro-voice-take1.mp3');
  const pop = brandFile('sfx-pop.mp3'), whoosh = brandFile('sfx-whoosh.mp3');
  if (!pop) console.warn('  경고: assets/brand/sfx-pop.mp3가 없어 로고 팝 효과음 없이 만들어요');
  if (!whoosh) console.warn('  경고: sfx-whoosh.mp3가 없어 전환 효과음 없이 만들어요');
  if (!voice) { console.warn('  경고: 시그니처 음성(assets/brand/outro-voice*.mp3)이 없어 엔딩을 무음 2초로 만들어요'); return { voice: null, sec: 2.0, nameAt: 0.15, pop, whoosh }; }
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', voice]).toString());
  let nameAt = null;
  const js = voice.replace(/\.mp3$/, '.json');
  if (fs.existsSync(js)) { const j = JSON.parse(fs.readFileSync(js, 'utf8')); const i = j.chars.indexOf('재'); if (i >= 0) nameAt = j.starts[i]; }
  if (nameAt === null) {
    const r = run(['-i', voice, '-af', 'silencedetect=n=-35dB:d=0.1', '-f', 'null', '-']);
    const ends = [...r.stderr.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1])).filter((v) => v < dur - 0.4);
    nameAt = ends.length ? ends[ends.length - 1] : dur * 0.5;
  }
  return { voice, sec: dur + OUTRO_PAD, nameAt, pop, whoosh, voiceDur: dur };
}
// 파일의 소리 크기(LUFS)를 target에 맞추는 이득(dB). 0.4초보다 짧은 효과음은 LUFS가 안 재져서 평균 음량(RMS)으로 어림한다
function gainDb(file, target) {
  const r = run(['-i', file, '-af', 'ebur128=peak=true,volumedetect', '-f', 'null', '-']);
  const lufs = Number(/\n\s+I:\s+(-?[\d.]+) LUFS/.exec(r.stderr)?.[1]);
  const rms = Number(/mean_volume: (-?[\d.]+) dB/.exec(r.stderr)?.[1]);
  const cur = Number.isFinite(lufs) && lufs > -69 ? lufs : rms;
  return { db: target - cur, from: cur };
}

function mixNarration({ game, nar, total, out, duckDb = -8, gapDb = 0, gapMin = 0.7, extras = [], fadeOut = true }) {
  const DUCK = Math.pow(10, duckDb / 20), GAP = Math.pow(10, gapDb / 20);
  const att = Math.min(0.15, gapMin / 3), rel = Math.min(0.3, gapMin * 0.4); // 내려가는 시간·올라오는 시간
  const m1 = run(['-i', nar.mp3, '-filter_complex', '[0:a]aresample=48000,aformat=channel_layouts=stereo,loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json[o]', '-map', '[o]', '-f', 'null', '-']);
  const m = JSON.parse(m1.stderr.slice(m1.stderr.lastIndexOf('{'), m1.stderr.lastIndexOf('}') + 1));
  const ln = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  // 말 구간: 글자 사이 쉼이 0.7초 넘으면 끊는다. 앞 0.15초에 내려가고 뒤 0.3초에 올라오는 이득 곡선
  const win = [];
  nar.chars.forEach((c, i) => { if (/\s/.test(c)) return; const last = win[win.length - 1]; if (last && nar.starts[i] - last[1] <= gapMin) last[1] = nar.ends[i]; else win.push([nar.starts[i], nar.ends[i]]); });
  const g = win.map(([a, b]) => `clip(min((t-(${(a - att).toFixed(3)}))/${att.toFixed(3)},(${(b + rel).toFixed(3)}-t)/${rel.toFixed(3)}),0,1)`);
  const vol = `${GAP.toFixed(4)}-${(GAP - DUCK).toFixed(4)}*${g.reduce((a, b) => `max(${a},${b})`)}`; // 창이 하나면 max 없이
  // 엔딩 음성·효과음: {file, at(초), lufs}. 소리 크기를 맞춰 at 시각에 얹는다(짧은 소리는 -1dBFS 리미터)
  const ex = extras.map((e, k) => { const g = gainDb(e.file, e.lufs); console.log(`  ${e.name}: ${g.from.toFixed(1)} → ${e.lufs} LUFS (${g.db >= 0 ? '+' : ''}${g.db.toFixed(1)}dB), ${e.at.toFixed(2)}초`); const ms = Math.round(e.at * 1000); return `[${k + 2}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${g.db.toFixed(2)}dB,alimiter=limit=0.891:attack=2:release=20,adelay=${ms}|${ms}[e${k}]`; });
  const mixIn = ['[g]', '[n]', ...extras.map((_, k) => `[e${k}]`)];
  const fc = `[0:a]aresample=48000,aformat=channel_layouts=stereo,${ln},apad=whole_dur=${total.toFixed(3)}[n];[1:a]volume='${vol}':eval=frame[g];${ex.map((x) => x + ';').join('')}${mixIn.join('')}amix=inputs=${mixIn.length}:duration=longest:normalize=0,atrim=0:${total.toFixed(3)}${fadeOut ? `,afade=t=out:st=${(total - 0.8).toFixed(2)}:d=0.8` : ''}[o]`;
  const r = run(['-i', nar.mp3, '-i', game, ...extras.flatMap((e) => ['-i', e.file]), '-filter_complex', fc, '-map', '[o]', '-c:a', 'aac', '-b:a', '192k', out]);
  if (r.status !== 0) throw new Error(`--reel-trend: 오디오 믹스 실패\n${r.stderr.slice(-600)}`);
  console.log(`  내레이션 측정 ${m.input_i} LUFS → -14 LUFS, 게임 소리 말 구간 ${duckDb}dB(≈${-14 + duckDb} LUFS)·빈틈(${gapMin}초 초과) ${gapDb}dB, 덕킹 구간 ${win.length}개`);
}

// 공통 엔딩 샷(2초): 직전 마지막 장면을 40px 블러 + 75% 어둡게 한 정지 배경 위에 J 로고(0.15초 팝) → 이름·문구·주소(0.1초 간격 0.12초 페이드인). 자막 없음, 무음
const OUTRO_Y = 900;
const outroHtml = (font) => `<!doctype html><meta charset="utf-8"><style>${baseCss(font)}
.blk { position: absolute; left: 0; width: ${RS.w}px; top: ${OUTRO_Y}px; transform: translateY(-50%); display: flex; flex-direction: column; align-items: center; text-align: center; color: #fff; }
.lg { width: 160px; height: 160px; border: 9px solid #fff; border-radius: 46px; display: grid; place-items: center; font-size: 110px; font-weight: 900; line-height: 1; }
.nm { margin-top: 30px; font-size: 72px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; }
.tg { margin-top: 14px; font-size: 44px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.3; color: ${MINT}; }
.url { margin-top: 64px; font-size: 34px; font-weight: 500; line-height: 1.3; color: #9A9A9A; letter-spacing: .01em; }
</style><div class="blk"><div class="lg" id="lg">J</div><div class="nm" id="nm">JamiDuNow</div><div class="tg" id="tg">친구랑 할 게임, 여기서 찾자</div><div class="url" id="url">jamidunow.com</div></div>`;

async function composeOutro({ font, lastPng, out, CACHE, postId, outro }) {
  const { w, h, fps } = RS;
  const bg = path.join(CACHE, `trend-${postId}-outro-bg.png`);
  ff(['-i', lastPng, '-vf', `scale=${w / 4}:${h / 4},gblur=sigma=10,scale=${w}:${h},colorchannelmixer=rr=0.25:gg=0.25:bb=0.25`, '-frames:v', '1', bg]); // 1/4로 줄여 시그마 10 = 원래 크기 약 40px 블러, 75% 어둡게
  const ids = ['lg', 'nm', 'tg', 'url'], pad = 16, items = [];
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.setContent(outroHtml(font), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    for (const id of ids) {
      await page.evaluate((keep) => { for (const e of ['lg', 'nm', 'tg', 'url']) document.getElementById(e).style.visibility = e === keep ? 'visible' : 'hidden'; }, id);
      const r = await page.evaluate((k) => { const b = document.getElementById(k).getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; }, id);
      const x = Math.max(0, Math.floor(r.x - pad)), y = Math.floor(r.y - pad), cw = Math.min(w - x, Math.ceil(r.w + pad * 2)), ch = Math.ceil(r.h + pad * 2);
      const file = path.join(CACHE, `trend-${postId}-outro-${id}.png`);
      await page.screenshot({ path: file, clip: { x, y, width: cw, height: ch }, omitBackground: true });
      items.push({ id, file, x, y, w: cw, h: ch });
    }
  } finally { await browser.close(); }
  const loop = (file) => ['-loop', '1', '-framerate', String(fps), '-t', outro.sec.toFixed(3), '-i', file];
  const [lg, ...texts] = items;
  const P = '(0.85+0.15*min(1,t/0.15))'; // 로고 0.15초 동안 85%→100%
  const g = [`[1:v]format=rgba,scale=w='trunc(iw*${P}/2)*2':h='trunc(ih*${P}/2)*2':eval=frame[lg]`, `[0:v][lg]overlay=x='${lg.x + lg.w / 2}-w/2':y='${lg.y + lg.h / 2}-h/2':format=auto[o1]`];
  texts.forEach((it, i) => {
    g.push(`[${i + 2}:v]format=rgba,fade=t=in:st=${(outro.nameAt + 0.1 * i).toFixed(3)}:d=0.12:alpha=1[t${i}]`); // "재미두나우!" 순간에 이름, 이어서 0.1초 간격으로 나머지 두 줄(각 0.12초 페이드인)
    g.push(`[o${i + 1}][t${i}]overlay=x=${it.x}:y=${it.y}:format=auto[o${i + 2}]`);
  });
  g.push(`[o${texts.length + 1}]format=yuv420p[o]`);
  ff([...loop(bg), ...loop(lg.file), ...texts.flatMap((t) => loop(t.file)), '-filter_complex', g.join(';'), '-map', '[o]', '-an', '-t', outro.sec.toFixed(3), '-r', String(fps), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', out]);
}

export async function runReelTrend(postId, { refresh = false } = {}) {
  const copyFile = path.join(DIR, 'copy', `${postId}.json`);
  if (!fs.existsSync(copyFile)) throw new Error(`--reel-trend: ${path.relative(ROOT, copyFile)}이 없어요`);
  const copy = JSON.parse(fs.readFileSync(copyFile, 'utf8'));
  if (JSON.stringify(copy).includes('재밌드나')) throw new Error('화면에는 "재밌드나"를 쓰지 않아요. JamiDuNow만 쓰세요.');
  const OUTRO = copy.outro !== false; // 기본: 끝에 공통 엔딩 샷 2초(copy.outro:false면 예전처럼 endClip 1초 루프)
  for (const k of ['narration', 'chunks', 'cuts', ...(OUTRO ? [] : ['endClip'])]) if (!copy[k]) throw new Error(`--reel-trend: copy에 ${k}가 없어요`);
  const facts = await steamFacts(copy.appid, copy);
  const title = copy.cardTitle ?? facts.name;
  console.log('  스팀 값:', JSON.stringify({ ...facts, header: undefined }));

  const CACHE = path.join(DIR, 'cache');
  fs.mkdirSync(CACHE, { recursive: true });
  const endSpec = OUTRO ? null : Array.isArray(copy.endClip) ? { src: copy.endClip } : copy.endClip; // {movie?, src:[시작초, 끝초]}
  const movieNames = [...new Set([...copy.cuts.map((c) => c.movie ?? copy.movie), ...(endSpec ? [endSpec.movie ?? copy.movie] : [])])]; // 컷마다 movie(영상 이름)를 따로 쓸 수 있다
  const srcs = {}, trailers = {};
  for (const mv of movieNames) { srcs[mv] = await steamMovie({ name: facts.name, steam_appid: copy.appid }, mv); trailers[mv] = await trailerFromDb(srcs[mv], CACHE, refresh); }
  const partMovies = [...copy.cuts.map((c) => c.movie ?? copy.movie), ...(endSpec ? [endSpec.movie ?? copy.movie] : [])];
  const outDir = path.join(DIR, 'out', postId);
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of ['reel.mp4', 'still-subtitle.png', 'still-card.png', 'still-end.png', 'still-outro.png']) fs.rmSync(path.join(outDir, f), { force: true }); // 내레이션 캐시(narration*.mp3·json)와 voice-samples는 남긴다

  const rawNar = await getNarration(outDir, copy.narration);
  const nar = copy.narration.tighten === false ? rawNar : tightenNarration(outDir, rawNar, copy.narration.cacheName ?? 'narration', { ...copy.narration.silence, ...(copy.narration.atempo !== undefined ? { atempo: copy.narration.atempo } : {}) }); // 무음 압축(기본)
  const bodyLen = nar.duration + (endSpec ? 1 : 0);
  const chunks = chunkTimeline(nar, copy.chunks, bodyLen);
  // 컷 시각: t(초)를 직접 쓰거나, at(자막 덩어리 글자)·offset(초)로 그 말이 시작하는 시각에 맞춘다 — 내레이션 타이밍이 바뀌어도 컷이 말을 따라간다
  const cuts = copy.cuts.map((c, i) => {
    if (c.at === undefined) return c;
    const hit = chunks.find((k) => chunkPlain(k.text) === chunkPlain(c.at));
    if (!hit) throw new Error(`--reel-trend: cuts[${i}].at "${c.at}"와 같은 자막이 없어요`);
    return { ...c, t: +(hit.start + (c.offset ?? 0)).toFixed(3) };
  });
  const { parts, segs, total: bodyDur } = cutTimeline(cuts, endSpec?.src, nar.duration);
  const outro = OUTRO ? loadOutro() : null;
  const total = bodyDur + (outro ? outro.sec : 0); // 전체 길이(엔딩 샷 포함). 본편 영상·자막은 bodyDur까지
  const hasCard = !!copy.card; // card가 없으면 정보 카드 없이(로고 장면 등으로 대신)
  let c0 = -10, c1 = -10;
  if (hasCard) {
    const cardChunk = chunks.find((c) => chunkPlain(c.text) === chunkPlain(copy.card.chunk));
    if (!cardChunk) throw new Error(`--reel-trend: card.chunk "${copy.card.chunk}"와 같은 자막이 없어요`);
    c0 = cardChunk.start; c1 = c0 + copy.card.sec;
  }
  console.log(`  내레이션 ${nar.duration.toFixed(2)}초 → 영상 ${total.toFixed(2)}초${hasCard ? ` · 카드 ${c0.toFixed(2)}~${c1.toFixed(2)}초` : ' · 카드 없음'}`);
  console.log('  컷:', segs.map((s) => `${s.t.toFixed(2)}(${s.dur.toFixed(2)})`).join(' '), `· 마지막 알 ${nar.duration.toFixed(2)}`);
  console.log('  자막:', chunks.map((c) => `${c.text} ${c.start.toFixed(2)}~${c.to.toFixed(2)}`).join(' | '));
  const font = fs.readFileSync(path.join(ROOT, 'node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2')).toString('base64');
  const imgB64 = hasCard ? Buffer.from(await (await fetch(facts.header)).arrayBuffer()).toString('base64') : '';

  // 오버레이 PNG: 로고(전체 화면) · 자막 덩어리별(글자 영역만 잘라냄, 가운데 좌표 기억) · 카드(전체 화면)
  const subs = [];
  const logoPng = path.join(CACHE, `trend-${postId}-logo.png`), cardPng = path.join(CACHE, `trend-${postId}-card.png`);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: RS.w, height: RS.h } });
    const full = { x: 0, y: 0, width: RS.w, height: RS.h };
    const load = async (html) => { await page.setContent(html, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready); };
    await load(logoHtml(font));
    await page.screenshot({ path: logoPng, clip: full, omitBackground: true });
    for (let i = 0; i < chunks.length; i++) {
      await load(subHtml(font, chunks[i].text));
      const r = await page.evaluate(() => { const b = document.getElementById('s').getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height }; });
      const W = Math.ceil(r.w / 2) * 2 + 64, H = Math.ceil(r.h / 2) * 2 + 64; // 외곽선 여유, 가운데 유지
      const file = path.join(CACHE, `trend-${postId}-sub${i}.png`);
      await page.screenshot({ path: file, clip: { x: Math.round(SUB_X - W / 2), y: Math.round(SUB_Y - H / 2), width: W, height: H }, omitBackground: true });
      if (SUB_X + r.w / 2 > RS.w - RS.rightGap || SUB_X - r.w / 2 < 0) throw new Error(`--reel-trend: 자막 "${chunks[i].text}"가 안전 영역(오른쪽 140px)을 넘어요`);
      subs.push({ file, ...chunks[i] });
    }
    if (hasCard) {
    await load(cardHtml(font, facts, title, imgB64));
    const fit = await page.evaluate(() => { const el = document.querySelector('.i'); const max = el.clientWidth; let sz = 40; el.style.whiteSpace = 'nowrap'; el.style.display = 'inline-block'; el.style.width = 'auto'; while (el.scrollWidth > max && sz > 26) { sz -= 1; el.style.fontSize = `${sz}px`; } const ok = el.scrollWidth <= max; el.style.display = ''; el.style.width = ''; return { sz, ok }; });
    console.log(`  카드 정보 줄 ${fit.sz}px${fit.ok ? '' : ' (넘침)'}`);
    const cr = await page.evaluate(() => { const b = document.getElementById('c').getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; });
    console.log(`  카드 영역 ${JSON.stringify(cr)}`);
    if (cr[2] > RS.w - RS.rightGap || cr[3] > SAFE_BOTTOM) throw new Error('--reel-trend: 정보 카드가 안전 영역을 넘어요');
    await page.screenshot({ path: cardPng, clip: full, omitBackground: true });
    }
  } finally { await browser.close(); }

  // 영상: 컷을 이어 붙여 1920 높이로 맞춘 뒤 가운데 크롭(1080×1920). 워터마크 → 자막(팝, 카드 중엔 위로) → 카드(아래에서 올라옴)
  const { w, h, fps } = RS;
  const n = parts.length;
  const T = (v) => v.toFixed(3);
  const vin = parts.flatMap(([a, b], i) => ['-ss', String(a), '-t', String(b - a), '-i', trailers[partMovies[i]]]);
  const oin = [
    ['-loop', '1', '-framerate', String(fps), '-t', T(bodyDur), '-i', logoPng],
    ...subs.map((c) => ['-itsoffset', T(c.start), '-loop', '1', '-framerate', String(fps), '-t', T(c.to - c.start + 0.1), '-i', c.file]),
    ...(hasCard ? [['-itsoffset', T(c0), '-loop', '1', '-framerate', String(fps), '-t', T(copy.card.sec + 0.1), '-i', cardPng]] : []),
  ].flat();
  const xs = [...cuts.map((c) => c.x ?? 0.5), 0.5]; // 구간별 가로 크롭 위치(0=왼쪽 끝, 1=오른쪽 끝)
  const per = parts.map((_, i) => `[${i}:v]fps=${fps},setsar=1,split[a${i}][b${i}];[a${i}]crop=ih*4/5:ih:(iw-ih*4/5)*${xs[i]}:0,scale=${FG_W}:${FG_H}[f${i}];[b${i}]scale=-2:480,crop=270:480,gblur=sigma=10,scale=${w}:${h},colorchannelmixer=rr=0.65:gg=0.65:bb=0.65[g${i}]`); // 배경: 1/4로 줄여 시그마 10으로 블러(=원래 크기 약 40px)한 뒤 키우고 35% 어둡게
  const g = [`${per.join(';')};${parts.map((_, i) => `[f${i}]`).join('')}concat=n=${n}:v=1:a=0[vf];${parts.map((_, i) => `[g${i}]`).join('')}concat=n=${n}:v=1:a=0[vb];[vb][vf]overlay=x=${FG_X}:y=${FG_Y}:format=auto[v0]`];
  g.push(`[v0][${n}:v]overlay=format=auto[v1]`);
  subs.forEach((c, i) => {
    const k = n + 1 + i, P = `(${POP_FROM}+${1 - POP_FROM}*min(1,max(0,(t-${T(c.start)})/${POP})))`;
    g.push(`[${k}:v]format=rgba,scale=w='trunc(iw*${P}/2)*2':h='trunc(ih*${P}/2)*2':eval=frame[p${i}]`);
    g.push(`[v${i + 1}][p${i}]overlay=x='${SUB_X}-w/2':y='if(between(t,${T(c0)},${T(c1)}),${SUB_Y_CARD},${SUB_Y})-h/2':eof_action=pass:enable='between(t,${T(c.start)},${T(c.to)})':format=auto[v${i + 2}]`);
  });
  const kc = n + 1 + subs.length, last = subs.length + 1;
  if (!hasCard) g.push(`[v${last}]format=yuv420p[o]`);
  else g.push(`[v${last}][${kc}:v]overlay=x=0:y='if(lt(t-${T(c0)},${CARD_IN}),${CARD_SLIDE}*pow(1-(t-${T(c0)})/${CARD_IN},2),0)':eof_action=pass:enable='between(t,${T(c0)},${T(c1)})':format=auto,format=yuv420p[o]`);
  const silent = path.join(CACHE, `trend-${postId}-silent.mp4`), lastPng = path.join(CACHE, `trend-${postId}-last.png`);
  if (process.env.REEL_DEBUG) fs.writeFileSync(path.join(CACHE, `trend-${postId}-graph.txt`), JSON.stringify({ args: [...vin, ...oin], graph: g.join(';') }));
  ff(['-filter_threads', '1', ...vin, ...oin, '-filter_complex', g.join(';'), '-map', '[o]', '-an', '-t', T(bodyDur), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', silent]);
  { // 엔딩 샷 배경: 마지막 컷의 장면 1장을 본편과 같은 4:5 + 블러 구성으로(로고·자막 없이)
    const li = parts.length - 1, [la, lb] = parts[li];
    ff(['-ss', T((la + lb) / 2), '-i', trailers[partMovies[li]], '-frames:v', '1', '-filter_complex', `[0:v]split[a][b];[a]crop=ih*4/5:ih:(iw-ih*4/5)*${xs[li]}:0,scale=${FG_W}:${FG_H}[f];[b]scale=-2:480,crop=270:480,gblur=sigma=10,scale=${w}:${h},colorchannelmixer=rr=0.65:gg=0.65:bb=0.65[g];[g][f]overlay=x=${FG_X}:y=${FG_Y}:format=auto[o]`, '-map', '[o]', lastPng]);
  }

  const m4a = path.join(CACHE, `trend-${postId}-audio.m4a`), gameM4a = path.join(CACHE, `trend-${postId}-game.m4a`);
  const audioFiles = {};
  for (const mv of movieNames) audioFiles[mv] = await trailerAudioFromDb(srcs[mv], CACHE, refresh);
  const aParts = parts.map((p, i) => (OUTRO && i === parts.length - 1 ? [p[0], p[1] + OUTRO_GAME_TAIL] : p)); // 엔딩 샷이 붙으면 마지막 컷 소리를 0.3초 더 떠서, 컷 뒤 0.3초 동안 페이드아웃
  const { measured } = buildAudio({ audio: partMovies.map((mv) => audioFiles[mv]), copy: { segments: aParts.slice(0, -1), endClip: aParts[aParts.length - 1] }, out: gameM4a });
  const extras = !outro ? [] : [
    ...(outro.whoosh ? [{ name: '전환 효과음(whoosh)', file: outro.whoosh, at: Math.max(0, bodyDur - 0.2), lufs: -18 }] : []), // 휙 끝나는 시점에 컷이 오도록 0.2초 앞당김
    ...(outro.voice ? [{ name: '시그니처 음성', file: outro.voice, at: bodyDur, lufs: -14 }] : []),
    ...(outro.pop ? [{ name: '로고 팝 효과음', file: outro.pop, at: bodyDur, lufs: -20 }] : []),
  ];
  mixNarration({ game: gameM4a, nar, total, out: m4a, duckDb: copy.duckDb, gapDb: copy.gapDb, gapMin: copy.gapMin, extras, fadeOut: !outro });
  let silentAll = silent;
  if (OUTRO) {
    const outroMp4 = path.join(CACHE, `trend-${postId}-outro.mp4`);
    await composeOutro({ font, lastPng, out: outroMp4, CACHE, postId, outro });
    console.log(`  엔딩 ${outro.sec.toFixed(2)}초(시그니처 음성 ${outro.voice ? path.relative(ROOT, outro.voice) : '없음'}, 이름 등장 ${outro.nameAt.toFixed(2)}초)`);
    const list = path.join(CACHE, `trend-${postId}-concat.txt`);
    fs.writeFileSync(list, `file '${silent}'\nfile '${outroMp4}'\n`);
    silentAll = path.join(CACHE, `trend-${postId}-silent-all.mp4`);
    ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silentAll]);
  }
  const mp4 = path.join(outDir, 'reel.mp4');
  ff(['-i', silentAll, '-i', m4a, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-movflags', '+faststart', '-shortest', mp4]);

  // 정지 이미지: 자막 장면 1장(곡괭이 비트, 팝이 끝난 뒤), 정보 카드 1장(다 올라온 뒤)
  const pick = chunks.find((c) => chunkPlain(c.text).includes(chunkPlain(copy.stillChunk ?? '곡괭이'))) ?? chunks[Math.floor(chunks.length / 2)];
  ff(['-ss', T(pick.start + 0.25), '-i', mp4, '-frames:v', '1', path.join(outDir, 'still-subtitle.png')]);
  const second = hasCard ? 'still-card.png' : OUTRO ? 'still-outro.png' : 'still-end.png'; // 카드가 있으면 카드, 없으면 엔딩 샷(없으면 마지막 로고 장면)
  const secondAt = hasCard ? c0 + 1.2 : OUTRO ? bodyDur + Math.min(outro.sec - 0.2, outro.nameAt + 0.6) : bodyDur - 0.3; // 엔딩은 세 줄이 다 나온 뒤
  ff(['-ss', T(secondAt), '-i', mp4, '-frames:v', '1', path.join(outDir, second)]);
  if (hasCard && OUTRO) ff(['-ss', T(bodyDur + Math.min(outro.sec - 0.2, outro.nameAt + 0.6)), '-i', mp4, '-frames:v', '1', path.join(outDir, 'still-outro.png')]);
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString());
  console.log(`${path.relative(ROOT, mp4)} (${dur.toFixed(2)}초, 내레이션 + 덕킹한 원본 오디오 측정 ${measured} LUFS → -14 LUFS, 구간 경계 0.1초 크로스페이드)`);
  console.log(path.relative(ROOT, path.join(outDir, 'still-subtitle.png')), path.relative(ROOT, path.join(outDir, second)));
}
