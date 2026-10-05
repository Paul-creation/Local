// 실행: npm test — parse-specs의 "이미 처리한 게임은 건너뛰기" 해시
import test from 'node:test';
import assert from 'node:assert/strict';
import { specHash, releaseYearOf, VERSION } from '../../scripts/lib/spec-hash.mjs';

test('같은 사양·출시 연도면 같은 해시 (다음 실행 때 건너뜀)', () => {
  assert.equal(specHash('min text', 'rec text', 2023), specHash('min text', 'rec text', 2023));
  assert.equal(specHash(null, null, null), specHash('', '', null));
  assert.match(specHash('a', 'b', 2020), /^[0-9a-f]{16}$/);
});

test('사양 텍스트·출시 연도가 바뀌면 다른 해시 (그 게임만 다시 처리)', () => {
  const base = specHash('min text', 'rec text', 2023);
  assert.notEqual(specHash('min text!', 'rec text', 2023), base);
  assert.notEqual(specHash('min text', 'rec text 2', 2023), base);
  assert.notEqual(specHash('min text', 'rec text', 2024), base);
  assert.notEqual(specHash('min text', 'rec text', null), base);
  assert.notEqual(specHash('min', 'rec'), specHash('minrec', ''), '칸 경계가 달라도 구분');
});

test('출시 연도 읽기, 파서 버전은 3 이상', () => {
  assert.equal(releaseYearOf('2023-08-03'), 2023);
  assert.equal(releaseYearOf(null), null);
  assert.equal(releaseYearOf('not a date'), null);
  assert.ok(VERSION >= 3);
});
