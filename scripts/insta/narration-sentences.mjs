// scripts/insta/narration-sentences.mjs — --reel-trend 내레이션을 문장 단위로 생성(기본)
// 문장마다 ElevenLabs(eleven_multilingual_v2, with-timestamps)를 따로 부르되 previous_text/next_text로 앞뒤 문장을 넘겨 톤을 잇는다.
// 문장 끝 억양 검사: 마지막 어절 끝 음높이가 그 문장 평균보다 maxRise(기본 2)반음 넘게 올라가면 그 문장만 다시 생성(최대 retries=3번).
// 그래도 올라가면 제일 덜 올라간 테이크를 쓴다. 분석은 scripts/insta/pitch-end.py(librosa.pyin) — python은 환경변수 PITCH_PYTHON(없으면 python3)
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

// 한 테이크 생성(캐시). 같은 문장·앞뒤 문장·설정·테이크 번호면 그대로 쓴다
async function takeOf({ dir, i, t, sentences, cfg, apiKey }) {
  const mp3 = path.join(dir, `s${i}-t${t}.mp3`), js = path.join(dir, `s${i}-t${t}.json`);
  const prev = sentences.slice(Math.max(0, i - 2), i).join(' '), next = sentences.slice(i + 1, i + 3).join(' ');
  const key = crypto.createHash('sha1').update(JSON.stringify([cfg.voiceId, sentences[i], prev, next, cfg.voiceSettings, t])).digest('hex');
  if (fs.existsSync(mp3) && fs.existsSync(js)) { const c = JSON.parse(fs.readFileSync(js, 'utf8')); if (c.key === key || (cfg.reuseCached && c.chars.join('').replace(/\s/g, '') === sentences[i].replace(/\s/g, ''))) return { mp3, ...c, cached: true }; } // reuseCached: 문장 글자가 같으면 앞뒤 문장이 바뀌어도 그 테이크를 재사용
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${cfg.voiceId}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ text: sentences[i], model_id: 'eleven_multilingual_v2', voice_settings: cfg.voiceSettings, ...(prev ? { previous_text: prev } : {}), ...(next ? { next_text: next } : {}) }),
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

export async function getNarrationBySentence(outDir, cfg, log = console.log) {
  const name = cfg.cacheName ?? 'narration';
  const pc = { maxRise: 2, retries: 3, gap: 0.15, ...cfg.pitch };
  const wav = path.join(outDir, `${name}.wav`), js = path.join(outDir, `${name}.json`);
  const key = crypto.createHash('sha1').update(`sentence-v1|${cfg.voiceId}|eleven_multilingual_v2|${cfg.text}|${JSON.stringify(cfg.voiceSettings)}|${JSON.stringify(pc)}|${JSON.stringify(cfg.sentenceSettings ?? {})}`).digest('hex');
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
    const takes = [], need = pc.takes ?? 1; // pc.takes: 문장마다 최소 이 개수의 테이크를 만들고(통과가 하나도 없으면 retries까지), 통과한 것 중 음높이 폭(range_st)이 가장 큰(=표현이 큰) 테이크를 고른다
    const scfg = { ...cfg, voiceSettings: { ...cfg.voiceSettings, ...(cfg.sentenceSettings?.[i + 1] ?? {}) } }; // sentenceSettings: {"1": {stability, style…}} 문장별 설정(1부터)
    const pass = (tk) => tk.rise !== null && tk.rise <= pc.maxRise;
    for (let t = 1; t <= Math.max(need, 1) + pc.retries; t++) {
      const tk = await takeOf({ dir, i, t, sentences, cfg: scfg, apiKey });
      Object.assign(tk, (({ rise_st, range_st, std_st }) => ({ rise: rise_st, range: range_st, std: std_st }))(pitchOf(tk, python)));
      takes.push(tk);
      log(`    문장 ${i + 1} 테이크 ${t}: 끝 ${tk.rise === null ? '측정 불가' : (tk.rise >= 0 ? '+' : '') + tk.rise + '반음'}, 음높이 폭 ${tk.range ?? '-'}반음${tk.cached ? ' (캐시)' : ''}`);
      if (takes.length >= need && takes.some(pass)) break;
    }
    // 통과한 테이크 중 음높이 폭이 가장 큰 것. 통과가 없으면 제일 덜 올라간 테이크(측정 불가는 맨 뒤)
    let best = 0;
    const passed = takes.map((tk, k) => k).filter((k) => pass(takes[k]));
    if (passed.length) best = passed.reduce((a, b) => ((takes[b].range ?? 0) > (takes[a].range ?? 0) ? b : a));
    else takes.forEach((tk, k) => { const a = tk.rise ?? Infinity, b = takes[best].rise ?? Infinity; if (a < b) best = k; });
    chosen.push(takes[best]);
    table.push({ sentence: i + 1, text: sentences[i], rises: takes.map((x) => x.rise), ranges: takes.map((x) => x.range), chosen: best + 1, ok: takes[best].rise !== null && takes[best].rise <= pc.maxRise });
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
    tk.chars.forEach((c, k) => { chars.push(c); starts.push(offsets[i] + tk.starts[k]); ends.push(offsets[i] + tk.ends[k]); });
  });
  const duration = probe(wav);
  fs.writeFileSync(js, JSON.stringify({ key, text: cfg.text, chars, starts, ends, duration, takes: table }));
  log(`  내레이션 합침: ${duration.toFixed(2)}초 (문장 사이 무음 ${pc.gap}초 + 테이크 앞뒤 여백, 이후 무음 압축)`);
  return { mp3: wav, key, text: cfg.text, chars, starts, ends, duration, takes: table };
}
