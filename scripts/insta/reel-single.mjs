// scripts/insta/reel-single.mjs
// --reel-single: 게임 하나를 소개하는 세로 릴스(1080×1920, 무음). 텍스트 고정형 — 처음부터 끝까지 같은 글씨, 트레일러만 흐른다
// 레이아웃(--reel 가운데 정렬 규칙): 위 로고 · 글씨 y 300~520 · 영상 y 560~1168(1080×608) · 설명 y 1230~1400 · 오른쪽 140px 비움
// 실행: npm run insta -- <post-id> --reel-single   (문구·구간은 copy/<post-id>.json, 가격·인원·한국어는 DB 값)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
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

export async function runReelSingle(postId, { refresh = false } = {}) {
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
  console.log(info);
  console.log(path.relative(ROOT, mp4), `(약 ${total.toFixed(1)}초, 무음)`);
  console.log(path.relative(ROOT, still));
}
