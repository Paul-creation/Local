// 실행: npm test — price-check: "묶음 전용"으로 시작하는 메모는 매일 덮어쓰지 않음
import test from 'node:test';
import assert from 'node:assert/strict';
import { markPriceStatus, BUNDLE_NOTE_PREFIX, NOT_BUNDLE_NOTE } from './price-check.mjs';

// Supabase 가짜: 호출한 메서드(이름·인자)를 순서대로 기록하고 항상 성공
function fakeDb() {
  const log = [];
  const chain = (name, args) => {
    log.push([name, args]);
    return new Proxy({}, { get: (_, k) => (k === 'then' ? (res) => res({ error: null }) : (...a) => chain(k, a)) });
  };
  return { log, from: (t) => chain('from', [t]) };
}

test('실패 메모를 적을 때 "묶음 전용"으로 시작하는 메모는 건드리지 않는 조건이 붙음', async () => {
  const db = fakeDb();
  await markPriceStatus(db, { okIds: [], failed: [{ id: 'g1', note: '가격 없음 (판매 중단·묶음 전용·무료 전환)' }] });
  const noteUpdate = db.log.findIndex(([n, a]) => n === 'update' && a[0]?.price_check_note != null);
  assert.ok(noteUpdate >= 0);
  const after = db.log.slice(noteUpdate + 1).map(([n, a]) => [n, a[0]]);
  assert.deepEqual(after.find(([n]) => n === 'or'), ['or', NOT_BUNDLE_NOTE]);
  assert.deepEqual(after.find(([n]) => n === 'eq'), ['eq', 'id']);
});

test('접두어는 "묶음 전용"이고, 스크립트가 쓰는 기본 메모(가격 없음 (...묶음 전용...))와 겹치지 않음', () => {
  assert.equal(BUNDLE_NOTE_PREFIX, '묶음 전용');
  assert.equal(NOT_BUNDLE_NOTE, 'price_check_note.is.null,price_check_note.not.like.묶음 전용*');
  assert.ok(!'가격 없음 (판매 중단·묶음 전용·무료 전환)'.startsWith(BUNDLE_NOTE_PREFIX));
});
