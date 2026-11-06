// scripts/insta/reel-trend.mjs
// --reel-trend: 신작·화제작 세로 릴스(1080×1920). 트레일러가 화면 전체를 채우고(가운데 크롭) ElevenLabs 내레이션 + 말하는 어절에 맞춰 팝으로 바뀌는 가운데 자막 + 정보 카드 + 루프(첫 컷·끝 컷이 같은 장면)
// layout:"full"(copy.layout 또는 --layout=full): 1080×1920을 원본 가운데 세로 크롭(9:16)으로 꽉 채움(4:5·블러 띠 없음). 컷마다 x(0~1)·pan[시작,끝]으로 가로 위치, 문장 하나에 장면 하나, 문장이 원본 구간보다 길면 그 컷만 0.9배 슬로우(원본 밖으로 안 나가고, 그래도 모자라면 마지막 프레임을 잡아둠). 카드 장면은 마지막 컷의 원본을 이어서 깔고 블러 디졸브. 결과는 reel-full.mp4
// 레이아웃: 영상 전체 화면 · 로고는 왼쪽 위 작은 워터마크 · 자막/카드는 가운데 y≈900, 오른쪽 140px·아래 25%(y>1440)는 비움(가로 기준 x 470 = 오른쪽 140px을 뺀 폭의 가운데)
// 자막: 1~2어절씩, 내레이션 글자별 타이밍(with-timestamps)에 맞춰 바뀐다. 흰색 Extra Bold 100px + 검은 외곽선 8px, 핵심 단어([ ]로 표시)는 민트. 나올 때 0.08초 동안 85%→100% 팝, 그 외 움직임·페이드 없음
// 정보 카드: 지정한 말(card.chunk) 시작에 화면 아래에서 0.2초 동안 올라와 card.sec초 머문다. 그동안 자막은 카드 위(y 430)로 비켜서 계속 나온다. 가격·인원·한국어는 스팀 appdetails(kr) 값(할인 종료가 3일 넘게 남았을 때만 "₩6,790 (-15%, 11/3까지)", 3일 이내·종료 시각 불명이면 정가만), copy.maxPlayers가 있으면 인원만 덮어씀
// 내레이션: ElevenLabs(eleven_multilingual_v2, voiceSettings) with-timestamps를 대본 통째로 한 번에 생성해 out/<post-id>/<cacheName>.mp3·json에 캐시(대본·목소리·설정이 같으면 API를 다시 부르지 않는다)
// 오디오: 배경음악 없음. 내레이션 -14 LUFS, 트레일러 원본은 -14 LUFS로 맞춘 뒤 내레이션 중에 -8dB(≈-22 LUFS)로 덕킹(말 사이 0.7초 넘는 쉼에는 원래대로), 컷 경계 0.1초 크로스페이드, 끝 0.8초 페이드아웃
// 영상 길이 = 내레이션 길이 + 1초(마지막 1초는 첫 컷과 같은 알 장면 — 루프). 컷은 copy.cuts의 t(초, 내레이션 기준)에서 바뀐다
// 컷 기본 규칙(scene-cuts.mjs): 컷 경계 +0.3초(copy.cutExtend)·0.8초 미만 컷은 옆 컷과 합침(copy.minCut)·트레일러 원본 장면 전환(ffmpeg select gt(scene,0.3))이 컷·카드 경계 앞뒤 0.5초 안에 끼지 않게 원본 구간을 옮기고 확인(copy.sceneAvoid:false로 끔)
// copy.sceneExtra: 자동 감지(급한 전환만 잡음)가 놓치는 느린 디졸브를 직접 등록 {영상 이름: [시각…]}
// 원본 구간 중복 방지(기본): 컷의 원본 구간은 한 번만 쓴다 — 다른 컷과 조금이라도 겹치면 아직 안 쓴 다른 구간으로 옮긴다(scene-cuts.mjs uniqueSources). 렌더 뒤 연속한 두 컷의 첫 프레임 SSIM이 0.9 이상이면 실패로 보고 그 컷을 다른 구간으로 골라 다시 렌더(최대 4번)
// 카드 전환(cardFrom): 카드 직전 컷은 카드 직전까지 이어지는 한 장면(카드 시작 1초 전~카드 끝에 원본 장면 전환 없음)이고, 카드 시작에 하드컷 대신 그 장면이 계속 재생되면서 0.4초 동안 블러 0→30px·밝기 100→60%(ease-out), 카드는 0.05초 늦게 0.35초 동안 불투명도 0→100%·94→100%·20px 아래에서 위로(ease-out). 카드 진입 효과음 없음. 카드→엔딩은 sfx-whoosh와 하드컷
// 실행: npm run insta -- <post-id> --reel-trend   (copy/<post-id>.json → out/<post-id>/reel-ig.mp4 + still-subtitle.png + still-card.png)
// 자막: copy.chunks(직접 지정, [핵심]) 없으면 자동(copy.keys = 민트 구절). 0.35초 미만 덩어리 합치기·12자·3어절 규칙은 subtitle-chunks.mjs
// copy: appid, movie(스팀 영상 이름), maxPlayers(선택), cardTitle(선택), narration{voiceId, cacheName, voiceSettings, text}, chunks[](자막 어절 묶음, 대본 순서, [핵심]), card{chunk, sec}, cuts[{t, src:[시작초, 끝초]}](t=0부터), endClip(첫 컷과 같은 알 장면, 1초만 쓴다)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { execFileSync, spawnSync } from 'child_process';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { RS, ff, buildAudio, trailerAudioFromDb, steamMovie } from './reel-single.mjs';
import { trailerFromDb } from './reel.mjs';
import { getNarrationBySentence } from './narration-sentences.mjs';
import { autoChunks, mergeShortChunks, MIN_SEC } from './subtitle-chunks.mjs';
import { CUT_EXTEND, MIN_CUT, SCENE_GAP, stretchCuts, uniqueSources, detectSceneCuts } from './scene-cuts.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '../..');
const MINT = '#5CF2B0';
const CX = (RS.w - RS.rightGap) / 2; // 자막·카드 가운데 x = 470
const OUTRO_GAME_TAIL = 0.3, OUTRO_PAD = 0.6, OUTRO_SEC_NO_VOICE = 1.6; // 엔딩 길이 = 시그니처 음성 길이 + 0.6초, 게임 소리는 엔딩 진입 0.3초 안에 사라진다
const SUB_X = 540, SUB_Y = 1000, SUB_Y_FULL = 960; // 자막 가운데(고정). full 레이아웃은 화면 정중앙(960)
const FG_Y = 285, FG_W = 1080, FG_H = 1350; // 영상은 원본 높이 기준 4:5로 가운데 크롭(컷마다 cut.x 0~1로 가로 위치 조정, 기본 0.5)해 y 285~1635에 두고, 위아래는 같은 영상을 크게 블러·어둡게 깐다
const FG_X = 0;
const CARD_CX = 540, CARD_Y = 960; // 정보 카드는 항상 화면 정중앙(오른쪽 140px 여백 규칙은 카드에 적용하지 않는다) // 카드 가운데 y
const SUB_Y_CARD = 430; // 카드가 떠 있는 동안 자막 y(카드 위)
const SAFE_BOTTOM = RS.h * 0.75; // 1440
const POP = 0.08, POP_FROM = 0.85, CARD_IN = 0.2, CARD_SLIDE = 640;
const T3 = (v) => Number(v).toFixed(3);
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
      let ts = Number(/InitDailyDealTimer\(\s*\$DiscountCountdown,\s*(\d+)/.exec(html)?.[1]); // 종료 시각(appdetails에는 없어 상점 페이지에서 읽음)
      if (!ts) { const m = /종료일:\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/.exec(html); if (m) ts = new Date(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}T23:59:00+09:00`).getTime() / 1000; } // 타이머 대신 "종료일: 2026년 11월 12일" 글자만 있는 페이지(그 날 끝까지로 본다)
      if (ts * 1000 - Date.now() > 3 * 864e5) { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' }).formatToParts(new Date(ts * 1000)).map((x) => [x.type, x.value])); saleEnd = `${p.month}/${p.day}`; }
    } catch { /* 종료 시각을 못 읽으면 정가 */ }
    if (saleEnd) price = `${won(po.final)} (-${po.discount_percent}%, ${saleEnd}까지)`;
  }
  const kor = /Korean(<strong>\*<\/strong>)?/.exec(en.supported_languages ?? '');
  const range = /(\d+)\s*~\s*(\d+)\s*인/.exec(d.short_description ?? '');
  const max = copy.maxPlayers ?? (range ? Number(range[2]) : null);
  const soon = !!d.release_date?.coming_soon; // 출시 예정: 출시일·가격이 없어도 된다(카드에 "출시 예정"만 쓰고 가격은 뺀다)
  if ((!rel && !soon) || (!price && !soon) || !kor || !max) throw new Error(`--reel-trend: 출시일·가격·한국어·인원 중 빠진 게 있어요 ${JSON.stringify({ rel: !!rel, price, kor: !!kor, max })} (인원은 copy.maxPlayers로 지정)`);
  return { name: en.name, header: d.header_image, soon, mmdd: rel ? `${rel[2].padStart(2, '0')}.${rel[3].padStart(2, '0')}` : null, price, regular: d.is_free ? null : po ? won(po.initial) : null, saleEnd, korean: kor[1] ? '한국어 자막+더빙' : '한국어 자막', max, moviesCount: d.movies?.length ?? 0 };
}

const baseCss = (font) => `@font-face { font-family: P; src: url(data:font/woff2;base64,${font}); font-weight: 100 900; }
* { margin: 0; box-sizing: border-box; } html, body { width: ${RS.w}px; height: ${RS.h}px; background: transparent; overflow: hidden; font-family: P, sans-serif; }`;

const logoHtml = (font, top = FG_Y + 26, full = false) => `<!doctype html><meta charset="utf-8"><style>${baseCss(font)}
.logo { position: absolute; left: ${full ? 48 : FG_X + 28}px; top: ${top}px; display: flex; align-items: center; gap: 10px; opacity: ${full ? 0.85 : 0.92}; ${full ? 'transform: scale(0.8); transform-origin: 0 0; filter: drop-shadow(0 0 4px rgba(0,0,0,.4));' : ''} }
.logo i { width: 38px; height: 38px; border-radius: 11px; background: #fff; color: #0b0b0b; display: grid; place-items: center; font-style: normal; font-size: 27px; font-weight: 900; line-height: 1; }
.logo b { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; color: #fff; ${full ? '' : 'text-shadow: 0 0 8px rgba(0,0,0,.6);'} }
</style><div class="logo"><i>J</i><b>JamiDuNow</b></div>`;

// 자막 한 덩어리: 흰 글씨 72px Black(900) + 검은 외곽선 5px(바깥쪽, 10px 선 + paint-order, 둥근 모서리), 그림자 없음. 2배 해상도(144px·외곽선 10px)로 그린 뒤 50%로 줄여 합성(가장자리 매끈하게). [ ]로 감싼 말, 그리고 KEY_WORDS는 민트
const KEY_WORDS = ['컨닝으로', '지우개가', '무전기로', '기절시키고', '다 같이', '파이널스 위크'];
const subMark = (text) => (/\[/.test(text) ? text : KEY_WORDS.includes(text.trim()) ? `[${text.trim()}]` : text);
const subHtml = (font, text, size = 72, full = false) => `<!doctype html><meta charset="utf-8"><style>${baseCss(font)}
.sub { position: absolute; left: ${SUB_X}px; top: ${full ? SUB_Y_FULL : SUB_Y}px; transform: translate(-50%, -50%); white-space: nowrap; font-size: ${size}px; font-weight: ${full ? 800 : 900}; letter-spacing: -0.03em; line-height: 1.2; color: #fff; -webkit-text-stroke: ${full ? 14 : 10}px #000; paint-order: stroke fill; stroke-linejoin: round;${full ? ' filter: drop-shadow(0 4px 0 rgba(0,0,0,.6));' : ''} }
.sub .k { color: ${MINT}; }
</style><div class="sub" id="s">${esc(subMark(text)).replace(/\[([^\]]+)\]/g, '<span class="k">$1</span>')}</div>`;

// 정보 카드: 둥근 검은 카드 + 민트 포인트. 대표 이미지(스팀 header) · 이름 · 정보 2줄 · 아래 작게 jamidunow.com
const cardHtml = (font, f, title, imgB64) => `<!doctype html><meta charset="utf-8"><style>${baseCss(font)}
.card { position: absolute; left: ${CARD_CX - 380}px; width: 760px; top: ${CARD_Y}px; transform: translateY(-50%); padding: 28px 28px 24px; border-radius: 44px; background: rgba(10,10,10,.95); border: 3px solid ${MINT}; text-align: center; color: #fff; box-shadow: 0 10px 40px rgba(0,0,0,.5); }
.card img { display: block; width: auto; max-width: 100%; margin: 0 auto; border-radius: 26px; } /* 원본보다 크게 늘리지 않는다(원본이 넓으면 카드 폭에 맞춰 줄임) */
.t { margin-top: 24px; font-size: 92px; font-weight: 900; letter-spacing: -0.02em; line-height: 1.05; }
.i { margin-top: 14px; font-size: 40px; font-weight: 700; line-height: 1.45; font-variant-numeric: tabular-nums; }
.i em { font-style: normal; color: ${MINT}; }
.u { margin-top: 18px; font-size: 24px; font-weight: 600; color: rgba(255,255,255,.55); letter-spacing: .02em; }
</style><div class="card" id="c"><img src="data:image/jpeg;base64,${imgB64}"><div class="t">${esc(title)}</div>
<div class="i"><em>${f.mmdd ? `${esc(f.mmdd)} 출시` : '출시 예정'}</em>${f.price ? ` / ${esc(f.price)}` : ''}<br>최대 ${f.max}인 / ${esc(f.korean)}</div><div class="u">jamidunow.com</div></div>`;

// ── ElevenLabs 내레이션 ──
const DEFAULT_VOICE = 'uyVNoMrnUku1dZyVEXwD';
const DEFAULT_VOICE_SETTINGS = { stability: 0.55, similarity_boost: 0.8, style: 0, speed: 1.2 }; // 문장 끝이 올라가는 걸 줄이려고 안정성을 올리고 스타일은 0
// 내레이션 mp3·글자별 타이밍은 out/<post-id>/narration.mp3·json에 캐시(대본·목소리가 같으면 API를 다시 부르지 않는다)
export async function getNarration(outDir, cfg) {
  cfg = { voiceId: DEFAULT_VOICE, ...cfg, voiceSettings: { ...DEFAULT_VOICE_SETTINGS, ...cfg.voiceSettings } }; // 기본 목소리·설정(속도 1.2 = ElevenLabs 최대값). copy에서 적은 값이 우선
  if (cfg.perSentence !== false) return getNarrationBySentence(outDir, cfg); // 기본: 문장 단위 생성 + 끝 억양 검사(narration-sentences.mjs). copy.narration.perSentence:false면 대본 통째로 한 번에
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


// 카드 이미지: 스팀 스토어 API(IStoreBrowseService)의 고해상도 에셋을 우선 쓴다 — header_2x(920×430, 헤더와 같은 비율) → main_capsule_2x(1232×706) → header → main_capsule → library_capsule. 없으면 appdetails header_image
async function fetchCardImage(appid, headerUrl) {
  const get = async (u) => { try { const r = await fetch(u); return r.ok ? Buffer.from(await r.arrayBuffer()) : null; } catch { return null; } };
  let names = [];
  try {
    const j = await (await fetch(`https://api.steampowered.com/IStoreBrowseService/GetItems/v1?input_json=${encodeURIComponent(JSON.stringify({ ids: [{ appid: Number(appid) }], context: { language: 'koreana', country_code: 'KR' }, data_request: { include_assets: true } }))}`)).json();
    const a = j.response?.store_items?.[0]?.assets;
    if (a) names = ['header_2x', 'main_capsule_2x', 'header', 'main_capsule', 'library_capsule'].filter((k) => a[k]).map((k) => ({ k, url: `https://shared.akamai.steamstatic.com/store_item_assets/${a.asset_url_format.replace('${FILENAME}', a[k])}` }));
  } catch { /* API 실패하면 header_image로 */ }
  names.push({ k: 'header_image(appdetails)', url: headerUrl });
  for (const n of names) {
    const buf = await get(n.url);
    if (!buf) continue;
    const tmp = path.join(DIR, 'cache', `cardimg-${appid}.bin`);
    fs.writeFileSync(tmp, buf);
    const [w, h] = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', tmp]).toString().trim().split('x').map(Number);
    console.log(`  카드 이미지: ${n.k} ${w}×${h}`);
    return { b64: buf.toString('base64'), w, h, name: n.k };
  }
  throw new Error('--reel-trend: 카드 이미지를 못 받았어요');
}

// ── 무음 압축 + 속도(--reel-trend 기본 후처리) ──
// with-timestamps의 글자 타이밍으로 어절 사이 무음을 찾아 줄인다: 문장 안 0.18초 초과 → 0.08초, 문장 사이 0.3초 초과 → 0.18초, 마지막 문장은 어절 사이를 0.06초까지(한 호흡). 그다음 atempo 1.06배.
// 자르는 곳은 10ms 크로스페이드. 줄인 만큼·빨라진 만큼 글자 타이밍을 당겨 새 mp3(wav)·타이밍을 돌려준다. 끄려면 copy.narration.tighten=false, 값은 copy.narration.silence로 바꾼다
const SILENCE = { word: 0.18, wordTo: 0.08, sentence: 0.3, sentenceTo: 0.18, lastGap: 0.06, atempo: 1.06, margin: 0.05, xfade: 0.02, weakHalf: true }; // atempo: 무음을 줄인 뒤 전체 내레이션을 음높이 유지로 이만큼 빠르게. margin: 자른 곳 앞뒤로 각각 무조건 남기는 시간(그래서 어절 사이는 아무리 줄여도 2×margin=0.1초 아래로 안 간다). xfade: 크로스페이드. weakHalf: 약한 자음(ㅎㅅㅆㅊㅋㅌㅍ)으로 시작하는 글자 앞은 줄이는 양을 절반만
// 한글 초성이 ㅅ ㅆ ㅊ ㅋ ㅌ ㅍ ㅎ(약하게 시작해서 타이밍이 늦게 찍히기 쉬운 소리)인가
const WEAK_INITIALS = new Set([9, 10, 14, 15, 16, 17, 18]);
const isWeakStart = (ch) => { const c = (ch ?? '').charCodeAt(0) - 0xAC00; return c >= 0 && c < 11172 && WEAK_INITIALS.has(Math.floor(c / 588)); };
export function silenceSpans(nar, cfg = {}) {
  const o = { ...SILENCE, ...cfg };
  const tokens = [];
  let cur = null;
  nar.chars.forEach((c, i) => {
    if (/\s/.test(c)) { cur = null; return; }
    if (!cur) { cur = { text: '', a: null, b: null, first: '' }; tokens.push(cur); }
    cur.text += c;
    if (!/[.,!?~…]/.test(c)) { if (cur.a === null) cur.first = c; cur.a ??= nar.starts[i]; cur.b = nar.ends[i]; } // 구두점은 무음을 같이 먹어서 시작·끝 계산에서 뺀다
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
    if (to === null) continue;
    let cut = gap - to; // 줄일 양
    if (o.weakHalf && isWeakStart(words[k + 1].first)) cut *= 0.5; // 다음 글자가 ㅎㅅㅆㅊㅋㅌㅍ으로 시작하면 절반만
    cut = Math.min(cut, gap - 2 * o.margin); // 앞뒤로 margin씩은 무조건 남긴다
    if (cut < 0.03) continue; // 줄어드는 게 너무 적으면 안 자른다
    spans.push({ a: w.b + (gap - cut) / 2, b: words[k + 1].a - (gap - cut) / 2 });
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
  const X = { ...SILENCE, ...cfg }.xfade; // 크로스페이드(기본 20ms): 조각 끝에 X를 더 떠서, 겹친 만큼을 보충한다
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

// 인스타 업로드용 최종 인코딩: H.264 High · 1080×1920 · 30fps · yuv420p · BT.709 · 2-pass VBR 평균 8M / 최대 10M / 버퍼 16M · GOP 60(2초) · faststart · AAC 48kHz 192k
export function encodeInstaFinal({ video, audio, out, w = 1080, h = 1920, fps = 30, passlog }) {
  const v = ['-vf', `scale=${w}:${h},fps=${fps}`, '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-b:v', '8M', '-maxrate', '10M', '-bufsize', '16M',
    '-g', String(fps * 2), '-keyint_min', String(fps * 2), '-sc_threshold', '0', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-passlogfile', passlog];
  const p1 = run(['-i', video, ...v, '-pass', '1', '-an', '-f', 'null', '/dev/null']);
  if (p1.status !== 0) throw new Error(`--reel-trend: 인코딩 1패스 실패\n${p1.stderr.slice(-500)}`);
  const p2 = run(['-i', video, '-i', audio, ...v, '-pass', '2', '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-ar', '48000', '-b:a', '192k', '-movflags', '+faststart', '-shortest', out]);
  for (const f of fs.readdirSync(path.dirname(passlog))) if (f.startsWith(path.basename(passlog))) fs.rmSync(path.join(path.dirname(passlog), f), { force: true });
  if (p2.status !== 0) throw new Error(`--reel-trend: 인코딩 2패스 실패\n${p2.stderr.slice(-500)}`);
}
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
// ── 엔딩 샷 자산(scripts/insta/assets/brand: outro-voice.mp3(선택)·sfx-whoosh.mp3·sfx-pop.mp3, gitignore 대상이라 커밋하지 않음) ──
const BRAND_DIRS = [path.join(DIR, 'assets/brand')];
const brandFile = (n) => BRAND_DIRS.map((d) => path.join(d, n)).find((p) => fs.existsSync(p)) ?? null;
// 엔딩 음성: 기본은 없음(엔딩 1.6초 고정, 로고 팝 → 0.1초 간격 페이드인). assets/brand/outro-voice.mp3가 있으면 자동으로 쓴다(엔딩 = 음성 길이 + 0.6초, 이름은 "재미두나우" 순간에 등장). 그 시각은 같은 이름의 .json 글자 타이밍에서, 없으면 마지막 쉼 뒤로 잡는다. 테이크 후보(outro-voice-take*.mp3)는 자동으로 쓰지 않는다
function loadOutro() {
  const voice = brandFile('outro-voice.mp3');
  const pop = brandFile('sfx-pop.mp3'), whoosh = brandFile('sfx-whoosh.mp3');
  if (!pop) console.warn('  경고: assets/brand/sfx-pop.mp3가 없어 로고 팝 효과음 없이 만들어요');
  if (!whoosh) console.warn('  경고: sfx-whoosh.mp3가 없어 전환 효과음 없이 만들어요');
  if (!voice) return { voice: null, sec: OUTRO_SEC_NO_VOICE, nameAt: 0.15, pop, whoosh }; // 음성 없음: 로고 팝(0~0.15초) 뒤에 이름, 0.1초 간격으로 나머지 줄
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
  ff([...loop(bg), ...loop(lg.file), ...texts.flatMap((t) => loop(t.file)), '-filter_complex', g.join(';'), '-map', '[o]', '-an', '-t', outro.sec.toFixed(3), '-r', String(fps), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '10', '-pix_fmt', 'yuv420p', out]);
}

// 카드 장면(블러 디졸브): 카드 직전 컷의 마지막 프레임을 정지 화면으로 깔고(원본 trailer a초 직전 1프레임) 0.4초 동안 배경 블러 0→30px(가우시안 sigma)·밝기 100→60%(ease-out). 카드는 0.05초 늦게 시작해 0.35초 동안 불투명도 0→100%·크기 94→100%·20px 아래에서 위로(ease-out). 값은 프레임마다 sendcmd로 바꾼다
const DISSOLVE = { blurSec: 0.4, blurMax: 30, dim: 0.6, cardDelay: 0.05, cardSec: 0.35, cardFrom: 0.94, cardRise: 20 };
const easeOut = (x) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;
function composeCardScene({ freeze, bg, zoom = 0, sec, clip, out, CACHE, postId }) { // zoom: 카드 시간 동안 배경을 100%→(100+zoom)%로 천천히 확대(ease-in-out) // bg(선택) = {args:[-ss …, -i 영상], pre:'필터'}면 정지 프레임 대신 그 영상(원본 이어서)을 깔고, 끝나면 마지막 프레임을 잡는다
  const { w, h, fps } = RS, D = DISSOLVE;
  const cmd = path.join(CACHE, `trend-${postId}-dissolve.txt`);
  const lines = [];
  for (let k = 0; k <= Math.ceil(D.blurSec * fps) + 1; k++) { // 프레임마다 값 갱신(끝난 뒤에는 마지막 값 유지)
    const t = k / fps, eb = easeOut(t / D.blurSec), ec = easeOut((t - D.cardDelay) / D.cardSec), br = (1 - (1 - D.dim) * eb).toFixed(4);
    lines.push(`${t.toFixed(4)} gblur@bl sigma ${Math.max(0.01, D.blurMax * eb).toFixed(3)}, colorchannelmixer@dm rr ${br}, colorchannelmixer@dm gg ${br}, colorchannelmixer@dm bb ${br}, colorchannelmixer@ca aa ${ec.toFixed(4)};`);
  }
  fs.writeFileSync(cmd, lines.join('\n') + '\n');
  const E = `(1-pow(1-clip((t-${D.cardDelay})/${D.cardSec},0,1),3))`; // 카드 ease-out 진행도 0→1
  const P = `(${D.cardFrom}+${1 - D.cardFrom}*${E})`;
  const g = [
    `[0:v]${bg ? `${bg.pre},tpad=stop_mode=clone:stop_duration=${sec.toFixed(3)},` : ''}fps=${fps},setsar=1,setpts=PTS-STARTPTS,scale=${w}:${h},format=yuv420p,${zoom ? `scale=w='trunc(${w}*(1+${zoom}*(0.5-0.5*cos(PI*min(1,t/${sec.toFixed(3)}))))/2)*2':h='trunc(${h}*(1+${zoom}*(0.5-0.5*cos(PI*min(1,t/${sec.toFixed(3)}))))/2)*2':eval=frame:flags=bicubic,crop=${w}:${h},` : ''}sendcmd=f='${cmd}',gblur@bl=sigma=0.01,colorchannelmixer@dm=rr=1:gg=1:bb=1[bg]`, // freeze = 본편 마지막 프레임(영상 4:5 + 블러 배경까지 합친 1080×1920)
    `[1:v]format=rgba,colorchannelmixer@ca=aa=0,scale=w='trunc(iw*${P}/2)*2':h='trunc(ih*${P}/2)*2':eval=frame[c]`,
    `[bg][c]overlay=x='${clip.cx}-w/2':y='${clip.cy}-h/2+${D.cardRise}*(1-${E})':format=auto,format=yuv420p[o]`,
  ];
  ff([...(bg ? bg.args : ['-loop', '1', '-framerate', String(fps), '-t', sec.toFixed(3), '-i', freeze]), '-loop', '1', '-framerate', String(fps), '-t', sec.toFixed(3), '-i', clip.file, '-filter_complex', g.join(';'), '-map', '[o]', '-an', '-t', sec.toFixed(3), '-r', String(fps), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '10', '-pix_fmt', 'yuv420p', out]);
}

// 렌더 후 검사용: 최종 영상에서 연속한 두 컷의 첫 프레임(영상 부분 4:5 영역)의 SSIM
function ssimOf(a, b) {
  const r = run(['-i', a, '-i', b, '-lavfi', 'ssim', '-f', 'null', '-']);
  const m = /All:([\d.]+)/.exec(r.stderr);
  if (!m) throw new Error('--reel-trend: SSIM을 못 쟀어요');
  return Number(m[1]);
}
export const SCENE_TOL = 0.4;
export const SSIM_MAX = 0.6, RETRY_MAX = 0, SCENE_PICK = 0.2; // SSIM_MAX: 연속 컷의 첫 프레임끼리·중간 프레임끼리 SSIM이 이 값 이상이면 같은 장면으로 본다. SCENE_PICK: 구간을 고를 때 쓰는 장면 전환 감지 기준(0.3보다 예민하게 — 빠른 편집 구간을 피한다)

// 렌더 + 검사: 연속 컷의 첫 프레임 SSIM이 0.9 이상이면 실패로 보고 그 컷(뒤쪽)의 원본 구간 ±3초를 빼고 다시 고른다(최대 4번)
export async function runReelTrend(postId, opts = {}) {
  const banned = [];
  for (let attempt = 0; ; attempt++) {
    const r = await runReelTrendOnce(postId, opts, banned);
    if (!r?.bad?.length) return r;
    console.log(`  ⚠ 연속 컷 SSIM ${SSIM_MAX} 이상(같은 장면): ${r.bad.map((b) => `컷 ${b.i}→${b.i + 1} (${b.ssim.toFixed(3)}, 교체 대상 컷 ${b.k + 1})`).join(', ')}`);
    if (attempt >= RETRY_MAX) { console.log(`  ⛔ ${RETRY_MAX}번 다시 골랐지만 비슷한 컷이 남았어요`); return r; }
    for (const b of r.bad) banned.push({ movie: b.movie, a: b.a - 3, b: b.b + 3 });
    console.log(`  → 그 컷의 원본 구간(±3초)을 빼고 다시 골라 렌더합니다 (${attempt + 1}/${RETRY_MAX})`);
  }
}

// copy.clips: {영상 이름: URL} — 스팀 appdetails의 영상 대신 직접 받은 클립(webm 등, 무음 가능)을 쓴다. cache에 h264 mp4 + 무음 m4a로 바꿔 두고(이미 있으면 다시 받지 않음), 컷의 movie에 그 이름을 쓴다
async function prepareClip(appid, name, url, CACHE, refresh) {
  const id = `${appid}-clip-${name.replace(/[^\w가-힣-]+/g, '_')}`;
  const video = path.join(CACHE, `reel-trailer-${id}.mp4`), audio = path.join(CACHE, `reel-trailer-audio-${id}.m4a`);
  if (refresh || !fs.existsSync(video)) {
    const raw = path.join(CACHE, `clip-src-${id}${path.extname(new URL(url).pathname) || '.bin'}`);
    if (refresh || !fs.existsSync(raw)) { const r = await fetch(url); if (!r.ok) throw new Error(`--reel-trend: clip "${name}"을 못 받았어요 (${r.status})`); fs.writeFileSync(raw, Buffer.from(await r.arrayBuffer())); }
    ff(['-i', raw, '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-pix_fmt', 'yuv420p', video]);
    const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video]).toString());
    ff(['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', String(dur), '-c:a', 'aac', audio]);
  }
  return { name, steam_appid: id, video_url: url, local: { video, audio } };
}

async function runReelTrendOnce(postId, { refresh = false, layout } = {}, banned = []) {
  const copyFile = path.join(DIR, 'copy', `${postId}.json`);
  if (!fs.existsSync(copyFile)) throw new Error(`--reel-trend: ${path.relative(ROOT, copyFile)}이 없어요`);
  const copy = JSON.parse(fs.readFileSync(copyFile, 'utf8'));
  if (JSON.stringify(copy).includes('재밌드나')) throw new Error('화면에는 "재밌드나"를 쓰지 않아요. JamiDuNow만 쓰세요.');
  const FULL = (layout ?? copy.layout) === 'full'; // 9:16 꽉 채우기
  const OUTRO = copy.outro !== false; // 기본: 끝에 공통 엔딩 샷 2초(copy.outro:false면 예전처럼 endClip 1초 루프)
  for (const k of ['narration', 'cuts', ...(OUTRO ? [] : ['endClip'])]) if (!copy[k]) throw new Error(`--reel-trend: copy에 ${k}가 없어요`);
  const facts = await steamFacts(copy.appid, copy);
  const title = copy.cardTitle ?? facts.name;
  console.log('  스팀 값:', JSON.stringify({ ...facts, header: undefined }));

  const CACHE = path.join(DIR, 'cache');
  fs.mkdirSync(CACHE, { recursive: true });
  const endSpec = OUTRO ? null : Array.isArray(copy.endClip) ? { src: copy.endClip } : copy.endClip; // {movie?, src:[시작초, 끝초]}
  const movieNames = [...new Set([...copy.cuts.map((c) => c.movie ?? copy.movie), ...(endSpec ? [endSpec.movie ?? copy.movie] : [])])]; // 컷마다 movie(영상 이름)를 따로 쓸 수 있다
  const srcs = {}, trailers = {};
  for (const mv of movieNames) {
    if (copy.clips?.[mv]) { srcs[mv] = await prepareClip(copy.appid, mv, copy.clips[mv], CACHE, refresh); trailers[mv] = srcs[mv].local.video; continue; }
    srcs[mv] = await steamMovie({ name: facts.name, steam_appid: copy.appid }, mv); trailers[mv] = await trailerFromDb(srcs[mv], CACHE, refresh);
  }
  const partMovies = [...copy.cuts.map((c) => c.movie ?? copy.movie), ...(endSpec ? [endSpec.movie ?? copy.movie] : [])];
  const outDir = path.join(DIR, 'out', postId);
  fs.mkdirSync(outDir, { recursive: true });
  if (!process.env.REEL_PLAN_ONLY) for (const f of ['reel-ig.mp4', 'reel-full.mp4', 'still-subtitle.png', 'still-card.png', 'still-end.png', 'still-outro.png']) fs.rmSync(path.join(outDir, f), { force: true }); // 내레이션 캐시(narration*.mp3·json)와 voice-samples는 남긴다

  const rawNar = await getNarration(outDir, copy.narration);
  const nar = copy.narration.tighten === false ? rawNar : tightenNarration(outDir, rawNar, copy.narration.cacheName ?? 'narration', { ...copy.narration.silence, ...(copy.narration.atempo !== undefined ? { atempo: copy.narration.atempo } : {}) }); // 무음 압축(기본)
  const bodyLen = nar.duration + (endSpec ? 1 : 0);
  // 자막 덩어리(기본): copy.chunks가 없으면 대본을 의미 단위로 자동 분할(subtitle-chunks.mjs, copy.keys = 민트 핵심 구절). 표시 시간이 0.35초(copy.minChunkSec)보다 짧은 덩어리는 다음 덩어리와 합친다
  const chunks = mergeShortChunks(chunkTimeline(nar, copy.chunks ?? autoChunks(copy.narration.text, copy.keys ?? []), bodyLen), copy.minChunkSec ?? MIN_SEC);
  const findChunk = (at) => { const a = chunkPlain(at); return chunks.find((k) => chunkPlain(k.text) === a) ?? chunks.find((k) => chunkPlain(k.text).startsWith(a)) ?? chunks.find((k) => chunkPlain(k.text).includes(a)); }; // 합쳐진 덩어리도 앞부분·포함으로 찾는다
  // 컷 시각: t(초)를 직접 쓰거나, at(자막 덩어리 글자)·offset(초)로 그 말이 시작하는 시각에 맞춘다 — 내레이션 타이밍이 바뀌어도 컷이 말을 따라간다
  let cuts = copy.cuts.map((c, i) => {
    if (c.at === undefined) return c;
    const hit = findChunk(c.at);
    if (!hit) throw new Error(`--reel-trend: cuts[${i}].at "${c.at}"와 같은 자막이 없어요`);
    return { ...c, t: +(hit.start + (c.offset ?? 0)).toFixed(3) };
  }).filter((c, i, a) => i === 0 || c.t - a[i - 1].t > 0.05); // 자막 덩어리가 합쳐져 같은 시각이 된 컷은 앞 컷만 쓴다
  // cardFrom: 이 자막(어절)이 시작하는 순간부터 내레이션 끝까지 정보 카드 장면(하드컷, 자막 숨김). 그 뒤 컷은 영상에서 빠지고 소리만 이어서 쓴다
  const cardHit = copy.cardFrom ? findChunk(copy.cardFrom) : null;
  if (copy.cardFrom && !cardHit) throw new Error(`--reel-trend: cardFrom "${copy.cardFrom}"와 같은 자막이 없어요`);
  const cardAt = cardHit ? +(cardHit.start + (copy.cardOffset ?? 0)).toFixed(3) : null; // cardOffset: 그 어절이 시작한 뒤 이만큼(초) 지나서 카드 시작(앞 장면을 잠깐 보여줄 때)
  const cardMid = cardAt !== null && copy.cardEnd === 'nextCut'; // 카드가 끝까지 가지 않고 다음 컷 시작에서 끝난다(그 뒤 컷이 이어짐, full 레이아웃만)
  if (cardMid && !FULL) throw new Error('--reel-trend: cardEnd는 full 레이아웃에서만 써요');
  // 기본 규칙 1: 컷 경계를 +0.3초 늦추고(내레이션 그대로, copy.cutExtend로 바꿈) 0.8초보다 짧은 컷은 옆 컷과 합친다(copy.minCut). copy.cutExtend:0이면 늦추지 않는다
  if (!endSpec) {
    const before = cuts.length;
    cuts = stretchCuts(cuts, { extend: copy.cutExtend ?? CUT_EXTEND, minCut: copy.minCut ?? MIN_CUT, end: nar.duration, card: cardMid ? null : cardAt });
    console.log(`  컷 경계 +${copy.cutExtend ?? CUT_EXTEND}초, ${copy.minCut ?? MIN_CUT}초 미만 컷 합치기: ${before}컷 → ${cuts.length}컷`);
  }
  // 기본 규칙 2: 원본 구간 중복 방지 + 장면 전환 회피. 컷의 원본 구간은 한 번만 쓴다(다른 컷과 조금이라도 겹치면 아직 안 쓴 다른 구간으로 옮김). 트레일러 원본의 장면 전환(ffmpeg select gt(scene,0.3))이 컷 경계·카드 경계 앞뒤 0.5초 안에 끼지 않게 하고, 구간 안에 전환이 없는 자리를 우선한다(copy.sceneAvoid:false로 전환 회피만 끔)
  // 카드 장면(cardFrom): 카드 직전 컷은 카드 끝까지 한 장면으로 이어진다 — 카드 시작 1초 전부터 카드 끝까지 원본 장면 전환이 없는 구간을 쓰고, 그 컷이 1초보다 짧으면 앞으로 늘린다
  let plannedSegs = null, sceneReport = null;
  const cardEndAt = cardMid ? (cuts.find((c) => c.t > cardAt + 0.05)?.t ?? nar.duration) : null;
  if (cardMid && cardEndAt - cardAt < 0.8) throw new Error(`--reel-trend: 카드가 ${(cardEndAt - cardAt).toFixed(2)}초뿐이에요(cardOffset을 줄이세요)`);
  if (cardAt !== null && !cardMid) {
    cuts = cuts.filter((c) => c.t < cardAt - 0.0005); // 카드 뒤 컷은 쓰지 않는다(소리도 마지막 컷이 이어서)
    const lead = Math.max(0, cardAt - 1), last = cuts.at(-1);
    if (last.t > lead + 0.0005) { // 마지막 컷이 1초보다 짧으면 앞으로 늘린다(앞 컷은 그만큼 줄고, 0.8초 미만이 되면 없앤다)
      cuts = [...cuts.slice(0, -1).filter((c, i) => i === 0 || c.t < lead - MIN_CUT), { ...last, t: +lead.toFixed(3) }];
      console.log(`  카드 직전 컷을 ${last.t.toFixed(2)}→${lead.toFixed(2)}초부터로 앞당김(카드 1초 전부터 한 장면)`);
    }
  }
  if (!endSpec && !FULL) {
    const durOfMovie = {}, probe = (mv) => (durOfMovie[mv] ??= Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', trailers[mv]]).toString()));
    const sceneOf = (mv) => (copy.sceneAvoid === false ? [] : [...detectSceneCuts(trailers[mv], CACHE, SCENE_PICK), ...(copy.sceneExtra?.[mv] ?? [])].sort((x, y) => x - y)); // copy.sceneExtra: {영상 이름: [초…]} — 느린 디졸브처럼 자동 감지가 놓치는 전환을 눈으로 확인해 직접 적는다
    const segIn = cuts.map((c, i) => ({ movie: c.movie ?? copy.movie, a: c.src[0], pin: !!c.pin, dur: (cuts[i + 1]?.t ?? nar.duration) - c.t }));
    // 렌더 전에 원본 프레임으로 먼저 거른다: 연속한 두 컷의 첫 프레임끼리·중간 프레임끼리 SSIM이 0.6 이상이면 같은 장면 — 고정(pin)이 아닌 쪽 컷을 그 구간 ±2초를 빼고 다시 고른다(최대 8번)
    const xOf = (i) => cuts[i].x ?? 0.5, gdir = path.join(CACHE, `trend-${postId}-plan`);
    fs.mkdirSync(gdir, { recursive: true });
    const grab = (a, i, tag) => { const f = path.join(gdir, `${tag}${i}.png`); ff(['-ss', T3(a), '-i', trailers[segIn[i].movie], '-frames:v', '1', '-vf', `crop=ih*4/5:ih:(iw-ih*4/5)*${xOf(i)}:0,scale=${FG_W}:${FG_H}`, f]); return f; };
    const planBans = [...banned];
    let adj;
    for (let it = 0; ; it++) {
      adj = uniqueSources(segIn, sceneOf, { durOf: probe, gap: SCENE_GAP, banned: planBans });
      const fr = adj.map((a, i) => [grab(a.a + 0.02, i, 'f'), grab(a.a + a.dur / 2, i, 'm')]);
      const sims = [];
      let changed = false;
      for (let i = 1; i < adj.length; i++) {
        const v = Math.max(ssimOf(fr[i - 1][0], fr[i][0]), ssimOf(fr[i - 1][1], fr[i][1]));
        sims.push(v);
        if (v < SSIM_MAX) continue;
        const k = !adj[i].pin ? i : !adj[i - 1].pin ? i - 1 : -1;
        if (k < 0) { console.log(`  ⚠ 컷 ${i}→${i + 1}: 원본 프레임 SSIM ${v.toFixed(2)}(비슷)인데 둘 다 고정(pin)이라 못 바꿔요`); continue; }
        planBans.push({ movie: adj[k].movie, a: adj[k].a - 2, b: adj[k].a + adj[k].dur + 2, forCut: k });
        console.log(`  같은 장면(원본 SSIM ${v.toFixed(2)}): 컷 ${i}→${i + 1} → 컷 ${k + 1}을 다른 구간으로 교체`);
        changed = true;
        break; // 하나 바꾸면 처음부터 다시(뒤 컷이 따라 움직일 수 있어서)
      }
      if (!changed || it >= 8) { console.log(`  원본 프레임 SSIM(연속 컷, 기준 ${SSIM_MAX} 미만): 최대 ${Math.max(...sims).toFixed(2)}`); break; }
    }
    adj.forEach((a, i) => { cuts[i].src = [a.a, +(a.a + a.dur).toFixed(3)]; });
    adj.forEach((a, i) => { if (a.moved) console.log(`  원본 구간 이동: 컷 ${i + 1}(t=${cuts[i].t.toFixed(2)}) ${a.shift > 0 ? '+' : ''}${a.shift}초 → ${a.a.toFixed(2)}~${(a.a + a.dur).toFixed(2)}`); });
    for (const mv of new Set(segIn.map((x) => x.movie))) console.log(`  원본 장면 전환(${mv}) ${sceneOf(mv).length}곳`);
    const bad = adj.filter((a) => !a.clean || a.hits.length);
    console.log(bad.length ? `  ⚠ 구간 안·양 끝 ${SCENE_GAP}초 안에 원본 장면 전환이 남은 컷: ${bad.map((a) => `${adj.indexOf(a) + 1}번(${[...a.hits, ...a.inner].join(',')})`).join(' ')}` : `  ✅ 원본 구간 중복 없음 · 컷 안·경계에 원본 장면 전환 없음(컷 ${adj.length}개)`);
    if (cardAt !== null && bad.includes(adj.at(-1))) throw new Error('--reel-trend: 카드 직전 컷에 장면 전환 없는 구간을 못 찾았어요');
    const ov = adj.flatMap((x, i) => adj.slice(i + 1).map((y, k) => ({ i, j: i + 1 + k, o: Math.min(x.a + x.dur, y.a + y.dur) - Math.max(x.a, y.a) }))).filter((p) => p.o > 0.001);
    if (ov.length) throw new Error(`--reel-trend: 원본 구간이 겹치는 컷이 남았어요 ${JSON.stringify(ov)}`);
    plannedSegs = adj;
  }
  // full 레이아웃: 컷마다 원본 구간 안에서만 쓴다. 문장(컷)이 구간보다 길면 0.9배 슬로우, 그래도 모자라면 마지막 프레임을 잡아둔다
  let fsegs = null;
  if (FULL) {
    const vcuts = cuts.filter((c) => cardAt === null || cardMid || c.t < cardAt - 0.0005);
    // 정지 프레임(hold) 금지: 문장(컷)이 원본 구간보다 길면 0.9배까지만 늘린다. 그래도 모자라면 cuts[].fill([{src:[시작,끝], x|pan, movie?}…])의 다른 장면을 뒤에 이어 붙여 채운다(문장당 한 장면 예외, 장면 전환 없는 구간만·같은 장면 반복 금지는 copy 작성자가 지킨다). 그래도 모자라면 오류
    const holdErrors = [];
    fsegs = vcuts.flatMap((c, i) => {
      const end = vcuts[i + 1]?.t ?? (cardMid ? null : cardAt) ?? nar.duration, dur = +(end - c.t).toFixed(3), lastCut = i === vcuts.length - 1;
      const pieces = [{ src: c.src, pan: c.pan ?? [c.x ?? 0.5, c.x ?? 0.5], movie: c.movie ?? copy.movie }, ...(c.fill ?? []).map((p) => ({ src: p.src, pan: p.pan ?? [p.x ?? 0.5, p.x ?? 0.5], movie: p.movie ?? c.movie ?? copy.movie }))];
      const Ls = pieces.map((p) => p.src[1] - p.src[0]), SL = Ls.reduce((a, b) => a + b, 0);
      const speed = pieces.length === 1 ? (c.speed ?? (dur > SL + 0.08 ? 0.9 : 1)) : Math.min(1, SL / dur); // 여러 장면이면 전체를 같은 속도(0.9~1.0)로
      if (SL / speed < dur - 0.04 || speed < 0.9 - 1e-6) { // 모자람(전부 모아서 한 번에 알린다)
        holdErrors.push(`--reel-trend: 컷 ${i + 1}(t=${c.t.toFixed(2)}, ${dur.toFixed(2)}초)이 원본 ${SL.toFixed(2)}초(최대 ${(SL / 0.9).toFixed(2)}초까지 0.9배)보다 길어 정지 프레임이 생겨요 — cuts[${i}].fill에 다른 장면(장면 전환 없는 구간)을 추가하거나 문장을 줄이세요`);
      }
      let t = c.t;
      return pieces.map((pc, k) => {
        const d = pieces.length === 1 ? dur : +(dur * Ls[k] / SL).toFixed(3), L = Ls[k], use = Math.min(L, d * speed), last = lastCut && k === pieces.length - 1;
        const f = { t: +t.toFixed(3), dur: d, a: pc.src[0], L, speed, use, hold: 0, pan: pc.pan, movie: pc.movie, tail: last ? nar.duration - t : d, piece: k + 1, pieces: pieces.length, cut: i + 1 };
        t += d;
        return f;
      });
    });
    if (holdErrors.length) throw new Error(holdErrors.join('\n'));
    for (const [i, f] of fsegs.entries()) console.log(`  컷 ${f.cut}${f.pieces > 1 ? `-${f.piece}` : ''}: t=${f.t.toFixed(2)} 길이 ${f.dur.toFixed(2)}초 · 원본 ${f.a}~${(f.a + f.L).toFixed(2)}(${f.L.toFixed(2)}초) · 속도 ${f.speed}`);
  }
  if (process.env.REEL_PLAN_ONLY) { // 계획만 출력(렌더 안 함)
    const plan = cutTimeline(cuts, null, nar.duration).segs;
    console.log(`  컷 원본 구간(card ${cardAt}, 끝 ${nar.duration.toFixed(2)}): ${plan.map((x, i) => `${i + 1}[t${x.t.toFixed(2)}]:${x.src[0].toFixed(2)}~${x.src[1].toFixed(2)}`).join(' ')}`);
    return;
  }
  const all = cutTimeline(cuts, endSpec?.src, nar.duration); // 전체 컷(소리용). 카드 장면이 있으면 마지막 컷이 카드 끝까지 이어진다
  const bodyDur = all.total; // 내레이션 끝(엔딩 직전)
  const cardScene = cardAt !== null && !cardMid; // 끝까지 가는 카드 장면
  if (cardAt !== null && !OUTRO) throw new Error('--reel-trend: cardFrom(카드 장면)은 엔딩 샷(outro)과 함께 써요');
  const vid = cardScene ? cutTimeline(cuts.filter((c) => c.t < cardAt - 0.0005), null, cardAt) : all; // 영상에 쓰는 컷
  const { parts, segs } = vid;
  const vidDur = vid.total;
  const outro = OUTRO ? loadOutro() : null;
  const total = bodyDur + (outro ? outro.sec : 0); // 전체 길이(엔딩 샷 포함). 본편 영상·자막은 bodyDur까지
  const hasCard = !!copy.card; // card가 없으면 정보 카드 없이(로고 장면 등으로 대신)
  let c0 = -10, c1 = -10;
  if (hasCard) {
    const cardChunk = findChunk(copy.card.chunk);
    if (!cardChunk) throw new Error(`--reel-trend: card.chunk "${copy.card.chunk}"와 같은 자막이 없어요`);
    c0 = cardChunk.start; c1 = c0 + copy.card.sec;
  }
  console.log(`  내레이션 ${nar.duration.toFixed(2)}초 → 영상 ${total.toFixed(2)}초${hasCard ? ` · 카드 ${c0.toFixed(2)}~${c1.toFixed(2)}초` : ' · 카드 없음'}`);
  console.log('  컷:', segs.map((s) => `${s.t.toFixed(2)}(${s.dur.toFixed(2)})`).join(' '), `· 마지막 알 ${nar.duration.toFixed(2)}`);
  console.log('  자막:', chunks.map((c) => `${c.text} ${c.start.toFixed(2)}~${c.to.toFixed(2)}`).join(' | '));
  const font = fs.readFileSync(path.join(ROOT, 'node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2')).toString('base64');
  const imgB64 = hasCard || cardAt !== null ? (await fetchCardImage(copy.appid, facts.header)).b64 : '';

  // 오버레이 PNG: 로고(전체 화면) · 자막 덩어리별(글자 영역만 잘라냄, 가운데 좌표 기억) · 카드(전체 화면)
  const subs = [];
  let cardClip = null;
  const logoPng = path.join(CACHE, `trend-${postId}-logo.png`), cardPng = path.join(CACHE, `trend-${postId}-card.png`);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: RS.w, height: RS.h } });
    const subPage = await (await browser.newContext({ viewport: { width: RS.w, height: RS.h }, deviceScaleFactor: 2 })).newPage(); // 자막은 2배 해상도로 그린다
    const full = { x: 0, y: 0, width: RS.w, height: RS.h };
    const load = async (html) => { await page.setContent(html, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready); };
    await load(logoHtml(font, FULL ? 170 : undefined, FULL));
    await page.screenshot({ path: logoPng, clip: full, omitBackground: true });
    for (let i = 0; i < chunks.length; i++) {
      if (cardScene && chunks[i].start >= vidDur - 0.02) break; // 카드 장면에는 자막 없음
      if (cardScene) chunks[i].to = Math.min(chunks[i].to, vidDur);
      await subPage.setContent(subHtml(font, chunks[i].text, FULL ? (i === 0 ? 104 : 84) : 72, FULL), { waitUntil: 'load' }); await subPage.evaluate(() => document.fonts.ready);
      const r = await subPage.evaluate(() => { const b = document.getElementById('s').getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height }; });
      const W = Math.ceil(r.w / 2) * 2 + 64, H = Math.ceil(r.h / 2) * 2 + 64; // 외곽선 여유, 가운데 유지
      const file = path.join(CACHE, `trend-${postId}-sub${i}.png`);
      const big = await subPage.screenshot({ clip: { x: Math.round(SUB_X - W / 2), y: Math.round((FULL ? SUB_Y_FULL : SUB_Y) - H / 2), width: W, height: H }, omitBackground: true }); // 2배(2W×2H)
      await sharp(big).resize(W, H, { kernel: 'lanczos3' }).png().toFile(file); // 50%로 줄임
      if (SUB_X + r.w / 2 > RS.w - RS.rightGap || SUB_X - r.w / 2 < 0) throw new Error(`--reel-trend: 자막 "${chunks[i].text}"가 안전 영역(오른쪽 140px)을 넘어요`);
      subs.push({ file, ...chunks[i] });
    }
    if (hasCard || cardAt !== null) {
    await load(cardHtml(font, facts, title, imgB64));
    const fit = await page.evaluate(() => { const el = document.querySelector('.i'); const max = el.clientWidth; let sz = 40; el.style.whiteSpace = 'nowrap'; el.style.display = 'inline-block'; el.style.width = 'auto'; while (el.scrollWidth > max && sz > 26) { sz -= 1; el.style.fontSize = `${sz}px`; } const ok = el.scrollWidth <= max; el.style.display = ''; el.style.width = ''; return { sz, ok }; });
    console.log(`  카드 정보 줄 ${fit.sz}px${fit.ok ? '' : ' (넘침)'}`);
    const cr = await page.evaluate(() => { const b = document.getElementById('c').getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; });
    console.log(`  카드 영역 ${JSON.stringify(cr)}`);
    if (cr[0] < 0 || cr[2] > RS.w || cr[3] > SAFE_BOTTOM) throw new Error('--reel-trend: 정보 카드가 화면(아래 25% 제외)을 넘어요'); // 가운데 고정이라 오른쪽 여백 규칙은 안 쓴다
    if (hasCard) await page.screenshot({ path: cardPng, clip: full, omitBackground: true });
    if (cardAt !== null) { // 카드 장면용: 카드만 잘라냄(그림자 여유 60px), 가운데 좌표 기억
      const P = 60;
      cardClip = { file: path.join(CACHE, `trend-${postId}-cardclip.png`), cx: (cr[0] + cr[2]) / 2, cy: (cr[1] + cr[3]) / 2 };
      await page.screenshot({ path: cardClip.file, clip: { x: Math.max(0, cr[0] - P), y: cr[1] - P, width: Math.min(RS.w - Math.max(0, cr[0] - P), cr[2] - cr[0] + 2 * P), height: cr[3] - cr[1] + 2 * P }, omitBackground: true });
      cardClip.cx = Math.max(0, cr[0] - P) + Math.min(RS.w - Math.max(0, cr[0] - P), cr[2] - cr[0] + 2 * P) / 2; cardClip.cy = cr[1] - P + (cr[3] - cr[1] + 2 * P) / 2;
    }
    }
  } finally { await browser.close(); }

  // 영상: 컷을 이어 붙여 1920 높이로 맞춘 뒤 가운데 크롭(1080×1920). 워터마크 → 자막(팝, 카드 중엔 위로) → 카드(아래에서 올라옴)
  const { w, h, fps } = RS;
  const n = FULL ? fsegs.length : parts.length; // full: 입력 하나 = 컷 조각 하나(fill 포함)
  const T = (v) => v.toFixed(3);
  const vin = FULL ? fsegs.flatMap((f, i) => ['-ss', String(f.a), '-t', T(f.use + 0.05), '-i', trailers[f.movie]]) : parts.flatMap(([a, b], i) => ['-ss', String(a), '-t', String(b - a), '-i', trailers[partMovies[i]]]);
  const oin = [
    ['-loop', '1', '-framerate', String(fps), '-t', T(vidDur), '-i', logoPng],
    ...subs.map((c) => ['-itsoffset', T(c.start), '-loop', '1', '-framerate', String(fps), '-t', T(c.to - c.start + 0.1), '-i', c.file]),
    ...(hasCard ? [['-itsoffset', T(c0), '-loop', '1', '-framerate', String(fps), '-t', T(copy.card.sec + 0.1), '-i', cardPng]] : []),
  ].flat();
  const xs = [...cuts.map((c) => c.x ?? 0.5), 0.5]; // 구간별 가로 크롭 위치(0=왼쪽 끝, 1=오른쪽 끝)
  const fullPer = FULL ? fsegs.map((f, i) => { // 9:16 가운데 크롭(컷마다 x·pan), 슬로우·잡아두기 반영
    const [x0, x1] = f.pan, xe = x0 === x1 ? `${x0}` : `(${x0}+(${x1}-${x0})*min(1,t/${T(f.dur)}))`;
    return `[${i}:v]setpts=(PTS-STARTPTS)/${f.speed},fps=${fps},setsar=1,tpad=stop_mode=clone:stop_duration=${T(f.dur + 1)},trim=duration=${T(f.dur)},setpts=PTS-STARTPTS,crop=w=trunc(ih*9/16/2)*2:h=ih:x='(iw-ow)*${xe}':y=0,scale=${w}:${h}:flags=lanczos,setsar=1[f${i}]`;
  }) : null;
  const per = FULL ? fullPer : parts.map((_, i) => `[${i}:v]fps=${fps},setsar=1,split[a${i}][b${i}];[a${i}]crop=ih*4/5:ih:(iw-ih*4/5)*${xs[i]}:0,scale=${FG_W}:${FG_H}[f${i}];[b${i}]trim=end_frame=1,tpad=stop_mode=clone:stop_duration=${T(parts[i][1] - parts[i][0] + 1)},scale=-2:480,crop=270:480,gblur=sigma=10,scale=${w}:${h},colorchannelmixer=rr=0.65:gg=0.65:bb=0.65[g${i}]`); // 배경: 컷의 첫 프레임 한 장을 정지 화면으로 — 1/4로 줄여 시그마 10으로 블러(=원래 크기 약 40px)한 뒤 키우고 35% 어둡게(움직이는 배경은 인스타 압축에서 뭉개진다)
  const g = [FULL ? `${per.join(';')};${fsegs.map((_, i) => `[f${i}]`).join('')}concat=n=${n}:v=1:a=0[vf];[vf]format=yuv420p,split[v0][v0c]` : `${per.join(';')};${parts.map((_, i) => `[f${i}]`).join('')}concat=n=${n}:v=1:a=0[vf];${parts.map((_, i) => `[g${i}]`).join('')}concat=n=${n}:v=1:a=0[vb];[vb][vf]overlay=x=${FG_X}:y=${FG_Y}:format=auto,split[v0][v0c]`];
  g.push(`[v0][${n}:v]overlay=format=auto[v1]`);
  subs.forEach((c, i) => {
    const k = n + 1 + i, P = `(${POP_FROM}+${1 - POP_FROM}*min(1,max(0,(t-${T(c.start)})/${POP})))`;
    g.push(`[${k}:v]format=rgba,scale=w='trunc(iw*${P}/2)*2':h='trunc(ih*${P}/2)*2':eval=frame[p${i}]`);
    g.push(`[v${i + 1}][p${i}]overlay=x='${SUB_X}-w/2':y='if(between(t,${T(c0)},${T(c1)}),${SUB_Y_CARD},${FULL ? SUB_Y_FULL : SUB_Y})-h/2':eof_action=pass:enable='between(t,${T(c.start)},${T(c.to)})':format=auto[v${i + 2}]`);
  });
  const kc = n + 1 + subs.length, last = subs.length + 1;
  if (!hasCard) g.push(`[v${last}]format=yuv420p[o]`);
  else g.push(`[v${last}][${kc}:v]overlay=x=0:y='if(lt(t-${T(c0)},${CARD_IN}),${CARD_SLIDE}*pow(1-(t-${T(c0)})/${CARD_IN},2),0)':eof_action=pass:enable='between(t,${T(c0)},${T(c1)})':format=auto,format=yuv420p[o]`);
  const silent = path.join(CACHE, `trend-${postId}-silent.mp4`), cleanMp4 = path.join(CACHE, `trend-${postId}-clean.mp4`), lastPng = path.join(CACHE, `trend-${postId}-last.png`);
  if (process.env.REEL_DEBUG) fs.writeFileSync(path.join(CACHE, `trend-${postId}-graph.txt`), JSON.stringify({ args: [...vin, ...oin], graph: g.join(';') }));
  ff(['-filter_threads', '1', ...vin, ...oin, '-filter_complex', g.join(';'), '-map', '[o]', '-an', '-t', T(vidDur), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '10', '-pix_fmt', 'yuv420p', silent, '-map', '[v0c]', '-an', '-t', T(vidDur), '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '10', '-pix_fmt', 'yuv420p', cleanMp4]); // 중간 파일은 거의 무손실(crf 10) — 마지막에 한 번만 crf 18로 인코딩
  if (FULL) { // 엔딩 샷 배경: 마지막 컷의 원본이 이어진 끝 장면(원본 구간 안)을 9:16 크롭으로
    const f = fsegs.at(-1), at = f.a + Math.max(0, Math.min(f.L, f.tail * f.speed) - 0.05);
    ff(['-ss', T(at), '-i', trailers[f.movie], '-frames:v', '1', '-vf', `crop=w=trunc(ih*9/16/2)*2:h=ih:x='(iw-ow)*${f.pan[1]}':y=0,scale=${w}:${h}:flags=lanczos`, lastPng]);
  } else { // 엔딩 샷 배경: 마지막 컷의 장면 1장을 본편과 같은 4:5 + 블러 구성으로(로고·자막 없이)
    const li = cuts.length - 1, [la, lb] = all.parts[li]; // 마지막 컷(카드 장면이 있으면 카드 끝까지 이어진 구간)의 끝 장면
    ff(['-ss', T(lb - 0.05), '-i', trailers[partMovies[li]], '-ss', T(la), '-i', trailers[partMovies[li]], '-frames:v', '1', '-filter_complex', `[0:v]crop=ih*4/5:ih:(iw-ih*4/5)*${xs[li]}:0,scale=${FG_W}:${FG_H}[f];[1:v]scale=-2:480,crop=270:480,gblur=sigma=10,scale=${w}:${h},colorchannelmixer=rr=0.65:gg=0.65:bb=0.65[g];[g][f]overlay=x=${FG_X}:y=${FG_Y}:format=auto[o]`, '-map', '[o]', lastPng]);
  }

  const m4a = path.join(CACHE, `trend-${postId}-audio.m4a`), gameM4a = path.join(CACHE, `trend-${postId}-game.m4a`);
  const audioFiles = {};
  for (const mv of movieNames) audioFiles[mv] = srcs[mv].local ? srcs[mv].local.audio : await trailerAudioFromDb(srcs[mv], CACHE, refresh);
  let audioIn = partMovies.map((mv) => audioFiles[mv]), aParts0 = all.parts;
  if (FULL) { // 컷마다 원본 구간 안의 소리만(슬로우면 같은 비율로 늘림), 모자라면 무음. 마지막 컷은 카드 끝까지
    audioIn = fsegs.map((f, i) => { const wav = path.join(CACHE, `trend-${postId}-aseg${i}.wav`), len = f.tail + 0.4;
      ff(['-ss', T(f.a), '-t', T(f.use), '-i', audioFiles[f.movie], '-af', `${f.speed < 0.5 ? `atempo=0.5,atempo=${(f.speed / 0.5).toFixed(4)}` : `atempo=${f.speed}`},apad=whole_dur=${T(len)}`, '-t', T(len), '-c:a', 'pcm_s16le', wav]); return wav; });
    aParts0 = fsegs.map((f) => [0, f.tail]);
  }
  const aParts = aParts0.map((p, i) => (OUTRO && !FULL && i === aParts0.length - 1 ? [p[0], p[1] + OUTRO_GAME_TAIL] : p)); // 엔딩 샷이 붙으면 마지막 컷 소리를 0.3초 더 떠서, 컷 뒤 0.3초 동안 페이드아웃
  const { measured } = buildAudio({ audio: audioIn, copy: { segments: aParts.slice(0, -1), endClip: aParts[aParts.length - 1] }, out: gameM4a });
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
    console.log(`  엔딩 ${outro.sec.toFixed(2)}초(음성 ${outro.voice ? path.relative(ROOT, outro.voice) : '없음'}, 이름 등장 ${outro.nameAt.toFixed(2)}초)`);
    const list = path.join(CACHE, `trend-${postId}-concat.txt`);
    let cardMp4 = null;
    if (cardScene) {
      cardMp4 = path.join(CACHE, `trend-${postId}-cardscene.mp4`);
      const freeze = path.join(CACHE, `trend-${postId}-freeze.png`); // 카드 배경 = 본편 영상의 실제 마지막 프레임(블러가 시작되는 순간 화면에 보이던 프레임, 자막·로고만 뺌)
      ff(['-sseof', '-0.2', '-i', cleanMp4, '-update', '1', freeze]); // 구간 끝 0.2초를 모두 풀어 마지막 프레임이 남는다
      let bg = null;
      if (FULL) { // 마지막 컷의 원본을 이어서(원본 구간이 끝나면 마지막 프레임을 잡아둠)
        const f = fsegs.at(-1), played = f.dur * f.speed, start = f.a + Math.min(played, Math.max(0, f.L - 0.1)), rest = Math.max(0.1, f.a + f.L - start);
        bg = { args: ['-ss', T(start), '-t', T(rest), '-i', trailers[f.movie]], pre: `crop=w=trunc(ih*9/16/2)*2:h=ih:x='(iw-ow)*${f.pan[1]}':y=0,scale=${w}:${h}:flags=lanczos` };
        console.log(`  카드 배경: 원본 ${start.toFixed(2)}~${(start + rest).toFixed(2)}를 이어서 깔고 이후 ${Math.max(0, bodyDur - cardAt - rest).toFixed(2)}초는 마지막 프레임`);
      }
      composeCardScene({ freeze, bg, zoom: FULL ? 0.04 : 0, sec: bodyDur - cardAt, clip: cardClip, out: cardMp4, CACHE, postId });
      console.log(`  카드 장면 ${cardAt.toFixed(2)}~${bodyDur.toFixed(2)}초: 본편 마지막 프레임 정지 + 블러 디졸브, 자막 숨김`);
    }
    let bodyMp4 = silent;
    if (cardMid) { // 카드가 중간에 끼는 경우: 카드가 덮는 구간(cardAt~cardEnd)만 카드 장면으로 바꿔 끼운다. 카드 배경은 그 시각에 재생 중이던 컷의 원본을 이어서
      cardMp4 = path.join(CACHE, `trend-${postId}-cardscene.mp4`);
      const f = fsegs.filter((x) => x.t <= cardAt + 0.0005).at(-1), played = (cardAt - f.t) * f.speed, start = f.a + Math.min(played, Math.max(0, f.L - 0.1)), rest = Math.max(0.1, f.a + f.L - start);
      const bg = { args: ['-ss', T(start), '-t', T(rest), '-i', trailers[f.movie]], pre: `crop=w=trunc(ih*9/16/2)*2:h=ih:x='(iw-ow)*${f.pan[1]}':y=0,scale=${w}:${h}:flags=lanczos` };
      composeCardScene({ freeze: null, bg, zoom: 0.04, sec: cardEndAt - cardAt, clip: cardClip, out: cardMp4, CACHE, postId });
      bodyMp4 = path.join(CACHE, `trend-${postId}-silent-mid.mp4`);
      ff(['-i', silent, '-i', cardMp4, '-filter_complex', `[0:v]trim=end=${T(cardAt)},setpts=PTS-STARTPTS[a];[1:v]setpts=PTS-STARTPTS[b];[0:v]trim=start=${T(cardEndAt)},setpts=PTS-STARTPTS[c];[a][b][c]concat=n=3:v=1:a=0,fps=${fps},format=yuv420p[o]`, '-map', '[o]', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '10', '-pix_fmt', 'yuv420p', bodyMp4]);
      console.log(`  카드 장면(중간) ${cardAt.toFixed(2)}~${cardEndAt.toFixed(2)}초: 컷 원본 ${start.toFixed(2)}~${(start + rest).toFixed(2)}를 이어서 깔고 블러 디졸브, 뒤 컷 이어짐`);
    }
    fs.writeFileSync(list, `file '${bodyMp4}'\n${cardMp4 && !cardMid ? `file '${cardMp4}'\n` : ''}file '${outroMp4}'\n`);
    silentAll = path.join(CACHE, `trend-${postId}-silent-all.mp4`);
    ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silentAll]);
  }
  const mp4 = path.join(outDir, FULL ? 'reel-full.mp4' : 'reel-ig.mp4');
  // 최종 인코딩: 인스타 업로드용(encodeInstaFinal) — 믹스 오디오(96kHz)도 여기서 48kHz AAC로 다시 담는다
  encodeInstaFinal({ video: silentAll, audio: m4a, out: mp4, w, h, fps, passlog: path.join(CACHE, `trend-${postId}-x264pass`) });

  // 렌더 후 검사 1: 연속한 두 컷의 첫 프레임끼리·중간 프레임끼리(영상 4:5 영역) SSIM이 0.6 이상이면 같은 장면으로 보고 뒤 컷을 다른 구간으로 교체(고정 pin 컷이면 앞 컷을 교체)
  const bad = [], ssims = [];
  {
    const grab = (name, at) => { const f = path.join(CACHE, `trend-${postId}-${name}.png`); ff(['-ss', T(at), '-i', mp4, '-frames:v', '1', '-vf', FULL ? 'scale=1080:1920' : `crop=${FG_W}:${FG_H}:${FG_X}:${FG_Y}`, f]); return f; };
    const first = segs.map((x, i) => grab(`first${i}`, x.t + 0.02)), mid = segs.map((x, i) => grab(`mid${i}`, x.t + x.dur / 2));
    for (let i = 1; i < segs.length; i++) {
      const a = ssimOf(first[i - 1], first[i]), b = ssimOf(mid[i - 1], mid[i]);
      ssims.push({ i, first: a, mid: b });
      if (Math.max(a, b) >= SSIM_MAX) {
        if (FULL) { console.log(`  ⚠ 컷 ${i}→${i + 1} 비슷(SSIM ${Math.max(a, b).toFixed(2)})`); continue; }
        const k = plannedSegs?.[i]?.pin ? i - 1 : i, sg = plannedSegs?.[k];
        if (sg && !sg.pin) bad.push({ i, k, ssim: Math.max(a, b), movie: sg.movie, a: sg.a, b: sg.a + sg.dur });
        else console.log(`  ⚠ 컷 ${i}→${i + 1}가 비슷하지만(SSIM ${Math.max(a, b).toFixed(2)}) 둘 다 고정(pin)이라 못 바꿔요`);
      }
    }
    console.log(`  연속 컷 SSIM(첫 프레임/중간 프레임, 기준 ${SSIM_MAX} 미만): 최대 ${Math.max(...ssims.map((v) => Math.max(v.first, v.mid))).toFixed(3)} — ${ssims.map((v) => `${v.i}→${v.i + 1} ${v.first.toFixed(2)}/${v.mid.toFixed(2)}`).join(' ')}`);
  }
  // 렌더 후 검사 2: 최종 영상의 장면 전환 시각(ffmpeg select gt(scene,0.25)) 전부 + 의도한 경계(컷 경계·카드 시작·엔딩 시작)와 대조
  {
    const r = run(['-i', mp4, '-an', '-vf', "scale=320:-2,select='gt(scene,0.25)',showinfo", '-f', 'null', '-']);
    const times = [...r.stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
    const planned = [...new Set([...segs.map((x) => x.t).slice(1), ...(fsegs ? fsegs.map((x) => x.t).slice(1) : []), ...(cardAt !== null ? [cardAt] : []), bodyDur])];
    const unplanned = times.filter((x) => !planned.some((p) => Math.abs(p - x) < SCENE_TOL)); // planned = 컷 +0.3초 연장을 이미 반영한 실제 경계(segs.t). 허용 오차 0.4초(컷 경계 앞뒤 원본 전환·페이드 때문에 감지 시각이 조금 어긋남)
    const doubles = times.slice(1).map((x, i) => [times[i], x]).filter(([x, y]) => y - x < 0.3); // 0.3초 안에 전환이 두 번 난 곳
    sceneReport = { times, planned, unplanned, doubles };
    fs.writeFileSync(path.join(outDir, 'scene-check.txt'), `최종 영상 장면 전환(gt(scene,0.25)) ${times.length}곳\n${times.map((x) => x.toFixed(3)).join(' ')}\n의도한 경계 ${planned.length}곳\n${planned.map((x) => x.toFixed(3)).join(' ')}\n의도하지 않은 전환 ${unplanned.length}곳\n${unplanned.map((x) => x.toFixed(3)).join(' ')}\n0.3초 안에 두 번 난 전환 ${doubles.length}곳\n${doubles.map(([x, y]) => `${x.toFixed(3)}~${y.toFixed(3)}`).join(' ')}\n`);
    console.log(`  최종 영상 장면 전환 ${times.length}곳: ${times.map((x) => x.toFixed(2)).join(' ')}`);
    console.log(`  의도한 경계 ${planned.length}곳: ${planned.map((x) => x.toFixed(2)).join(' ')} → 의도 밖 전환(±${SCENE_TOL}초 밖) ${unplanned.length}곳${unplanned.length ? ': ' + unplanned.map((x) => x.toFixed(2)).join(' ') : ''}`);
    console.log(`  0.3초 안에 전환이 두 번 난 곳 ${doubles.length}곳${doubles.length ? ': ' + doubles.map(([x, y]) => `${x.toFixed(3)}·${y.toFixed(3)}`).join(' ') : ''}`);
  }
  // 렌더 후 검사 3(기본): freezedetect(n=0.003, d=0.25) — 엔딩 카드 구간(카드 장면 시작 또는 엔딩 시작부터 끝까지)을 뺀 곳에 정지가 하나라도 있으면 실패. 구간은 scene-check.txt에 적는다
  let freezeFail = null;
  {
    const exemptFrom = cardAt ?? bodyDur;
    const r = run(['-i', mp4, '-an', '-vf', 'freezedetect=n=0.003:d=0.25', '-f', 'null', '-']);
    const st = [...r.stderr.matchAll(/freeze_start: ([\d.]+)/g)].map((m) => Number(m[1])), en = [...r.stderr.matchAll(/freeze_end: ([\d.]+)/g)].map((m) => Number(m[1]));
    const total = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString());
    const freezes = st.map((a, k) => ({ a, b: en[k] ?? total })).filter((f) => f.a < exemptFrom - 0.05);
    freezeFail = freezes;
    const line = freezes.length ? `정지(freezedetect n=0.003 d=0.25, 엔딩 카드 ${exemptFrom.toFixed(2)}초~ 제외) ${freezes.length}곳 — 실패\n${freezes.map((f) => `${f.a.toFixed(3)}~${f.b.toFixed(3)} (${(f.b - f.a).toFixed(2)}초)`).join('\n')}\n` : `정지(freezedetect n=0.003 d=0.25, 엔딩 카드 ${exemptFrom.toFixed(2)}초~ 제외) 0곳 — 통과\n`;
    fs.appendFileSync(path.join(outDir, 'scene-check.txt'), line);
    console.log(`  ${freezes.length ? '⛔ ' : '✅ '}${line.split('\n')[0]}${freezes.length ? ': ' + freezes.map((f) => `${f.a.toFixed(2)}~${f.b.toFixed(2)}`).join(' ') : ''}`);
  }
  // 확인용 타일(copy.checkTiles: [[시작초, 끝초], …]) — 0.1초 간격 프레임 → out/<post-id>/check-<시작>-<끝>.png
  for (const [a, b] of copy.checkTiles ?? []) {
    const f = path.join(outDir, `check-${a}-${b}.png`);
    ff(['-ss', T(a), '-t', T(b - a), '-i', mp4, '-an', '-vf', `fps=10,scale=216:-2,drawtext=text='%{pts\\:flt}':x=4:y=4:fontsize=20:fontcolor=yellow:box=1:boxcolor=black@0.6,tile=10x${Math.ceil(((b - a) * 10) / 10)}`, '-frames:v', '1', f]);
    console.log(`  확인 타일: ${path.relative(ROOT, f)}`);
  }

  // 정지 이미지: 자막 장면 1장(곡괭이 비트, 팝이 끝난 뒤), 정보 카드 1장(다 올라온 뒤)
  const pick = chunks.find((c) => chunkPlain(c.text).includes(chunkPlain(copy.stillChunk ?? '곡괭이'))) ?? chunks[Math.floor(chunks.length / 2)];
  ff(['-ss', T(pick.start + 0.25), '-i', mp4, '-frames:v', '1', path.join(outDir, 'still-subtitle.png')]);
  const second = hasCard ? 'still-card.png' : OUTRO ? 'still-outro.png' : 'still-end.png'; // 카드가 있으면 카드, 없으면 엔딩 샷(없으면 마지막 로고 장면)
  const secondAt = hasCard ? c0 + 1.2 : OUTRO ? bodyDur + Math.min(outro.sec - 0.2, outro.nameAt + 0.6) : bodyDur - 0.3; // 엔딩은 세 줄이 다 나온 뒤
  ff(['-ss', T(secondAt), '-i', mp4, '-frames:v', '1', path.join(outDir, second)]);
  if (cardAt !== null) ff(['-ss', T(cardAt + 0.4), '-i', mp4, '-frames:v', '1', path.join(outDir, 'still-card.png')]);
  if ((hasCard || cardAt !== null) && OUTRO) ff(['-ss', T(bodyDur + Math.min(outro.sec - 0.2, outro.nameAt + 0.6)), '-i', mp4, '-frames:v', '1', path.join(outDir, 'still-outro.png')]);
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString());
  console.log(`${path.relative(ROOT, mp4)} (${dur.toFixed(2)}초, 내레이션 + 덕킹한 원본 오디오 측정 ${measured} LUFS → -14 LUFS, 구간 경계 0.1초 크로스페이드)`);
  console.log(path.relative(ROOT, path.join(outDir, 'still-subtitle.png')), path.relative(ROOT, path.join(outDir, second)));
  if (freezeFail?.length) throw new Error(`--reel-trend: 정지 프레임 ${freezeFail.length}곳(${freezeFail.map((f) => `${f.a.toFixed(2)}~${f.b.toFixed(2)}`).join(' ')}) — scene-check.txt 참고`);
  return { bad, ssims, sceneReport };
}
