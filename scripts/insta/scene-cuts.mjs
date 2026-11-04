// scripts/insta/scene-cuts.mjs
// --reel-trend 기본 규칙: (1) 컷 경계를 +0.3초 늦춘다(내레이션은 그대로) (2) 0.8초보다 짧은 컷은 옆 컷과 합친다
// (3) 트레일러 원본의 장면 전환(scene cut)이 컷 경계·카드 경계 앞뒤 0.5초 안에 끼지 않도록 컷의 원본 구간을 옮긴다
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

export const CUT_EXTEND = 0.3, MIN_CUT = 0.8, SCENE_GAP = 0.5, SCENE_THRESHOLD = 0.3;

// 원본 영상의 장면 전환 시각(초). ffmpeg select='gt(scene,0.3)' + showinfo, 영상 옆 cache에 json으로 저장
export function detectSceneCuts(file, cacheDir, threshold = SCENE_THRESHOLD) {
  const js = path.join(cacheDir, `scenecuts-${path.basename(file)}-${threshold}.json`);
  if (fs.existsSync(js) && fs.statSync(js).mtimeMs >= fs.statSync(file).mtimeMs) return JSON.parse(fs.readFileSync(js, 'utf8'));
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-an', '-vf', `scale=320:-2,select='gt(scene,${threshold})',showinfo`, '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`--reel-trend: 장면 전환 감지 실패\n${r.stderr.slice(-400)}`);
  const cuts = [...r.stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => +Number(m[1]).toFixed(3));
  fs.writeFileSync(js, JSON.stringify(cuts));
  return cuts;
}

// 컷 경계를 늦추고(첫 컷 시작 0은 그대로) 짧은 컷을 합친다(card = 카드 장면 시작 시각이면 그 컷은 거기까지만 센다). cuts: [{t, ...}] 시간순. 반환: 새 배열(첫 컷 t=0)
export function stretchCuts(cuts, { extend = CUT_EXTEND, minCut = MIN_CUT, end, card = null }) {
  let out = cuts.map((c, i) => ({ ...c, t: i === 0 ? c.t : +(c.t + extend).toFixed(3) })).filter((c) => c.t < end - 0.001);
  for (;;) { // 가장 짧은 컷이 minCut 미만이면 합친다: 앞 컷이 그 구간을 이어받는다(첫 컷이 짧으면 둘째 컷을 없애 첫 컷이 이어받는다)
    const durs = out.map((c, i) => (c.t >= (card ?? Infinity) ? Infinity : Math.min(out[i + 1]?.t ?? end, card ?? Infinity) - c.t)); // 카드 장면 뒤 컷은 소리만 쓰이므로 길이 검사 제외
    const k = durs.findIndex((d) => d < minCut - 1e-6);
    if (k < 0 || out.length === 1) return out;
    out.splice(k === 0 ? 1 : k, 1);
  }
}

// 구간 [a, a+dur]의 양 끝 0.5초 안(그리고 안쪽 전체)에 원본 장면 전환이 있는지. 경계 시각 자체는 컷으로 치지 않는다(0.02초 여유)
const edgeHits = (cutsAt, a, dur, gap) => cutsAt.filter((s) => (s > a + 0.02 && s < a + gap) || (s > a + dur - gap && s < a + dur - 0.02));
const innerHits = (cutsAt, a, dur) => cutsAt.filter((s) => s > a + 0.02 && s < a + dur - 0.02);

