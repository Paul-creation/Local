// scripts/insta/narration-sentences.mjs — --reel-trend 내레이션을 문장 단위로 생성(기본)
// 문장마다 ElevenLabs(eleven_multilingual_v2, with-timestamps)를 따로 부르되 previous_text/next_text로 앞뒤 문장을 넘겨 톤을 잇는다.
// 문장 끝 억양 검사: 마지막 어절 끝 음높이가 그 문장 평균보다 maxRise(기본 2)반음 넘게 올라가면 그 문장만 다시 생성(최대 retries=3번).
// 그래도 올라가면 제일 덜 올라간 테이크를 쓴다.
// 늘어짐 검사(기본): 같은 받아쓰기의 단어별 시작·끝(faster-whisper word_timestamps)으로 단어 길이(발화 길이 = 단어 구간에서 쉼을 뺀 값)를 재서, 한 음절(한글 글자)당 maxSylSec(기본 0.25초)를 넘는 단어가 있는 테이크는 탈락시킨다(pitch.maxSylSec로 바꿈, pitch.stretch:false로 끔).
// 발음 검사(기본): 각 테이크를 faster-whisper(small, 한국어; scripts/insta/stt-check.py)로 받아 적어 대본과의 글자 오류율(CER, 공백·문장부호 제외, ㅐ/ㅔ 동음·되요/돼요 표기 차이는 같은 글자 — 규칙은 stt-check.py)을 계산하고, 억양 검사를 통과한 테이크 중 CER이 가장 낮은 것을 고른다. CER이 maxCer(기본 5%)를 넘으면 한 번 더 생성하고, 그래도 넘으면 문장과 받아쓰기를 보여주고 멈춘다(pitch.stt:false로 끔). 분석은 scripts/insta/pitch-end.py(librosa.pyin) — python은 환경변수 PITCH_PYTHON(없으면 python3)
// 캐시: out/<post-id>/<cacheName>.wav·json(합친 결과) + <cacheName>-s/ 문장별 테이크(mp3·json). 대본·목소리·설정·검사 값이 같으면 API를 다시 부르지 않는다
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { spawnSync, execFileSync } from 'child_process';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '../..');
const PITCH = path.join(DIR, 'pitch-end.py');
const sh = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: 'utf8' }); if (r.status !== 0) throw new Error(`${cmd} 실패: ${(r.stderr || '').slice(-400)}`); return r.stdout; };
const probe = (f) => Number(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]));
export const splitSentences = (text) => text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);


