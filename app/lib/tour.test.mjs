import test from 'node:test';
import assert from 'node:assert/strict';
import { parseState, serializeState, decide, advance, isBot, pageOf, placeBubble, resolveStep, stepTargetNames, TOUR_STEPS, TOUR_TOTAL, TOUR_KEY, TOUR_FINALE, FINALE_MS, TOUR_SAMPLE_HREF } from './tour.ts';
import { SITE_NAME } from './site.ts';
import { queryHref, SITUATIONS } from './abSearch.ts';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130 Safari/537.36';
const run = (step) => serializeState({ status: 'running', step });

test('저장값 읽기: 없음·정상·깨진 값', () => {
  assert.equal(parseState(null), null);
  assert.deepEqual(parseState(run(2)), { status: 'running', step: 2 });
  assert.deepEqual(parseState('{"status":"skipped","step":9}'), { status: 'skipped', step: 0 });
  assert.equal(parseState('쓰레기').status, 'done');
});

test('첫 방문 + 홈이면 시작, 검색 조건·다른 페이지·봇이면 시작 안 함', () => {
  assert.deepEqual(decide(null, '/', '', UA), { kind: 'start' });
  assert.equal(decide(null, '/', '?sale=1', UA).kind, 'none');
  assert.equal(decide(null, '/guide', '', UA).kind, 'none');
  assert.equal(decide(null, '/', '', 'Mozilla/5.0 (compatible; Googlebot/2.1)').kind, 'none');
  assert.equal(decide(null, '/', '', '').kind, 'none');
});

test('끝냈거나 건너뛴 사람에게는 다시 안 뜸', () => {
  assert.equal(decide(serializeState({ status: 'done', step: 0 }), '/', '', UA).kind, 'none');
  assert.equal(decide(serializeState({ status: 'skipped', step: 1 }), '/', '', UA).kind, 'none');
});

test('진행 중: 그 단계의 페이지에서만 이어가고 다른 페이지면 종료', () => {
  assert.deepEqual(decide(run(4), '/', '', UA), { kind: 'resume', step: 4 });
  assert.deepEqual(decide(run(6), '/find', '?n=2&how=coop', UA), { kind: 'resume', step: 6 });
  assert.equal(decide(run(6), '/', '', UA).kind, 'end');
  assert.equal(decide(run(0), '/community', '', UA).kind, 'end');
  assert.equal(decide(run(7), '/games/abc', '', UA).kind, 'end');
});

test('단계 진행: 마지막 다음은 마무리', () => {
  assert.equal(advance(0), 1);
  assert.equal(advance(TOUR_TOTAL - 2), TOUR_TOTAL - 1);
  assert.equal(advance(TOUR_TOTAL - 1), 'finale');
});

test('단계 정의: 8단계 — 환영 → 누구랑·어떻게·뭐 할까·찾기 → 상황 타일 → 결과 근거 → 로그인', () => {
  assert.equal(TOUR_TOTAL, 8);
  assert.deepEqual(TOUR_STEPS.map((s) => s.id), ['welcome', 'who', 'how', 'what', 'go', 'situations', 'evidence', 'login']);
  assert.deepEqual(TOUR_STEPS.map((s) => s.page), ['home', 'home', 'home', 'home', 'home', 'home', 'find', 'find']);
  // 검색창 단계는 설명만 보는 단계라 대상 클릭을 막고, 상황 타일만 직접 눌러 결과로 간다 (말풍선 "다음"으로도 같은 곳으로 이동)
  assert.deepEqual(TOUR_STEPS.filter((s) => s.action === 'target').map((s) => s.id), ['situations']);
  assert.deepEqual(TOUR_STEPS.filter((s) => s.block).map((s) => s.id), ['welcome', 'who', 'how', 'what', 'go', 'evidence', 'login']);
  assert.equal(TOUR_STEPS[5].nextHref, TOUR_SAMPLE_HREF);
  assert.equal(TOUR_STEPS[5].hitSelector, '.ab-sit-card');
  // 결과 화면 단계는 대상이 없으면(근거 배지 없음·로그인 상태) 건너뛴다
  assert.deepEqual(TOUR_STEPS.filter((s) => s.optional).map((s) => s.id), ['evidence', 'login']);
  assert.ok(TOUR_STEPS.every((s) => s.title && s.desc && s.targets.length > 0));
  assert.ok(TOUR_STEPS.every((s) => s.action === 'target' || s.buttonLabel));
});

