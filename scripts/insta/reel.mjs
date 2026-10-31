// scripts/insta/reel.mjs
// --reel: 1080×1920 세로 릴스. 훅(영상 전체 화면) + 게임 장(검은 바 로고 + 트레일러 + 한 줄 평 카드 + 아래 정보) + 팔로우 카드. 무음
// 트레일러는 DB games.video_url(HLS)만 쓴다 — 스팀 API는 부르지 않는다. 가격·인원·평가도 DB 값
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { hasKorean } from './pick-roundup.mjs';

export const REEL = { w: 1080, h: 1920, fps: 30, hook: 2, game: 4.4, end: 1.5, videoTop: 150, videoH: 1150 };
const START_RATIO = 0.2;

// 릴스 장: 훅 + 게임 + 끝. base = posts json(reel-hook·follow-card), copy.games = [{appid, name, desc, oneliner, maxPlayers, clipStart, videoFocusX}]
export function expandReel(base, copy) {
  const games = copy.games ?? [];
  if (!games.length) throw new Error('--reel: copy/<id>.json의 games가 비어 있어요');
  const hook = base.find((s) => s.type === 'reel-hook');
  if (!hook) throw new Error('--reel: posts json에 reel-hook 슬라이드가 필요해요');
  const follow = base.find((s) => s.type === 'follow-card') ?? { title: '친구랑 할 게임, 고민되면' };
  for (const g of games) {
    if (!g.oneliner) throw new Error(`--reel: ${g.name} 한 줄 평(oneliner)이 없어요`);
    const bad = String(g.desc ?? '').split('\n');
    if (bad.length > 3 || bad.some((l) => [...l].length > 24)) throw new Error(`--reel: ${g.name} 설명은 최대 3줄, 줄당 24자 이내여야 해요`);
  }
  return [
    { ...hook, type: 'reel-hook', game: hook.game ?? games[0].appid, hookStart: copy.hookStart },
    ...games.map((g) => ({ type: 'reel-game', game: g.appid, g })),
    { ...follow, type: 'reel-end', game: follow.game ?? games[0].appid },
  ];
}

// "출시 예정 2026년 12월 1일" → { ym: '2026.12', ymd: '2026.12.01' } (일이 없으면 ymd는 null)
export function releaseParts(text) {
  const m = String(text ?? '').match(/(\d{4})년\s*(\d{1,2})월(?:\s*(\d{1,2})일)?/);
  if (!m) return null;
  const mm = m[2].padStart(2, '0');
  return { ym: `${m[1]}.${mm}`, ymd: m[3] ? `${m[1]}.${mm}.${m[3].padStart(2, '0')}` : null };
}

// 게임 장의 DB 값: 정보 줄(민트 30px) · 카드 배지 · 이름 뒤 DEMO
export function reelInfo(game, g, { latestPrice }) {
  const max = g.maxPlayers ?? game.max_players;
  const demo = !!game.demo_appid;
  const soon = game.release_status === 'coming_soon';
  const rel = releaseParts(game.release_date_text);
  if (demo || soon) {
    const when = soon ? `출시 예정${rel ? ` ${rel.ymd ?? rel.ym}` : ''}` : null;
    return {
      info: [demo && '무료 데모', when, `최대 ${max}인`].filter(Boolean).join(' | '),
      badge: [demo && '무료 데모 있음', soon && `출시 예정${rel ? ` ${rel.ym}` : ''}`].filter(Boolean).join(' · '),
      demo,
    };
  }
  const price = game.is_free ? '무료' : latestPrice ? `${Math.round(latestPrice).toLocaleString('ko-KR')}원` : null;
  if (!price) throw new Error(`--reel: ${game.name} 가격이 DB에 없어요`);
  if (!game.review_summary) throw new Error(`--reel: ${game.name} 스팀 평가가 DB에 없어요`);
  return { info: [price, game.review_summary, `최대 ${max}인`].join(' | '), badge: null, demo: false, korean: hasKorean(game) };
}

const probe = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

