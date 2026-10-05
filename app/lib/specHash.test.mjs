// 실행: npm test — parse-specs의 "이미 처리한 게임은 건너뛰기" 해시
import test from 'node:test';
import assert from 'node:assert/strict';
import { specHash, VERSION } from '../../scripts/lib/spec-hash.mjs';

test('같은 사양이면 같은 해시 (다음 실행 때 건너뜀)', () => {
  assert.equal(specHash('min text', 'rec text'), specHash('min text', 'rec text'));
  assert.equal(specHash(null, null), specHash('', ''));
  assert.match(specHash('a', 'b'), /^[0-9a-f]{16}$/);
});

test('사양 텍스트가 바뀌면 다른 해시 (그 게임만 다시 처리)', () => {
  const base = specHash('min text', 'rec text');
  assert.notEqual(specHash('min text!', 'rec text'), base);
  assert.notEqual(specHash('min text', 'rec text 2'), base);
  assert.notEqual(specHash('min', 'rec'), specHash('minrec', ''), '칸 경계가 달라도 구분');
});

test('파서 버전은 4 이상 (세대 짐작 제거)', () => {
  assert.ok(VERSION >= 4);
});
