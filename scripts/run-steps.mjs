// scripts/run-steps.mjs
// 데이터 스크립트를 순서대로 실행 (하나가 실패해도 나머지는 계속) + 결과 요약
// 사용: node scripts/run-steps.mjs daily | weekly
import { spawn } from 'child_process';
import fs from 'fs';

const GROUPS = {
  // 매일: 가격·할인·접속자처럼 자주 바뀌는 것
  daily: [
    'fix-missing-prices',
    'backfill-price-history',
    'backfill-price-history-other',
    'enrich-players',
    'enrich-itad-heat',
  ],
  // 매주: 새 게임 수집 + 게임 정보 보강
  weekly: [
    'bulk-import',
    'import-other-stores',
    'check-delisted',
    'enrich-fallback',
    'enrich-igdb',
    'enrich-specs',
    'enrich-tags',
    'fix-data-gaps',
    'fill-tags-desc',
    'enrich-other-stores',
    'enrich-ai-other',
    'enrich-card-images',
    'enrich-videos',
    'enrich-update-date',
  ],
};

const STEP_TIMEOUT_MIN = 45;
const group = process.argv[2];
const steps = GROUPS[group];
if (!steps) {
  console.error(`사용법: node scripts/run-steps.mjs ${Object.keys(GROUPS).join(' | ')}`);
  process.exit(1);
}

const envArgs = fs.existsSync('.env.local') ? ['--env-file=.env.local'] : [];

function run(name) {
  return new Promise((resolve) => {
    const file = `scripts/${name}.mjs`;
    if (!fs.existsSync(file)) return resolve({ name, status: '건너뜀 (파일 없음)', ok: true, sec: 0 });
    const started = Date.now();
    console.log(`\n━━━━━━━━ ▶ ${name} ━━━━━━━━`);
    const child = spawn('node', [...envArgs, file], { stdio: 'inherit' });
    const timer = setTimeout(() => child.kill('SIGTERM'), STEP_TIMEOUT_MIN * 60 * 1000);
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      const sec = Math.round((Date.now() - started) / 1000);
      if (signal) resolve({ name, status: `시간 초과 (${STEP_TIMEOUT_MIN}분)`, ok: false, sec });
      else resolve({ name, status: code === 0 ? '성공' : `실패 (코드 ${code})`, ok: code === 0, sec });
    });
  });
}

const results = [];
for (const s of steps) results.push(await run(s));

const lines = [
  `## ${group === 'daily' ? '매일 갱신' : '매주 갱신'} 결과`,
  '',
  '| 단계 | 결과 | 걸린 시간 |',
  '|---|---|---|',
  ...results.map((r) => `| ${r.name} | ${r.ok ? '✅' : '❌'} ${r.status} | ${Math.floor(r.sec / 60)}분 ${r.sec % 60}초 |`),
];
console.log('\n' + lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');

process.exit(results.every((r) => r.ok) ? 0 : 1);