const STT = path.join(DIR, 'stt-check.py');
// CER 규칙은 stt-check.py(norm): 띄어쓰기·문장부호 제외, ㅐ/ㅔ 동음·되요/돼요 표기 차이는 같은 글자
export const cerOf = (ref, hyp, python = process.env.PITCH_PYTHON || 'python3', equal = []) => JSON.parse(sh(python, [STT, '--cer', ref, hyp, ...equal]).trim().split('\n').pop()).cer;
// 무음 구간(ffmpeg silencedetect -32dB·0.03초 이상): 단어별 시간에서 쉼을 빼려고 쓴다. whisper 단어 끝은 뒤따르는 쉼까지 늘어나 있어서 그대로 재면 정상 테이크도 늘어진 것으로 나온다
function silencesOf(mp3) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', mp3, '-af', 'silencedetect=noise=-32dB:d=0.03', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const st = [...r.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]), en = [...r.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
  return st.map((a, k) => [a, en[k] ?? 1e9]);
}
// 받아쓰기 + 단어별 시간 + 무음 구간(테이크 옆 .stt.json에 캐시). 캐시는 오디오 파일 내용(sha1)이 같고 단어 시간이 있을 때만 쓴다 — 같은 이름의 테이크가 다시 생성되면 다시 받아쓴다
function sttOf(take, python) {
  const f = take.mp3.replace(/\.mp3$/, '.stt.json'), sha = crypto.createHash('sha1').update(fs.readFileSync(take.mp3)).digest('hex');
  if (fs.existsSync(f)) {
    const c = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (c.sha === sha && c.words) { if (!c.sil) { c.sil = silencesOf(take.mp3); fs.writeFileSync(f, JSON.stringify(c)); } return c; }
  }
  const r = JSON.parse(sh(python, [STT, take.mp3]).trim().split('\n').pop());
  const c = { sha, text: r.text, words: r.words ?? [], sil: silencesOf(take.mp3) };
  fs.writeFileSync(f, JSON.stringify(c));
  return c;
}
// 늘어짐: 단어마다 발화 길이(단어 구간 − 그 안의 무음) ÷ 한글 글자 수(음절)가 maxSylSec를 넘으면 탈락. 한글이 없는 단어(숫자·영어)는 건너뜀
export function stretchOf(words, sil = [], maxSylSec = 0.25) {
  const rows = words.map((w) => {
    const syl = (w.w.match(/[가-힣]/g) ?? []).length, raw = w.e - w.s, quiet = sil.reduce((t, [x, y]) => t + Math.max(0, Math.min(w.e, y) - Math.max(w.s, x)), 0), dur = +(raw - quiet).toFixed(3);
    return { w: w.w, raw: +raw.toFixed(3), dur, syl, per: syl ? +(dur / syl).toFixed(3) : null };
  });
  return { rows, slow: rows.filter((r) => r.per !== null && r.per > maxSylSec), max: Math.max(0, ...rows.map((r) => r.per ?? 0)) };
}

// 한 테이크 생성(캐시). 같은 문장·앞뒤 문장·설정·테이크 번호면 그대로 쓴다
async function takeOf({ dir, i, t, sentences, cfg, apiKey }) {
  const mp3 = path.join(dir, `s${i}-t${t}.mp3`), js = path.join(dir, `s${i}-t${t}.json`);
  const prev = sentences.slice(Math.max(0, i - 2), i).join(' '), next = sentences.slice(i + 1, i + 3).join(' ');
  const text = cfg.tts?.[i + 1] ?? sentences[i]; // cfg.tts: {"문장번호": "TTS에 넣는 글(자막·대본은 그대로)"} — 발음을 바꿀 때
  const key = crypto.createHash('sha1').update(JSON.stringify([cfg.voiceId, sentences[i], prev, next, cfg.voiceSettings, t, ...(cfg.tts?.[i + 1] ? [text] : [])])).digest('hex');
  if (fs.existsSync(mp3) && fs.existsSync(js)) { const c = JSON.parse(fs.readFileSync(js, 'utf8')); if (c.key === key || (cfg.reuseCached && c.chars.join('').replace(/\s/g, '') === text.replace(/\s/g, ''))) return { mp3, ...c, cached: true }; } // reuseCached: 문장 글자가 같으면 앞뒤 문장이 바뀌어도 그 테이크를 재사용
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${cfg.voiceId}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: cfg.voiceSettings, ...(prev ? { previous_text: prev } : {}), ...(next ? { next_text: next } : {}) }),
  });
  if (!r.ok) throw new Error(`--reel-trend: ElevenLabs ${r.status} ${(await r.text()).slice(0, 300).replaceAll(apiKey, '***')}`);
  const j = await r.json();
  const al = j.alignment ?? j.normalized_alignment;
  if (!j.audio_base64 || !al?.characters?.length) throw new Error('--reel-trend: ElevenLabs 응답에 오디오·타이밍이 없어요');
  fs.writeFileSync(mp3, Buffer.from(j.audio_base64, 'base64'));
  const c = { key, chars: al.characters, starts: al.character_start_times_seconds, ends: al.character_end_times_seconds };
  fs.writeFileSync(js, JSON.stringify(c));
  return { mp3, ...c, cached: false };
}