// segs: [{movie, a, dur}] → 각 구간의 시작 원본 시각을 옮겨 양 끝 gap초 안에 장면 전환이 없게 한다. 옮김은 ±maxShift 안에서 가장 작은 쪽으로(원본 안 전환이 아예 없는 자리를 우선), 같은 영상의 다른 컷 구간과 0.1초 넘게 겹치지 않는 자리만(같은 장면이 반복되지 않게)
export function avoidSceneCuts(segs, sceneOf, { gap = SCENE_GAP, maxShift = 6, durOf }) {
  const cur = segs.map((s) => ({ ...s }));
  return cur.map((s, i) => {
    const cutsAt = sceneOf(s.movie), total = durOf(s.movie);
    const free = (a) => a >= 0 && a + s.dur <= total && !cur.some((o, j) => j !== i && o.movie === s.movie && Math.min(a + s.dur, o.a + o.dur) - Math.max(a, o.a) > 0.1);
    const tries = [0];
    for (let d = 0.05; d <= maxShift + 1e-9; d += 0.05) tries.push(d, -d);
    const pick = (f) => tries.find((d) => free(s.a + d) && f(s.a + d));
    let d = pick((a) => !edgeHits(cutsAt, a, s.dur, gap).length && !innerHits(cutsAt, a, s.dur).length); // 구간 안에 전환이 아예 없는 자리
    if (d === undefined) d = pick((a) => !edgeHits(cutsAt, a, s.dur, gap).length); // 없으면 양 끝 0.5초만이라도
    const a = s.a + (d ?? 0);
    s.a = a; // 뒤 컷이 이 자리를 피하게
    return { ...s, a: +a.toFixed(3), shift: +(d ?? 0).toFixed(2), clean: d !== undefined, hits: edgeHits(cutsAt, a, s.dur, gap), inner: innerHits(cutsAt, a, s.dur) };
  });
}

// 원본 구간 중복 방지: 시간순으로 구간을 확정하며, 이미 쓴 구간(placed)과 1프레임이라도 겹치면 아직 안 쓴 다른 구간으로 옮긴다. 원래 자리가 비어 있으면 그대로 둔다.
// 후보는 원래 자리에서 가까운 순(±0.05초 단위, 영상 전체). 우선순위: ① 구간 안·양 끝에 원본 장면 전환이 없고 뒤 컷의 원래 자리와도 안 겹침 ② 장면 전환 없음 ③ 겹치지 않기만.
// segs: [{movie, a, dur}] (시간순). banned: [{movie, a, b}] 추가로 쓰지 않을 구간(렌더 후 검사에서 걸린 곳). 반환: [{...seg, a, moved, clean}]
export const OVERLAP_EPS = 0.001, SOURCE_PAD = 0.5; // SOURCE_PAD: 쓴 구간 앞뒤로 이만큼(초)도 비워서, 바로 이어지는 같은 장면이 다시 나오지 않게 한다
export function uniqueSources(segs, sceneOf, { durOf, gap = SCENE_GAP, banned = [], minStart = 0, endMargin = 0 }) {
  const placed = banned.map((b) => ({ movie: b.movie, a: b.a, b: b.b }));
  const hit = (movie, a, b, list, pad = 0) => list.some((o) => o.movie === movie && Math.min(b, o.b + pad) - Math.max(a, o.a - pad) > OVERLAP_EPS);
  return segs.map((s, i) => {
    const cutsAt = sceneOf(s.movie), total = durOf(s.movie) - endMargin;
    const later = segs.slice(i + 1).map((o) => ({ movie: o.movie, a: o.a, b: o.a + o.dur }));
    const okRange = (a) => a >= minStart && a + s.dur <= total;
    const free = (a) => okRange(a) && !hit(s.movie, a, a + s.dur, placed, SOURCE_PAD);
    const noScene = (a) => !edgeHits(cutsAt, a, s.dur, gap).length && !innerHits(cutsAt, a, s.dur).length;
    const tries = [0];
    for (let d = 0.05; d <= total + 1e-9; d += 0.05) tries.push(d, -d);
    const stay = free(s.a) && noScene(s.a); // 원래 자리가 비었고 장면 전환도 없으면 그대로
    const pick = (f) => tries.find((d) => f(s.a + d));
    const d = stay ? 0 : (pick((a) => free(a) && noScene(a) && !hit(s.movie, a, a + s.dur, later)) ?? pick((a) => free(a) && noScene(a)) ?? pick(free));
    if (d === undefined) throw new Error(`--reel-trend: 컷 ${i + 1}에 쓸 수 있는 안 쓴 원본 구간이 없어요 (${s.dur.toFixed(2)}초)`);
    const a = +(s.a + d).toFixed(3);
    placed.push({ movie: s.movie, a, b: a + s.dur });
    return { ...s, a, moved: Math.abs(d) > 1e-9, shift: +d.toFixed(2), clean: noScene(a), hits: edgeHits(cutsAt, a, s.dur, gap), inner: innerHits(cutsAt, a, s.dur) };
  });
}