// HLS 마스터(DB video_url)에서 높이 1080 이하 중 가장 큰 화질을 받아 mp4로 묶어 cache에 둔다
export async function trailerFromDb(game, cacheDir, refresh) {
  const file = path.join(cacheDir, `reel-trailer-${game.steam_appid}.mp4`);
  if (!refresh && fs.existsSync(file)) return file;
  const master = game.video_url;
  if (!master) throw new Error(`--reel: ${game.name}에 video_url이 없어요`);
  let src = master;
  if (/\.m3u8/.test(master)) {
    const lines = (await (await fetch(master)).text()).split('\n').map((l) => l.trim());
    const vs = lines.flatMap((l, i) => { const m = l.match(/^#EXT-X-STREAM-INF:.*RESOLUTION=(\d+)x(\d+)/); return m && lines[i + 1] ? [{ h: Number(m[2]), uri: new URL(lines[i + 1], master).href }] : []; });
    const ok = vs.filter((v) => v.h <= 1080).sort((a, b) => b.h - a.h)[0] ?? vs.sort((a, b) => a.h - b.h)[0];
    if (!ok) throw new Error(`HLS 목록에서 화질을 못 찾았어요: ${game.name}`);
    console.log(`  ${game.name} HLS ${ok.h}p (${vs.map((v) => v.h).join('/')})`);
    src = ok.uri;
  }
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-an', '-c', 'copy', file], { stdio: 'inherit' });
  return file;
}

function window_(trailer, len, start, name, ratio = START_RATIO) {
  const dur = probe(trailer);
  let ss = start ?? dur * ratio;
  if (ss + len > dur) { ss = Math.max(0, dur - len); console.warn(`경고: ${name} 시작점이 영상 끝을 넘어 ${ss.toFixed(1)}초로 당김 (${dur.toFixed(1)}초)`); }
  return { start: ss, duration: dur };
}

const enc = ['-an', '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
// 훅: 트레일러가 1080×1920 전체 화면(가운데 기준 좌우 크롭) + 글씨 오버레이
export function composeHook({ trailer, overlay, start, out, name, focus = 0.5 }) {
  const { w, h, fps, hook } = REEL;
  const r = window_(trailer, hook, start, name, 0.5); // 훅은 영상 중간부터 — 첫 게임 장(20% 지점)과 같은 장면이 겹치지 않게
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(r.start), '-t', String(hook), '-i', trailer, '-loop', '1', '-framerate', String(fps), '-t', String(hook), '-i', overlay,
    '-filter_complex', `[0:v]scale=-2:${h},crop=${w}:${h}:(iw-${w})*${focus}:0,setsar=1,fps=${fps}[v];[v][1:v]overlay=format=auto,format=yuv420p[o]`,
    '-map', '[o]', ...enc, '-shortest', out], { stdio: 'inherit' });
  return { start: r.start, length: hook };
}
// 게임 장: 1080p 원본을 높이 videoH(1150)에 맞춰 키워(원본이 더 낮을 때만) 1080×videoH를 가운데(focus) 크롭, 검은 바 아래에 둠
export function composeGame({ trailer, overlay, start, out, name, focus = 0.5 }) {
  const { w, h, fps, game, videoTop, videoH } = REEL;
  const r = window_(trailer, game, start, name);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(r.start), '-t', String(game), '-i', trailer, '-loop', '1', '-framerate', String(fps), '-t', String(game), '-i', overlay,
    '-filter_complex', `[0:v]scale=-2:max(${videoH}\\,ih),crop=${w}:${videoH}:(iw-${w})*${focus}:(ih-${videoH})/2,setsar=1,fps=${fps},pad=${w}:${h}:0:${videoTop}:black[v];[v][1:v]overlay=format=auto,format=yuv420p[o]`,
    '-map', '[o]', ...enc, '-shortest', out], { stdio: 'inherit' });
  return { start: r.start, length: game, duration: r.duration };
}
// 끝: 정지 이미지를 1.5초 영상으로
export function composeEnd({ image, out }) {
  const { fps, end } = REEL;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-loop', '1', '-framerate', String(fps), '-t', String(end), '-i', image, '-vf', 'format=yuv420p', ...enc, out], { stdio: 'inherit' });
}
// 장 mp4를 이어 붙여 reel.mp4 (같은 인코딩 설정이라 재인코딩 없이 concat)
export function concatScenes(files, out, listFile) {
  fs.writeFileSync(listFile, files.map((f) => `file '${f}'`).join('\n'));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-movflags', '+faststart', out], { stdio: 'inherit' });
}
// 미리보기용 정지 이미지: 장 영상의 한가운데 프레임
export function stillOf(mp4, out, at) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(at), '-i', mp4, '-frames:v', '1', out], { stdio: 'inherit' });
}
