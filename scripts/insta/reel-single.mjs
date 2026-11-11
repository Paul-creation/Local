// scripts/insta/reel-single.mjs
// --reel-single: 게임 하나를 소개하는 세로 릴스(1080×1920, 무음). 텍스트 고정형 — 처음부터 끝까지 같은 글씨, 트레일러만 흐른다
// 레이아웃: 위 로고 · 글씨(전부 가운데 정렬, 기준 x 470 = 오른쪽 140px 비운 폭의 가운데) y 232~ · 영상 y 560~1168(1080×608) · 설명 y 1230~1400
//   글씨 블록: 1줄 흰색 88px Bold(title1) · 2줄 민트 96px Bold(title2), 줄 간격 1.15 · 그 아래 작은 정보 2줄 흰색 34px(info1: copy 문구, info2: "한국어 … / N~N인" DB 값)
//   옛 copy(kicker+title)는 kicker→title1, title→title2로 읽고, info1이 없으면 정보 줄 1줄(infoLine)만 쓴다
// 실행: npm run insta -- <post-id> --reel-single [--audio]   (문구·구간은 copy/<post-id>.json, 가격·인원·한국어는 DB 값)
//   --audio(또는 copy의 "audio": true): 트레일러 원본 오디오를 같은 구간만큼 붙인다(컷 경계 0.1초 크로스페이드, -14 LUFS, 끝 0.8초 페이드아웃). --audio 플래그는 reel-audio.mp4를 따로, copy의 audio는 reel.mp4에 바로 넣는다. 기본은 무음
// copy 옵션: movie(스팀 appdetails movies의 영상 이름 — 없으면 DB video_url), layout:"wide"(영상 1080×668 가운데 크롭 y 560~1228, 설명 52px Bold 가운데 정렬 영상 아래 50px·줄 간격 1.2, 오른쪽 140px과 겹치면 48px),
//   brightness(예: "brightness=0.05:gamma=1.15" → ffmpeg eq), videoFocusX(0~1, 좌우 크롭 위치)
// 정보 줄: 출시 예정(release_status coming_soon + 날짜 있음)이면 "MM.DD 출시 예정 / 무료 데모 / 최대 N인 / 한국어 …"(데모 있을 때만 "무료 데모" 칸), 출시 30일 이내(할인 없음)면 "MM.DD 출시 / ₩가격 / 최대 N인 / 한국어 …". 그 외: 할인 중이면 "~M/D -N% 할인 / 최대 N인 / 한국어 …", 아니면 "₩13,800 / 최대 N인 / 한국어 …" (한국어는 DB korean_support 값, 없으면 미지원)
import fs from 'fs';
import path from 'path';
import { CACHE_DIR, OUT_DIR } from './paths.mjs';
import { fileURLToPath } from 'url';
import { execFileSync, spawnSync } from 'child_process';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { hasKorean, latestKrw, saleEndOf } from './pick-roundup.mjs';
import { trailerFromDb } from './reel.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '../..');
export const RS = { w: 1080, h: 1920, fps: 30, videoTop: 560, videoH: 608, rightGap: 140, left: 64 };
const MINT = '#5CF2B0';
const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export function infoLine(game) {
  const row = latestKrw(game);
  const ko = hasKorean(game) ? `한국어 ${game.korean_support}` : '한국어 미지원';
  const rel = game.release_date && /^\d{4}-(\d\d)-(\d\d)/.exec(game.release_date);
  const mmdd = rel ? `${rel[1]}.${rel[2]}` : null;
  const price = game.is_free ? '무료' : row ? `₩${Math.round(row.price).toLocaleString('ko-KR')}` : null;
  if (game.release_status === 'coming_soon' && mmdd) return [`${mmdd} 출시 예정`, game.demo_appid && '무료 데모', `최대 ${game.max_players}인`, ko].filter(Boolean).join(' / ');
  const days = rel ? (Date.now() - new Date(game.release_date).getTime()) / 864e5 : null;
  if (mmdd && days >= 0 && days <= 30 && !(row?.discount_percent > 0) && price) return `${mmdd} 출시 / ${price} / 최대 ${game.max_players}인 / ${ko}`;
  const head = row?.discount_percent > 0 ? `~${saleEndOf(row)} -${row.discount_percent}% 할인`
    : game.is_free ? '무료' : row ? `₩${Math.round(row.price).toLocaleString('ko-KR')}` : null;
  if (!head) throw new Error(`--reel-single: ${game.name} 가격이 DB에 없어요`);
  return `${head} / 최대 ${game.max_players}인 / ${ko}`;
}