test('결과 화면으로 가는 예시 주소는 첫 상황 타일과 같은 조건', () => {
  assert.equal(TOUR_SAMPLE_HREF, queryHref(SITUATIONS[0].query));
});

test('대상 이름: 데스크톱 칸·휴대폰 알약, 방문자 히어로·로그인 사용자 검색창 중 보이는 쪽', () => {
  assert.deepEqual(stepTargetNames(0), ['hero', 'welcome-member']);
  assert.deepEqual(stepTargetNames(1), ['ab-who', 'ab-pill']);
  assert.deepEqual(stepTargetNames(4), ['ab-go', 'ab-pill']);
  assert.deepEqual(stepTargetNames(5), ['situations']);
  assert.deepEqual(stepTargetNames(6), ['evidence']);
  assert.deepEqual(stepTargetNames(7), ['login']);
});

test('저장 키는 v3 — 예전(v1·v2) 값은 읽지 않아서 기존 방문자도 처음 방문으로 본다', () => {
  assert.equal(TOUR_KEY, 'jdn_tour_v3');
  assert.ok(TOUR_KEY.startsWith('jdn_'));
  assert.equal(decide(null, '/', '', UA).kind, 'start');
});

test('저장된 단계가 범위를 벗어나도 깨지지 않음', () => {
  for (let step = 0; step < TOUR_TOTAL; step++) {
    const page = TOUR_STEPS[step].page === 'home' ? '/' : '/find';
    assert.deepEqual(decide(run(step), page, '', UA), { kind: 'resume', step });
  }
  assert.equal(parseState('{"status":"running","step":8}').step, 0);
  assert.equal(parseState('{"status":"running","step":-1}').step, 0);
  assert.equal(parseState('{"status":"running","step":"3"}').step, 0);
});

test('단계 문구: 사이트 이름은 SITE_NAME, 마무리는 한 줄·2초', () => {
  const w = resolveStep(0, SITE_NAME);
  assert.equal(w.title, `${SITE_NAME}에 온 걸 환영해요`);
  assert.equal(w.block, true);
  assert.equal(resolveStep(5, SITE_NAME).action, 'target');
  assert.equal(resolveStep(5, SITE_NAME).block, false);
  assert.equal(resolveStep(7, SITE_NAME).buttonLabel, '끝내기');
  assert.deepEqual(TOUR_FINALE, { title: '준비 끝!' });
  assert.equal(FINALE_MS, 2000);
});

test('pageOf·isBot', () => {
  assert.equal(pageOf('/'), 'home');
  assert.equal(pageOf('/find'), 'find');
  assert.equal(pageOf('/games/x1'), null);
  assert.equal(pageOf('/games'), null);
  assert.equal(isBot(UA), false);
  assert.equal(isBot('Yeti/1.1 (NHN Corp.)'), true);
});

test('말풍선 자리: 아래 기본, 아래가 모자라면 위, 둘 다 안 되면 겹침', () => {
  const b = { w: 300, h: 160 };
  const mid = placeBubble({ left: 100, top: 100, width: 200, height: 40 }, b, 1000, 800);
  assert.equal(mid.side, 'below');
  assert.equal(mid.top, 158);
  assert.ok(mid.tailX >= 22 && mid.tailX <= 278);
  const low = placeBubble({ left: 100, top: 700, width: 200, height: 40 }, b, 1000, 800);
  assert.equal(low.side, 'above');
  assert.equal(low.top, 700 - 18 - 160);
  const tall = placeBubble({ left: 100, top: 10, width: 200, height: 780 }, b, 1000, 800);
  assert.equal(tall.side, 'over');
  assert.equal(tall.tailX, null);
});

test('말풍선은 화면 가로 안에 머문다 (375px)', () => {
  const p = placeBubble({ left: 330, top: 100, width: 40, height: 30 }, { w: 300, h: 150 }, 375, 700);
  assert.ok(p.left >= 16 && p.left + 300 <= 375 - 16 + 1);
});