// 문장 안에서 마지막 어절의 글자 구간과 문장 전체 구간(초)
function spans(take) {
  const idx = take.chars.map((c, k) => (/\s/.test(c) ? -1 : k)).filter((k) => k >= 0);
  const letters = idx.filter((k) => !/[.,!?~…]/.test(take.chars[k]));
  let w = letters.length - 1;
  while (w > 0 && letters[w - 1] === letters[w] - 1) w--; // 공백이 없는 연속 글자 = 마지막 어절
  return { s0: take.starts[letters[0]], s1: take.ends[letters[letters.length - 1]], w0: take.starts[letters[w]], w1: take.ends[letters[letters.length - 1]] };
}
function pitchOf(take, python) {
  const sp = spans(take);
  return JSON.parse(sh(python, [PITCH, take.mp3, sp.s0, sp.s1, sp.w0, sp.w1]).trim().split('\n').pop());
}

// TTS 입력 글과 자막(대본) 글이 다른 문장: 앞뒤 같은 글자는 그대로, 다른 가운데 부분은 TTS 글자들이 차지한 시간을 자막 글자 수로 균등하게 나눠 대본 글자로 바꾼다
function toDisplay(tk, display) {
  const src = tk.chars, dst = [...display];
  let p = 0; while (p < src.length && p < dst.length && src[p] === dst[p]) p++;
  let q = 0; while (q < src.length - p && q < dst.length - p && src[src.length - 1 - q] === dst[dst.length - 1 - q]) q++;
  const sm = src.length - p - q, dm = dst.length - p - q;
  const chars = [...dst], starts = [], ends = [];
  for (let k = 0; k < p; k++) { starts.push(tk.starts[k]); ends.push(tk.ends[k]); }
  if (dm > 0) {
    const a = sm > 0 ? tk.starts[p] : tk.ends[p - 1] ?? 0, b = sm > 0 ? tk.ends[p + sm - 1] : a + 0.01;
    for (let k = 0; k < dm; k++) { starts.push(a + (b - a) * k / dm); ends.push(a + (b - a) * (k + 1) / dm); }
  }
  for (let k = 0; k < q; k++) { starts.push(tk.starts[src.length - q + k]); ends.push(tk.ends[src.length - q + k]); }
  return { chars, starts, ends };
}

