// scripts/run-steps.mjs
// 데이터 스크립트를 순서대로 실행 (하나가 실패해도 나머지는 계속) + 결과 요약
// 사용: node scripts/run-steps.mjs daily | weekly
import { spawn } from 'child_process';
import fs from 'fs';
import { THU_TRAILER_YT_MAX, pacificNow } from './lib/quota-plan.mjs';

const GROUPS = {
  // 매일: 가격·할인·접속자처럼 자주 바뀌는 것
  daily: [
    'fix-missing-prices',
    // ITAD 단계는 한 묶음으로 앞에 (5분 창 한도를 사용자 화면에 직접 보이는 것부터 씀, 창 상태는 scripts/.cache/itad-window.json으로 공유)
    'backfill-price-history-other', // 스팀 외 가격 (약 15건)
    'fill-sale-ends', // 할인 종료 시각 (ITAD prices/v3 200개씩, 약 4번 요청). 모르면 null, ITAD 오류면 기존 값 유지
    'backfill-price-history', // 스팀 할인 기록 (증분: 새 게임·기록 5건 미만 + 요일 1/7)
    'enrich-itad-heat', // 순위·역대 최고 동접·역대 최저가 (상위 150개 + 요일 몫 약 280건, 한도 안에서 약 17분)
    'enrich-players',
    'enrich-recent-reviews', // 스팀 최근 30일 평가 (상점 페이지, 요청 간격 2초, 숨긴 게임 제외)
    'fetch-streamer-videos --apply', // 스트리머 공식 채널 새 영상 → 게임 연결 (YouTube 하루 200유닛, 하이라이트 작업이 이 몫을 남겨 둠). 트레일러보다 먼저
    'enrich-videos 90', // YouTube 하루 한도 안에서 매일 조금씩
    'snapshot-hot-rank', // 메인 "지금 뜨는 게임" 순위 기록 (heat_rank 갱신 뒤)
    'snapshot-review-history', // 리뷰 수·긍정률 날짜별 기록 (enrich-players 뒤, 인원별 추천 급상승용. review_history 표가 없으면 실패로 표시)
    'purge-ip-hash', // 90일 지난 IP 해시 칸 비우기 (개인정보처리방침, 행은 지우지 않음)
    'purge-old-records', // 생성 1년 지난 신고·의견함 행 삭제 (개인정보처리방침, 한 번 최대 200개)
    'update-trending --apply', // 검색 "지금 뜨는 게임" 필터용 판정 저장 (games.trend_badge·trend_score, 전체 게임·app/lib/trending 규칙, 읽기 몇 번 + 판정된 게임·초기화할 게임 update. 칸이 없으면(마이그레이션 전) 실패로 표시)
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
    'enrich-screenshots --max=400', // 스팀 스크린샷 (빈 칸만, 요청 간격 2초라 한 번에 최대 400개 ≈ 14분). 첫 대량 채우기는 "스크린샷 채우기" 워크플로를 수동 실행
    'parse-specs --apply', // 사양 텍스트 → CPU·GPU 등급 등(games.spec_parsed). 새 게임·사양·출시 연도가 바뀐 게임만 처리 (spec_hash), AI 안 씀. 칸이 없으면(마이그레이션 전) 실패로 표시
    'fill-crossplay --apply --true-only', // 스팀 "Cross-Platform Multiplayer" 있는 게임만 true로 (없으면 null 그대로). 칸이 빈 스팀 게임만, AI 안 씀
    'fill-steam-categories', // 협동·대전 칸(스팀 분류) → 배지(category)도 같이 계산. 칸이 빈 새 게임만
    'list-players-pending', // 노출 게임 중 최대 인원이 빈 게임 목록("인원 검증 대기", scripts/.cache/pending-players.json) — 스팀 카테고리·접속자·IGDB 후보값 포함. DB 쓰기·AI 없음, 직접 검증 결정 파일로 채움. 스팀 카테고리 최대 300개 요청(2초 간격)
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
    'fill-activities-v2 --apply --yes --new-days 14', // 최근 14일 안에 들어온 새 게임의 "가능한 활동" (Message Batches, Sonnet 5.5, 게임당 약 $0.01~0.02). 예전 미처리 게임은 대상 아님, 처리한 게임은 다시 안 함
    'fill-english-names --apply', // 한국어 이름 게임에 스팀 영어 이름을 search_name_ko 뒤에 덧붙임 (영어로 안 찾히는 새 게임만, AI 안 씀, 요청 간격 1.5초)
    'fetch-coop-videos', // 인기 멀티 게임 50개의 합방 영상 (YouTube 게임당 101~202 사용)
    'enrich-update-date',
    'build-similar-games --apply', // 상세·찜 추천의 "비슷한 게임"(game_similar): 태그 득표·활동 코사인 상위 18개. 바뀐 게임만 저장, AI·외부 요청 없음. 표가 없으면(마이그레이션 전) 실패로 표시
    'pick-weekly-featured', // 메인 "이번주의 게임" 선정 (이번 주 기록이 이미 있으면 건너뜀)
  ],
  // 매일 17:10 KST: YouTube 한도 초기화(태평양 자정) 직후, 새벽·주간 몫을 남기고 하이라이트 영상 수집 (한도 초과 시 조용히 멈춤)
  highlight: [
    'fetch-highlight-videos',
  ],
};

const STEP_TIMEOUT_MIN = 45;
const STEP_TIMEOUT_OVERRIDE_MIN = { 'enrich-itad-heat': 90, 'fill-activities-v2': 90 }; // 배치 결과를 기다리는 시간이 길 수 있음 // ITAD 5분 창 한도 안에서 약 900건 = 약 1시간
const group = process.argv[2];
const steps = GROUPS[group];
if (!steps) {
  console.error(`사용법: node scripts/run-steps.mjs ${Object.keys(GROUPS).join(' | ')}`);
  process.exit(1);
}

const envArgs = fs.existsSync('.env.local') ? ['--env-file=.env.local'] : [];

// 목요일(태평양 시간)은 금요일 02:00 주간 합방 영상이 한도를 크게 쓰므로, 같은 한도일의 일간 트레일러는 YouTube 검색을 상한까지만
// (하이라이트의 목요일 상한 계산이 같은 값을 남겨 둠, lib/quota-plan.mjs)
const withQuotaPlan = (step) =>
  group === 'daily' && step.startsWith('enrich-videos') && pacificNow().weekday === 'Thu' ? `${step} --yt-max=${THU_TRAILER_YT_MAX}` : step;

function run(rawStep) {
  const step = withQuotaPlan(rawStep);
  const [name, ...args] = step.split(' ');
  return new Promise((resolve) => {
    const file = `scripts/${name}.mjs`;
    if (!fs.existsSync(file)) return resolve({ name, status: '건너뜀 (파일 없음)', ok: true, sec: 0 });
    const started = Date.now();
    console.log(`\n━━━━━━━━ ▶ ${name} ━━━━━━━━`);
    const child = spawn('node', [...envArgs, file, ...args], { stdio: 'inherit' });
    const timeoutMin = STEP_TIMEOUT_OVERRIDE_MIN[name] ?? STEP_TIMEOUT_MIN;
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMin * 60 * 1000);
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      const sec = Math.round((Date.now() - started) / 1000);
      if (signal) resolve({ name, status: `시간 초과 (${timeoutMin}분)`, ok: false, sec });
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
