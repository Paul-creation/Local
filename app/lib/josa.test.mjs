// 실행: npm test — 계정 페이지 제목의 주격 조사(이/가)
import test from 'node:test';
import assert from 'node:assert/strict';
import { withSubjectJosa } from './josa.ts';

test('받침 있는 한글은 이, 없는 한글은 가, 그 밖은 이', () => {
  assert.equal(withSubjectJosa('게임로그'), '게임로그가');
  assert.equal(withSubjectJosa('게임창고'), '게임창고가');
  assert.equal(withSubjectJosa('겜덕후'), '겜덕후가');
  assert.equal(withSubjectJosa('게임북'), '게임북이');
  assert.equal(withSubjectJosa('gamelog'), 'gamelog이');
});