export async function getNarrationBySentence(outDir, cfg, log = console.log) {
  const name = cfg.cacheName ?? 'narration';
  const pc = { maxRise: 2, retries: 3, gap: 0.15, ...cfg.pitch };
  const wav = path.join(outDir, `${name}.wav`), js = path.join(outDir, `${name}.json`);
  const key = crypto.createHash('sha1').update(`sentence-v7|stretch${pc.stretch === false ? 0 : pc.maxSylSec ?? 0.25}|cer-jamo|${JSON.stringify(cfg.sttAllow ?? [])}|stt${pc.stt === false ? 0 : 1}|${pc.maxCer ?? 0.05}|${cfg.voiceId}|eleven_multilingual_v2|${cfg.text}|${JSON.stringify(cfg.voiceSettings)}|${JSON.stringify(pc)}|${JSON.stringify(cfg.sentenceSettings ?? {})}|${JSON.stringify(cfg.tts ?? {})}`).digest('hex');
  if (fs.existsSync(wav) && fs.existsSync(js)) { const c = JSON.parse(fs.readFileSync(js, 'utf8')); if (c.key === key) { log('  내레이션: 캐시 사용(API 호출 없음)'); return { mp3: wav, ...c }; } }
  try { if (!process.env.ELEVENLABS_API_KEY) process.loadEnvFile(path.join(ROOT, '.env.local')); } catch { /* .env.local 없음 */ }
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('--reel-trend: ELEVENLABS_API_KEY가 없어요(.env.local)');
  const python = process.env.PITCH_PYTHON || 'python3';
  const sentences = splitSentences(cfg.text);
  const dir = path.join(outDir, `${name}-s`);
  fs.mkdirSync(dir, { recursive: true });
  log(`  내레이션: 문장 ${sentences.length}개를 따로 생성(글자 ${[...cfg.text].length}자, 억양 검사 ${pc.maxRise}반음 초과면 최대 ${pc.retries}번 다시)`);
  const table = [], chosen = [];
  for (let i = 0; i < sentences.length; i++) {
    const need = pc.takesFor?.[i + 1] ?? pc.takes ?? 1, takes = []; // pc.takes: 문장마다 최소 이 개수의 테이크를 만든다(pc.takesFor {"문장번호": 개수}로 문장별 지정). 억양·늘어짐 통과 테이크 중 CER이 가장 낮은 것(같으면 음높이 폭이 큰 것)을 고른다
    const scfg = { ...cfg, voiceSettings: { ...cfg.voiceSettings, ...(cfg.sentenceSettings?.[i + 1] ?? {}) } }; // sentenceSettings: {"1": {stability, style…}} 문장별 설정(1부터)
    const ref = cfg.tts?.[i + 1] ?? sentences[i]; // 실제로 읽히는 글(발음 지정이 있으면 그 글)
    const useStt = pc.stt !== false, maxCer = pc.maxCer ?? 0.05, useStretch = useStt && pc.stretch !== false, maxSyl = pc.maxSylSec ?? 0.25;
    const allow = (cfg.sttAllow ?? []).filter((e) => ref.includes(e.match)).flatMap((e) => e.equal); // copy.narration.sttAllow: [{match: 문장에 들어 있는 글, equal: ["대본 표기=허용 표기"]}] — 문장별 받아쓰기 허용 표기
    const pass = (tk) => tk.rise !== null && tk.rise <= pc.maxRise;
    const fine = (tk) => pass(tk) && !(tk.stretch?.slow.length); // 억양 + 늘어짐 통과
    let cerRetried = false;
    for (let t = 1; t <= Math.max(need, 1) + pc.retries + (useStt ? 1 : 0); t++) {
      const tk = await takeOf({ dir, i, t, sentences, cfg: scfg, apiKey });
      Object.assign(tk, (({ rise_st, range_st, std_st }) => ({ rise: rise_st, range: range_st, std: std_st }))(pitchOf(tk, python)));
      if (useStt) { const st = sttOf(tk, python); tk.stt = st.text; tk.words = st.words; tk.cer = cerOf(ref, tk.stt, python, allow); if (useStretch) tk.stretch = stretchOf(st.words, st.sil, maxSyl); }
      takes.push(tk);
      log(`    문장 ${i + 1} 테이크 ${t}: 끝 ${tk.rise === null ? '측정 불가' : (tk.rise >= 0 ? '+' : '') + tk.rise + '반음'}, 음높이 폭 ${tk.range ?? '-'}반음${useStt ? `, CER ${(tk.cer * 100).toFixed(1)}%` : ''}${useStretch ? `, 음절당 최대 ${tk.stretch.max.toFixed(2)}초${tk.stretch.slow.length ? ` ⛔ 늘어짐 ${tk.stretch.slow.map((r) => `${r.w}(발화 ${r.dur}초/${r.syl}음절)`).join(' ')}` : ''}` : ''}${tk.cached ? ' (캐시)' : ''}`);
      if (takes.length < need) continue;
      const ok = takes.filter(fine);
      if (!ok.length) { if (t >= Math.max(need, 1) + pc.retries) break; continue; } // 억양·늘어짐 통과 없음 → 더 생성
      if (!useStt || Math.min(...ok.map((x) => x.cer)) <= maxCer) break;
      if (cerRetried) break; // CER이 넘어서 한 번 더 생성했는데도 넘으면 여기서 끝(아래에서 멈춤)
      cerRetried = true;
    }
    // 억양·늘어짐 통과 테이크 중 CER 최저(같으면 음높이 폭이 큰 것). 억양 통과가 없으면 늘어짐 통과 중 제일 덜 올라간 테이크(측정 불가는 맨 뒤). 늘어짐 통과가 하나도 없으면 멈춘다
    const okIdx = takes.map((tk, k) => k).filter((k) => fine(takes[k]));
    const slowFree = takes.map((tk, k) => k).filter((k) => !(takes[k].stretch?.slow.length));
    if (!slowFree.length) throw new Error(`--reel-trend: 문장 ${i + 1} 늘어짐 검사 실패 — 모든 테이크에 음절당 ${maxSyl}초를 넘는 단어가 있어요\n  대본: ${ref}\n${takes.map((tk, k) => `  테이크 ${k + 1}: ${tk.stretch.slow.map((r) => `${r.w} 발화 ${r.dur}초/${r.syl}음절`).join(', ')}`).join('\n')}`);
    let best = slowFree[0];
    if (okIdx.length) best = okIdx.reduce((a, b) => ((takes[b].cer ?? 0) < (takes[a].cer ?? 0) - 1e-9 || (Math.abs((takes[b].cer ?? 0) - (takes[a].cer ?? 0)) <= 1e-9 && (takes[b].range ?? 0) > (takes[a].range ?? 0)) ? b : a));
    else slowFree.forEach((k) => { const a = takes[k].rise ?? Infinity, b = takes[best].rise ?? Infinity; if (a < b) best = k; });
    if (useStt && takes[best].cer > maxCer) throw new Error(`--reel-trend: 문장 ${i + 1} 발음 검사 실패 — 선택된 테이크 ${best + 1}의 CER ${(takes[best].cer * 100).toFixed(1)}% > ${maxCer * 100}%\n  대본: ${ref}\n${takes.map((tk, k) => `  테이크 ${k + 1} (CER ${(tk.cer * 100).toFixed(1)}%, 끝 ${tk.rise}반음): ${tk.stt}`).join('\n')}`);
    chosen.push(takes[best]);
    table.push({ sentence: i + 1, text: sentences[i], rises: takes.map((x) => x.rise), ranges: takes.map((x) => x.range), cers: takes.map((x) => (x.cer === undefined ? null : +x.cer.toFixed(4))), stt: takes.map((x) => x.stt ?? null), stretch: takes.map((x) => x.stretch?.max ?? null), words: takes[best].stretch?.rows ?? null, chosen: best + 1, cer: takes[best].cer ?? null, ok: takes[best].rise !== null && takes[best].rise <= pc.maxRise });
  }
  // 합치기: 문장 wav(44.1k 모노) + 문장 사이 pc.gap초 무음
  const parts = [], offsets = [];
  const sil = path.join(dir, 'gap.wav');
  sh('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', String(pc.gap), '-c:a', 'pcm_s16le', sil]);
  let cur = 0;
  chosen.forEach((tk, i) => {
    const w = path.join(dir, `s${i}-chosen.wav`);
    sh('ffmpeg', ['-v', 'error', '-y', '-i', tk.mp3, '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', w]);
    const d = probe(w);
    offsets.push(cur); cur += d;
    parts.push(w);
    if (i < chosen.length - 1) { parts.push(sil); cur += probe(sil); }
  });
  const list = path.join(dir, 'concat.txt');
  fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n'));
  sh('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', wav]);
  const chars = [], starts = [], ends = [];
  chosen.forEach((tk, i) => {
    if (i > 0) { chars.push(' '); starts.push(ends[ends.length - 1]); ends.push(offsets[i] + tk.starts[0]); }
    const m = cfg.tts?.[i + 1] ? toDisplay(tk, sentences[i]) : tk;
    m.chars.forEach((c, k) => { chars.push(c); starts.push(offsets[i] + m.starts[k]); ends.push(offsets[i] + m.ends[k]); });
  });
  const duration = probe(wav);
  fs.writeFileSync(js, JSON.stringify({ key, text: cfg.text, chars, starts, ends, duration, takes: table }));
  log(`  내레이션 합침: ${duration.toFixed(2)}초 (문장 사이 무음 ${pc.gap}초 + 테이크 앞뒤 여백, 이후 무음 압축)`);
  return { mp3: wav, key, text: cfg.text, chars, starts, ends, duration, takes: table };
}