// 새 정보 2줄: 1줄은 copy.info1(없으면 infoLine), 2줄은 "한국어 … / 1~4인"(DB min_players·max_players·korean_support)
export function infoLines(game, copy) {
  if (copy.infoText) return [copy.infoText]; // 고정 문구(DB 값 대신 그대로 쓴다)
  if (copy.infoAuto) { // 한 줄 "(MM.DD 출시 예정 · 무료 데모 / 1~4인 / 한국어 …)": 날짜는 coming_soon+날짜 있을 때만, 무료 데모는 demo_appid 있을 때만, 인원은 DB(혼자 가능이면 1부터)
    const rel = game.release_date && /^\d{4}-(\d\d)-(\d\d)/.exec(game.release_date);
    const lo = game.solo_playable ? 1 : (game.min_players ?? 1), hi = game.max_players;
    const ko = hasKorean(game) ? `한국어 ${game.korean_support}` : '한국어 미지원';
    const head = game.release_status === 'coming_soon' && rel ? `${rel[1]}.${rel[2]} 출시 예정 · ` : '';
    return [`(${head}${[game.demo_appid && '무료 데모', `${lo === hi ? hi : `${lo}~${hi}`}인`, ko].filter(Boolean).join(' / ')})`];
  }
  if (!copy.info1) return [infoLine(game)];
  const ko = hasKorean(game) ? `한국어 ${game.korean_support}` : '한국어 미지원';
  const lo = game.min_players ?? 1, hi = game.max_players;
  return [copy.info1, `${ko} / ${lo === hi ? hi : `${lo}~${hi}`}인`];
}

const wide = (copy) => copy.layout === 'wide';
const videoHOf = (copy) => (wide(copy) ? 668 : RS.videoH);

