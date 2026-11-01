// scripts/insta/reel-single.mjs
// --reel-single: 게임 하나를 소개하는 세로 릴스(1080×1920, 무음). 텍스트 고정형 — 처음부터 끝까지 같은 글씨, 트레일러만 흐른다
// 레이아웃(--reel 가운데 정렬 규칙): 위 로고 · 글씨 y 300~520 · 영상 y 560~1168(1080×608) · 설명 y 1230~1400 · 오른쪽 140px 비움
// 실행: npm run insta -- <post-id> --reel-single [--audio]   (문구·구간은 copy/<post-id>.json, 가격·인원·한국어는 DB 값)
//   --audio: 트레일러 원본 오디오를 같은 구간만큼 붙여 reel-audio.mp4도 만든다(컷 경계 0.1초 크로스페이드, -14 LUFS, 끝 0.8초 페이드아웃). 기본은 무음
import fs from 'fs';
import path from 'path';
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

function infoLine(game) {
  const row = latestKrw(game);
  if (!(row?.discount_percent > 0)) throw new Error(`--reel-single: ${game.name}은 지금 할인 중이 아니에요`);
  return `~${saleEndOf(row)} -${row.discount_percent}% 할인 / 최대 ${game.max_players}인 / 한국어 ${hasKorean(game) ? '지원' : '미지원'}`;
}

function html(copy, info, font) {
  const { w, h, left, rightGap } = RS;
  const width = w - left - rightGap; // 글씨가 들어갈 폭
  return `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: P; src: url(data:font/woff2;base64,${font}); font-weight: 100 900; }
* { margin: 0; box-sizing: border-box; } html, body { width: ${w}px; height: ${h}px; background: transparent; overflow: hidden; font-family: P, sans-serif; }
.box { position: absolute; left: ${left}px; width: ${width}px; }
.logo { top: 150px; display: flex; align-items: center; gap: 12px; }
.logo i { width: 44px; height: 44px; border-radius: 13px; background: #fff; color: #0b0b0b; display: grid; place-items: center; font-style: normal; font-size: 32px; font-weight: 900; line-height: 1; }
.logo b { font-size: 30px; font-weight: 800; letter-spacing: -0.02em; color: #fff; }
.kicker { top: 300px; font-size: 40px; font-weight: 800; letter-spacing: -0.02em; color: #fff; white-space: nowrap; }
.title { top: 356px; font-size: 84px; font-weight: 900; letter-spacing: -0.04em; line-height: 1.2; color: ${MINT}; white-space: nowrap; }
.info { top: 480px; font-size: 30px; font-weight: 600; color: #a3a3a3; white-space: nowrap; font-variant-numeric: tabular-nums; }
.desc { top: 1230px; font-size: 38px; font-weight: 500; line-height: 1.45; letter-spacing: -0.02em; color: #fff; white-space: pre-line; }
</style>
<div class="box logo"><i>J</i><b>JamiDuNow</b></div>
<div class="box kicker">${esc(copy.kicker)}</div>
<div class="box title" id="t">${esc(copy.title)}</div>
<div class="box info" id="i">${esc(info)}</div>
<div class="box desc">${esc(copy.desc)}</div>`;
}

// 장면 구간을 이어 붙여 1080×608로 줄이고, 검은 캔버스의 영상 자리에 얹은 뒤 글씨 오버레이를 덮는다
function compose({ trailer, overlay, copy, out }) {
  const { w, h, fps, videoTop, videoH } = RS;
  const parts = [...copy.segments, copy.endClip];
  const inputs = parts.flatMap(([a, b]) => ['-ss', String(a), '-t', String(b - a), '-i', trailer]); // 구간마다 입력을 따로 열어 메모리를 아낀다
  const n = parts.length;
  const scaled = parts.map((_, i) => `[${i}:v]scale=${w}:${videoH},setsar=1,fps=${fps}[s${i}]`);
  const fc = `${scaled.join(';')};${parts.map((_, i) => `[s${i}]`).join('')}concat=n=${n}:v=1:a=0[v];[v]pad=${w}:${h}:0:${videoTop}:black[p];[p][${n}:v]overlay=format=auto:shortest=1,format=yuv420p[o]`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-loop', '1', '-framerate', String(fps), '-i', overlay, '-filter_complex', fc, '-map', '[o]', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-shortest', out], { stdio: 'inherit' });
}

const XFADE = 0.1, FADE_OUT = 0.8, LUFS = -14;
const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });

// HLS 마스터의 오디오 목록(EXT-X-MEDIA TYPE=AUDIO)을 m4a로 받아 cache에 둔다
async function trailerAudioFromDb(game, cacheDir, refresh) {
  const file = path.join(cacheDir, `reel-trailer-audio-${game.steam_appid}.m4a`);
  if (!refresh && fs.existsSync(file)) return file;
  const master = game.video_url;
  const uri = (await (await fetch(master)).text()).split('\n').map((l) => l.match(/^#EXT-X-MEDIA:TYPE=AUDIO.*URI="([^"]+)"/)?.[1]).find(Boolean);
  if (!uri) throw new Error(`--reel-single --audio: ${game.name} 트레일러에 오디오가 없어요`);
  ff(['-i', new URL(uri, master).href, '-vn', '-c', 'copy', file]);
  return file;
}

// 구간별 오디오를 이어 붙인다. 크로스페이드가 겹친 만큼 줄어드니, 구간(마지막 빼고) 끝에 0.1초를 더 떠서 영상 길이·싱크를 맞춘다
function buildAudio({ audio, copy, out }) {
  const parts = [...copy.segments, copy.endClip];
  const n = parts.length;
  const total = parts.reduce((t, [a, b]) => t + b - a, 0);
  const inputs = parts.flatMap(([a, b], i) => ['-ss', String(a), '-t', String(b - a + (i < n - 1 ? XFADE : 0)), '-i', audio]);
  const cut = parts.map((_, i) => `[${i}:a]aresample=48000,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS[a${i}]`);
  let chain = '[a0]';
  const xf = [];
  for (let i = 1; i < n; i++) { xf.push(`${chain}[a${i}]acrossfade=d=${XFADE}:c1=tri:c2=tri[x${i}]`); chain = `[x${i}]`; }
  // 1차: 음량 측정, 2차: 측정값으로 -14 LUFS에 맞추고 끝 0.8초 페이드아웃
  const r = spawnSync('ffmpeg', ['-hide_banner', '-y', ...inputs, '-filter_complex', `${cut.join(';')};${xf.join(';')};${chain}loudnorm=I=${LUFS}:TP=-1.5:LRA=11:print_format=json[o]`, '-map', '[o]', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = JSON.parse(r.stderr.slice(r.stderr.lastIndexOf('{'), r.stderr.lastIndexOf('}') + 1));
  const ln = `loudnorm=I=${LUFS}:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  ff([...inputs, '-filter_complex', `${cut.join(';')};${xf.join(';')};${chain}${ln},afade=t=out:st=${(total - FADE_OUT).toFixed(2)}:d=${FADE_OUT}[o]`, '-map', '[o]', '-t', String(total), '-c:a', 'aac', '-b:a', '192k', out]);
  return { measured: Number(m.input_i) };
}

export async function runReelSingle(postId, { refresh = false, audio = false } = {}) {
  try { if (!process.env.NEXT_PUBLIC_SUPABASE_URL) process.loadEnvFile('.env.local'); } catch { /* .env.local 없음 */ }
  const copyFile = path.join(DIR, 'copy', `${postId}.json`);
  if (!fs.existsSync(copyFile)) throw new Error(`--reel-single: ${path.relative(ROOT, copyFile)}이 없어요`);
  const copy = JSON.parse(fs.readFileSync(copyFile, 'utf8'));
  if (JSON.stringify(copy).includes('재밌드나')) throw new Error('화면에는 "재밌드나"를 쓰지 않아요. JamiDuNow만 쓰세요.');
  if (copy.desc.split('\n').length > 2) throw new Error('--reel-single: 설명은 최대 2줄이에요');
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: game, error } = await db.from('games').select('id, name, display_name, steam_appid, max_players, korean_support, video_url, price_history(price, original_price, discount_percent, sale_ends_at, checked_at)').eq('steam_appid', copy.appid).single();
  if (error) throw new Error(`게임 조회 실패: ${error.message}`);
  const info = infoLine(game);
  const CACHE = path.join(DIR, 'cache');
  fs.mkdirSync(CACHE, { recursive: true });
  const trailer = await trailerFromDb(game, CACHE, refresh);
  const outDir = path.join(DIR, 'out', postId);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const font = fs.readFileSync(path.join(ROOT, 'node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2')).toString('base64');
  const browser = await chromium.launch();
  const overlay = path.join(CACHE, `overlay-${postId}.png`);
  try {
    const page = await browser.newPage({ viewport: { width: RS.w, height: RS.h } });
    await page.setContent(html(copy, info, font), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    for (const [id, min] of [['t', 56], ['i', 22]]) { // 한 줄에 안 들어가면 글자 크기를 줄인다
      const size = await page.evaluate(({ id, min }) => { const el = document.getElementById(id); let s = parseFloat(getComputedStyle(el).fontSize); while (el.scrollWidth > el.clientWidth + 1 && s > min) { s -= 1; el.style.fontSize = `${s}px`; } return s; }, { id, min });
      console.log(`  ${id === 't' ? '큰 제목' : '정보 줄'} ${size}px`);
    }
    const m = await page.evaluate(() => Object.fromEntries(['.kicker', '.title', '.info', '.desc'].map((q) => { const r = document.querySelector(q).getBoundingClientRect(); return [q, [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]]; })));
    console.log('  글씨 영역(left,top,right,bottom):', JSON.stringify(m));
    if (Object.values(m).some((r) => r[2] > RS.w - RS.rightGap)) console.warn('경고: 글씨가 오른쪽 140px 안으로 들어가요');
    await page.screenshot({ path: overlay, clip: { x: 0, y: 0, width: RS.w, height: RS.h }, omitBackground: true });
  } finally { await browser.close(); }

  const mp4 = path.join(outDir, 'reel.mp4');
  compose({ trailer, overlay, copy, out: mp4 });
  const total = copy.segments.concat([copy.endClip]).reduce((s, [a, b]) => s + b - a, 0);
  const still = path.join(outDir, 'still.png');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '10', '-i', mp4, '-frames:v', '1', still], { stdio: 'inherit' });
  if (audio) {
    const m4a = path.join(CACHE, `reel-${postId}-audio.m4a`);
    const { measured } = buildAudio({ audio: await trailerAudioFromDb(game, CACHE, refresh), copy, out: m4a });
    const withAudio = path.join(outDir, 'reel-audio.mp4');
    ff(['-i', mp4, '-i', m4a, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-movflags', '+faststart', '-shortest', withAudio]);
    console.log(path.relative(ROOT, withAudio), `(트레일러 원본 오디오, 측정 ${measured} LUFS → ${LUFS} LUFS, 구간 경계 ${XFADE}초 크로스페이드, 끝 ${FADE_OUT}초 페이드아웃)`);
  }
  console.log(info);
  console.log(path.relative(ROOT, mp4), `(약 ${total.toFixed(1)}초, 무음)`);
  console.log(path.relative(ROOT, still));
}
