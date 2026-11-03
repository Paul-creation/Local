// scripts/insta/outro-voice.mjs — --reel-trend 엔딩 시그니처 음성 3테이크 생성
// 실행: node scripts/insta/outro-voice.mjs   → scripts/insta/assets/brand/outro-voice-take1~3.mp3 (+ 글자 타이밍 .json). 이미 있는 테이크는 건너뜀(--force로 다시 생성)
// 쓰는 쪽: 마음에 드는 테이크를 outro-voice.mp3(+ outro-voice.json)로 복사하면 그게 기본. 없으면 take1
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'scripts/insta/assets/brand');
const TEXT = '친구랑 할 게임은, 재미두나우!';
const VOICE = 'uyVNoMrnUku1dZyVEXwD';
const SETTINGS = { stability: 0.35, similarity_boost: 0.8, style: 0.35, speed: 1.1 };
try { if (!process.env.ELEVENLABS_API_KEY) process.loadEnvFile(path.join(ROOT, '.env.local')); } catch { /* .env.local 없음 */ }
const key = process.env.ELEVENLABS_API_KEY;
if (!key) { console.error('ELEVENLABS_API_KEY가 없어요(.env.local)'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
for (let i = 1; i <= 3; i++) {
  const mp3 = path.join(OUT, `outro-voice-take${i}.mp3`), js = path.join(OUT, `outro-voice-take${i}.json`);
  if (!process.argv.includes('--force') && fs.existsSync(mp3) && fs.existsSync(js)) { console.log(`take${i}: 있음, 건너뜀`); continue; }
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ text: TEXT, model_id: 'eleven_multilingual_v2', voice_settings: SETTINGS }),
  });
  if (!r.ok) { console.error(`take${i}: ElevenLabs ${r.status} ${(await r.text()).slice(0, 200).replaceAll(key, '***')}`); process.exit(1); }
  const j = await r.json();
  fs.writeFileSync(mp3, Buffer.from(j.audio_base64, 'base64'));
  const al = j.alignment ?? j.normalized_alignment;
  fs.writeFileSync(js, JSON.stringify({ text: TEXT, settings: SETTINGS, chars: al.characters, starts: al.character_start_times_seconds, ends: al.character_end_times_seconds }));
  console.log(`take${i}: ${path.relative(ROOT, mp3)}`);
}