function html(copy, infos, font) {
  const { w, h, left, rightGap } = RS;
  const W = wide(copy);
  const descTop = RS.videoTop + videoHOf(copy) + (W ? 50 : 2); // 와이드: 영상 아래 50px
  const width = w - left - rightGap; // 글씨가 들어갈 폭
  return `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: P; src: url(data:font/woff2;base64,${font}); font-weight: 100 900; }
* { margin: 0; box-sizing: border-box; } html, body { width: ${w}px; height: ${h}px; background: transparent; overflow: hidden; font-family: P, sans-serif; }
.box { position: absolute; left: ${left}px; width: ${width}px; }
.logo { top: 150px; display: flex; align-items: center; gap: 12px; }
.logo i { width: 44px; height: 44px; border-radius: 13px; background: #fff; color: #0b0b0b; display: grid; place-items: center; font-style: normal; font-size: 32px; font-weight: 900; line-height: 1; }
.logo b { font-size: 30px; font-weight: 800; letter-spacing: -0.02em; color: #fff; }
.block { position: absolute; top: 232px; left: 0; width: ${w - rightGap}px; text-align: center; white-space: nowrap; }
.t1 { font-size: 88px; font-weight: 700; letter-spacing: -0.03em; line-height: 1.15; color: #fff; }
.t2 { font-size: 96px; font-weight: 700; letter-spacing: -0.03em; line-height: 1.15; color: ${MINT}; }
.inf { margin-top: 18px; font-size: 34px; font-weight: 600; line-height: 1.35; color: #fff; font-variant-numeric: tabular-nums; }
${W ? `.desc { left: 0; width: ${w}px; top: ${descTop}px; font-size: 52px; font-weight: 700; line-height: 1.2; letter-spacing: -0.02em; color: #fff; white-space: pre-line; text-align: center; }` : `.desc { top: 1230px; font-size: 38px; font-weight: 500; line-height: 1.45; letter-spacing: -0.02em; color: #fff; white-space: pre-line; }`}
</style>
<div class="box logo"><i>J</i><b>JamiDuNow</b></div>
<div class="block"><div class="t1" id="t1">${esc(copy.title1 ?? copy.kicker ?? '')}</div><div class="t2" id="t2">${esc(copy.title2 ?? copy.title)}</div><div class="inf" id="i">${infos.map(esc).join('<br>')}</div></div>
<div class="box desc">${esc(copy.desc)}</div>`;
}

// 장면 구간을 이어 붙여 영상 높이(기본 608, 와이드 668)에 맞춰 줄이고 좌우를 가운데 크롭한 뒤, 검은 캔버스의 영상 자리에 얹은 뒤 글씨 오버레이를 덮는다
function compose({ trailer, overlay, copy, out }) {
  const { w, h, fps, videoTop } = RS;
  const videoH = videoHOf(copy);
  const eq = copy.brightness ? `,eq=${copy.brightness}` : '';
  const parts = [...copy.segments, copy.endClip];
  const inputs = parts.flatMap(([a, b]) => ['-ss', String(a), '-t', String(b - a), '-i', trailer]); // 구간마다 입력을 따로 열어 메모리를 아낀다
  const n = parts.length;
  const scaled = parts.map((_, i) => `[${i}:v]scale=-2:${videoH},crop=${w}:${videoH}:(iw-${w})*${copy.videoFocusX ?? 0.5}:0,setsar=1,fps=${fps}${eq}[s${i}]`);
  const fc = `${scaled.join(';')};${parts.map((_, i) => `[s${i}]`).join('')}concat=n=${n}:v=1:a=0[v];[v]pad=${w}:${h}:0:${videoTop}:black[p];[p][${n}:v]overlay=format=auto:shortest=1,format=yuv420p[o]`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-loop', '1', '-framerate', String(fps), '-i', overlay, '-filter_complex', fc, '-map', '[o]', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-shortest', out], { stdio: 'inherit' });
}

const XFADE = 0.1, FADE_OUT = 0.8, LUFS = -14;
export const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });

// HLS 마스터의 오디오 목록(EXT-X-MEDIA TYPE=AUDIO)을 m4a로 받아 cache에 둔다
export async function trailerAudioFromDb(game, cacheDir, refresh) {
  const file = path.join(cacheDir, `reel-trailer-audio-${game.steam_appid}.m4a`);
  if (!refresh && fs.existsSync(file)) return file;
  const master = game.video_url;
  const uri = (await (await fetch(master)).text()).split('\n').map((l) => l.match(/^#EXT-X-MEDIA:TYPE=AUDIO.*URI="([^"]+)"/)?.[1]).find(Boolean);
  if (!uri) throw new Error(`--reel-single --audio: ${game.name} 트레일러에 오디오가 없어요`);
  ff(['-i', new URL(uri, master).href, '-vn', '-c', 'copy', file]);
  return file;
}

// 구간별 오디오를 이어 붙인다. 크로스페이드가 겹친 만큼 줄어드니, 구간(마지막 빼고) 끝에 0.1초를 더 떠서 영상 길이·싱크를 맞춘다
export function buildAudio({ audio, copy, out }) {
  const parts = [...copy.segments, copy.endClip];
  const n = parts.length;
  const total = parts.reduce((t, [a, b]) => t + b - a, 0);
  const inputs = parts.flatMap(([a, b], i) => ['-ss', String(a), '-t', String(b - a + (i < n - 1 ? XFADE : 0)), '-i', Array.isArray(audio) ? audio[i] : audio]); // audio: 파일 하나, 또는 구간별 파일 배열
  const cut = parts.map((_, i) => `[${i}:a]aresample=48000,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS[a${i}]`);
  let chain = '[a0]';
  const xf = [];
  for (let i = 1; i < n; i++) { xf.push(`${chain}[a${i}]acrossfade=d=${XFADE}:c1=tri:c2=tri[x${i}]`); chain = `[x${i}]`; }
  // 1차: 음량 측정, 2차: 측정값으로 -14 LUFS에 맞추고 끝 0.8초 페이드아웃
  const r = spawnSync('ffmpeg', ['-hide_banner', '-y', ...inputs, '-filter_complex', `${cut.join(';')};${xf.join(';')};${chain}loudnorm=I=${LUFS}:TP=-1.5:LRA=11:print_format=json[o]`, '-map', '[o]', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = JSON.parse(r.stderr.slice(r.stderr.lastIndexOf('{'), r.stderr.lastIndexOf('}') + 1));
  const ln = !Number.isFinite(Number(m.input_i)) ? 'anull' : `loudnorm=I=${LUFS}:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`; // 무음 클립(측정 -inf)은 음량 맞춤을 건너뛴다
  ff([...inputs, '-filter_complex', `${cut.join(';')};${xf.join(';')};${chain}${ln},alimiter=limit=0.85:level=disabled,afade=t=out:st=${(total - FADE_OUT).toFixed(2)}:d=${FADE_OUT}[o]`, '-map', '[o]', '-t', String(total), '-c:a', 'aac', '-b:a', '192k', out]);
  return { measured: Number(m.input_i) };
}

// 스팀 appdetails movies에서 이름(또는 id)이 같은 영상의 HLS 주소를 찾아, trailerFromDb·오디오가 쓰는 game 모양으로 돌려준다(캐시 이름은 영상 id로 구분)
export async function steamMovie(game, movie) {
  const d = (await (await fetch(`https://store.steampowered.com/api/appdetails?appids=${game.steam_appid}&l=english&cc=kr`)).json())[game.steam_appid]?.data;
  const m = (d?.movies ?? []).find((x) => x.name === movie || String(x.id) === String(movie));
  if (!m?.hls_h264) throw new Error(`--reel-single: 스팀 영상 "${movie}"을 못 찾았어요 (${(d?.movies ?? []).map((x) => x.name).join(' / ')})`);
  return { ...game, steam_appid: `${game.steam_appid}-${m.id}`, video_url: m.hls_h264 };
}

export async function runReelSingle(postId, { refresh = false, audio = false } = {}) {
  try { if (!process.env.NEXT_PUBLIC_SUPABASE_URL) process.loadEnvFile('.env.local'); } catch { /* .env.local 없음 */ }
  const copyFile = path.join(DIR, 'copy', `${postId}.json`);
  if (!fs.existsSync(copyFile)) throw new Error(`--reel-single: ${path.relative(ROOT, copyFile)}이 없어요`);
  const copy = JSON.parse(fs.readFileSync(copyFile, 'utf8'));
  if (JSON.stringify(copy).includes('재밌드나')) throw new Error('화면에는 "재밌드나"를 쓰지 않아요. JamiDuNow만 쓰세요.');
  if (copy.desc.split('\n').length > 2) throw new Error('--reel-single: 설명은 최대 2줄이에요');
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: game, error } = await db.from('games').select('id, name, display_name, steam_appid, solo_playable, min_players, max_players, korean_support, is_free, video_url, release_status, release_date, demo_appid, price_history(price, original_price, discount_percent, sale_ends_at, checked_at)').eq('steam_appid', copy.appid).single();
  if (error) throw new Error(`게임 조회 실패: ${error.message}`);
  const info = infoLines(game, copy);
  const CACHE = CACHE_DIR;
  fs.mkdirSync(CACHE, { recursive: true });
  const src = copy.movie ? await steamMovie(game, copy.movie) : game; // movie가 있으면 스팀 appdetails의 그 영상, 없으면 DB video_url
  const trailer = await trailerFromDb(src, CACHE, refresh);
  const outDir = path.join(OUT_DIR, postId);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const font = fs.readFileSync(path.join(ROOT, 'node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2')).toString('base64');
  const browser = await chromium.launch();
  const overlay = path.join(CACHE, `overlay-${postId}.png`);
  try {
    const page = await browser.newPage({ viewport: { width: RS.w, height: RS.h } });
    await page.setContent(html(copy, info, font), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    for (const [id, min] of [['t1', 60], ['t2', 60], ['i', 22]]) { // 한 줄에 안 들어가면 글자 크기를 줄인다
      const size = await page.evaluate(({ id, min }) => { const el = document.getElementById(id); let s = parseFloat(getComputedStyle(el).fontSize); while (el.scrollWidth > el.clientWidth + 1 && s > min) { s -= 1; el.style.fontSize = `${s}px`; } return s; }, { id, min });
      console.log(`  ${id === 'i' ? '정보 줄' : id === 't1' ? '1줄 제목' : '2줄 제목'} ${size}px`);
    }
    if (wide(copy)) { // 설명: 가운데 정렬한 줄의 오른쪽 끝이 x 940을 넘으면 52px → 48px까지만 줄인다
      const right = () => page.evaluate(() => { const el = document.querySelector('.desc'); const r = document.createRange(); r.selectNodeContents(el); return Math.max(...[...r.getClientRects()].map((q) => q.right)); });
      if (await right() > RS.w - RS.rightGap) { await page.evaluate(() => { document.querySelector('.desc').style.fontSize = '48px'; }); console.warn('  설명 48px로 줄임'); }
      console.log(`  설명 오른쪽 끝 x ${Math.round(await right())} (한계 ${RS.w - RS.rightGap})`);
    }
    const m = await page.evaluate(() => Object.fromEntries(['.t1', '.t2', '.inf', '.desc'].map((q) => { const el = document.querySelector(q); const r = el.getBoundingClientRect(); const rg = document.createRange(); rg.selectNodeContents(el); const t = rg.getBoundingClientRect(); return [q, [Math.round(t.left), Math.round(r.top), Math.round(t.right), Math.round(r.bottom)]]; })));
    console.log('  글씨 영역(left,top,right,bottom):', JSON.stringify(m));
    if (Object.entries(m).some(([q, r]) => q !== '.desc' && r[2] > RS.w - RS.rightGap)) console.warn('경고: 글씨가 오른쪽 140px 안으로 들어가요');
    await page.screenshot({ path: overlay, clip: { x: 0, y: 0, width: RS.w, height: RS.h }, omitBackground: true });
  } finally { await browser.close(); }

  const withAudioInReel = copy.audio === true; // copy의 audio: reel.mp4에 원본 오디오를 바로 넣는다
  const mp4 = path.join(outDir, 'reel.mp4');
  const silent = withAudioInReel ? path.join(CACHE, `reel-${postId}-silent.mp4`) : mp4;
  compose({ trailer, overlay, copy, out: silent });
  const total = copy.segments.concat([copy.endClip]).reduce((t, [x, y]) => t + y - x, 0);
  const mux = async (dest) => {
    const m4a = path.join(CACHE, `reel-${postId}-audio.m4a`);
    const { measured } = buildAudio({ audio: await trailerAudioFromDb(src, CACHE, refresh), copy, out: m4a });
    ff(['-i', silent, '-i', m4a, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-movflags', '+faststart', '-shortest', dest]);
    console.log(path.relative(ROOT, dest), `(트레일러 원본 오디오, 측정 ${measured} LUFS → ${LUFS} LUFS, 구간 경계 ${XFADE}초 크로스페이드, 끝 ${FADE_OUT}초 페이드아웃)`);
  };
  if (withAudioInReel) await mux(mp4);
  else if (audio) await mux(path.join(outDir, 'reel-audio.mp4'));
  const still = path.join(outDir, 'still.png');
  ff(['-ss', String(Math.min(10, total / 2)), '-i', mp4, '-frames:v', '1', still]);
  console.log(info.join(' | '));
  console.log(path.relative(ROOT, mp4), `(약 ${total.toFixed(1)}초, ${withAudioInReel ? '원본 오디오' : '무음'})`);
  console.log(path.relative(ROOT, still));
}
