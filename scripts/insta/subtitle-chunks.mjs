// scripts/insta/subtitle-chunks.mjs — --reel-trend 자막 끊기(copy.chunks가 없을 때의 기본값)
// 의미 단위로 1~3어절씩 묶는다. 한 덩어리는 공백 포함 최대 12자·3어절. 끊으면 안 되는 곳(비용 큼): 의존명사(것·게·수·때·걸·줄·뿐) 앞, 부정(안·못)·관형사(이·그·저) 뒤,
// 보조 용언(있어요·주거든요·봐요 등) 앞. 관형형(~는·~은·~인·~ㄹ 등) 뒤는 비용 중간. 끊기 좋은 곳(비용 0): 쉼표·연결 어미(~고·~면·~서·~는데·~니까·~며·~지만) 뒤. 문장 끝은 항상 끊는다
// 핵심 단어(keys)는 덩어리 안에서 그 부분만 [ ]로 감싼다(민트). 최소 표시 시간 합치기는 mergeShortChunks
export const MAX_CHARS = 12, MAX_WORDS = 3, MIN_SEC = 0.35;
const DEP_NOUNS = new Set(['것', '게', '수', '때', '걸', '줄', '뿐', '후', '전']);
const NO_BREAK_AFTER = new Set(['안', '못', '이', '그', '저', '새', '어떤']);
const AUX = /^(있어요|있고|있는|있다|주거든요|줘요|주세요|봐요|보세요|않아요|않는|않고|버려요|놓고|놓아요|가요|와요)$/;
const GOOD_END = /(고|면|서|는데|니까|며|지만)$/;
const ADNOM = /(는|은|인|던|운|온|할|한|될)$/;
const plain = (t) => t.replace(/[,.!?~…]+$/, '');

function breakCost(a, b, glue) { // a 다음에 b가 오는 자리에서 끊는 비용(b가 없으면 문장 끝)
  if (!b || /[.!?]$/.test(a)) return 0;
  if (glue) return 100; // 핵심 구절(keys) 안에서는 끊지 않는다
  const pa = plain(a), pb = plain(b);
  if (DEP_NOUNS.has(pb) || NO_BREAK_AFTER.has(pa) || AUX.test(pb)) return 100;
  if (/,$/.test(a)) return -15;
  if (GOOD_END.test(pa)) return 0;
  if (ADNOM.test(pa)) return 30;
  return 6;
}

export function autoChunks(text, keys = []) {
  const out = [];
  for (const sentence of text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)) {
    const tk = sentence.split(/\s+/);
    const n = tk.length;
    const joined = tk.map(plain);
    const glued = Array(n).fill(false); // glued[j] = tk[j-1]과 tk[j] 사이가 핵심 구절 안
    for (const k of keys) { const w = k.split(/\s+/); for (let a = 0; a + w.length <= n; a++) if (w.every((x, o) => joined[a + o] === x || joined[a + o].startsWith(x))) for (let o = 1; o < w.length; o++) glued[a + o] = true; }
    const best = Array(n + 1).fill(Infinity), prev = Array(n + 1).fill(-1);
    best[0] = 0;
    for (let j = 1; j <= n; j++) {
      for (let i = Math.max(0, j - MAX_WORDS); i < j; i++) {
        const chars = tk.slice(i, j).join(' ').length;
        const cost = best[i] + 3 + (chars > MAX_CHARS ? 200 : Math.abs(chars - 8) * 0.6) + (j < n ? breakCost(tk[j - 1], tk[j], glued[j]) : 0);
        if (cost < best[j]) { best[j] = cost; prev[j] = i; }
      }
    }
    const cuts = [];
    for (let j = n; j > 0; j = prev[j]) cuts.unshift([prev[j], j]);
    for (const [i, j] of cuts) out.push(markKeys(tk.slice(i, j).join(' ').replace(/[,.!?~…]+$/, '').replace(/,/g, ''), keys));
  }
  return out;
}

// 덩어리 안에서 keys(문자열 목록)와 일치하는 부분만 [ ]로 감싼다
export function markKeys(chunk, keys) {
  let c = chunk;
  for (const k of keys) { const i = c.indexOf(k); if (i >= 0 && !c.slice(0, i).includes('[')) { c = `${c.slice(0, i)}[${k}]${c.slice(i + k.length)}`; break; } }
  return c;
}

// 표시 시간이 minSec보다 짧은 덩어리는 다음 덩어리와 합친다(마지막이면 앞 덩어리와). chunks: [{text,start,end,to}]
export function mergeShortChunks(chunks, minSec = MIN_SEC) {
  const r = chunks.map((c) => ({ ...c }));
  for (let i = 0; i < r.length; ) {
    if (r[i].to - r[i].start >= minSec || r.length === 1) { i++; continue; }
    const j = i + 1 < r.length ? i + 1 : i - 1;
    const [a, b] = j > i ? [r[i], r[j]] : [r[j], r[i]];
    const merged = { ...a, text: `${a.text} ${b.text}`, end: b.end, to: b.to };
    r.splice(Math.min(i, j), 2, merged);
    i = Math.max(0, Math.min(i, j));
  }
  return r;
}
