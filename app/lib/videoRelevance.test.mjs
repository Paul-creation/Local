// 실행: npm test — 대표 영상 점수(제목에 게임 이름 + 플레이 단서, 사람 소개는 0점)
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMatchers } from './gameMatch.mjs';
import { titleScore, personAfter } from './videoRelevance.mjs';

const ms = buildMatchers([{ id: 'lol', name: 'League of Legends', search_name_ko: '롤, 리그 오브 레전드' }]);

test('titleScore: 이름이 사람 소개면 0, 그냥 이름이면 2, 플레이 단서가 있으면 3', () => {
  assert.equal(titleScore('이걸 준비했다고?? 롤 챌린저+카드 컬렉터 | 조재원 장인초대석', ms), 0);
  assert.equal(titleScore('롤 하이라이트', ms), 2);
  assert.equal(titleScore('롤 솔랭 듀오 플레이', ms), 3);
  assert.equal(titleScore('오늘의 브이로그', ms), 0);
});

test('personAfter: core는 어떤 이름이든, strict는 짧은 이름만 제외하는 단어', () => {
  assert.equal(personAfter(' 챌린저 카드'), 'core');
  assert.equal(personAfter(' 프로 출신'), 'strict');
  assert.equal(personAfter(' 프로젝트'), null);
  assert.equal(personAfter(' 솔랭'), null);
});
