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
    'enrich-recent-reviews', // 스팀 최근 30일 평가 (상점 페이지, 요청 간격 2초, 숨긴 게임 제외)
    'enrich-itad-heat',
    'enrich-videos 90', // YouTube 하루 한도 안에서 매일 조금씩
    'snapshot-hot-rank', // 메인 "지금 뜨는 게임" 순위 기록 (heat_rank 갱신 뒤)
    'purge-ip-hash', // 90일 지난 IP 해시 칸 비우기 (개인정보처리방침, 행은 지우지 않음)
    'purge-old-records', // 생성 1년 지난 신고·의견함 행 삭제 (개인정보처리방침, 한 번 최대 200개)
    'daily-summary', // 디스코드 일일 요약 (웹후크 없으면 출력만)
  ],
  // 매주: 새 게임 수집 + 게임 정보 보강
  weekly: [
    'bulk-import --apply', // 기본은 미리보기라 --apply로 실제 추가 (판매 순위 새 게임 최대 200개)
    'link-new-game-tags --apply', // 태그 없는 게임을 태그 나무(game_tags)에 연결 (스팀 태그 투표, AI 안 씀). 새 스팀 태그는 일일 요약에 알림
    'judge-new-games --apply', // 이번 주 새 게임의 진입장벽·혼자 플레이 단계 (Haiku, 200개 기준 약 $0.1)
    'import-other-stores',
    'check-delisted',
    'find-non-games',
    'enrich-fallback',
    'enrich-igdb',
    'enrich-specs',
    'fill-steam-categories', // 협동·대전 칸(스팀 분류) → 배지(category)도 같이 계산. 칸이 빈 새 게임만
    'enrich-tags',
    'fix-data-gaps',
    'fill-tags-desc',
    'normalize-tags',
    'enrich-other-stores',
    'enrich-ai-other',
    'fill-game-details',
    'enrich-card-images',
    'enrich-hero-images',
    'write-fun-descriptions 300',
    'fill-search-names', // 합방 영상 검색용 한국어 이름 (새 대상만, Haiku 1번)
    'fetch-coop-videos', // 인기 멀티 게임 50개의 합방 영상 (YouTube 게임당 101~202 사용)
    'enrich-update-date',
    'pick-weekly-featured', // 메인 "이번주의 게임" 선정 (이번 주 기록이 이미 있으면 건너뜀)
  ],
  // 매일 17:10 KST: YouTube 한도 초기화(태평양 자정) 직후, 새벽·주간 몫을 남기고 하이라이트 영상 수집 (한도 초과 시 조용히 멈춤)
  highlight: [
    'fetch-highlight-videos',
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

function run(step) {
  const [name, ...args] = step.split(' ');
  return new Promise((resolve) => {
    const file = `scripts/${name}.mjs`;
    if (!fs.existsSync(file)) return resolve({ name, status: '건너뜀 (파일 없음)', ok: true, sec: 0 });
    const started = Date.now();
    console.log(`\n━━━━━━━━ ▶ ${name} ━━━━━━━━`);
    const child = spawn('node', [...envArgs, file, ...args], { stdio: 'inherit' });
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
  `## ${{ daily: '매일 갱신', weekly: '매주 갱신', highlight: '하이라이트 영상' }[group]} 결과`,
  '',
  '| 단계 | 결과 | 걸린 시간 |',
  '|---|---|---|',
  ...results.map((r) => `| ${r.name} | ${r.ok ? '✅' : '❌'} ${r.status} | ${Math.floor(r.sec / 60)}분 ${r.sec % 60}초 |`),
];
console.log('\n' + lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');

process.exit(results.every((r) => r.ok) ? 0 : 1);
