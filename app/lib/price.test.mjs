// 실행: npm test — 정가(original) 표시 규칙: 저장된 정가만 쓰고, 최종가·할인율로 역산하지 않는다
import test from 'node:test';
import assert from 'node:assert/strict';
import { getPriceInfo, flattenGame } from './price.ts';

const row = (price, discount_percent, original_price, checked_at = '2026-10-09T00:00:00Z') => ({ price, discount_percent, original_price, checked_at });
const game = (...history) => ({ price_history: history });

test('정가 있음 → 그 값 그대로 (역산 ₩20,491이 아니라 ₩20,500)', () => {
  const p = getPriceInfo(game(row(11270, 45, 20500)));
  assert.equal(p.original, 20500);
  assert.equal(p.formattedOriginal, '₩20,500');
  assert.equal(p.formattedFinal, '₩11,270');
  assert.equal(p.discount, 45);
});

test('실제 정가가 그대로 나옴: ₩6,240(10원 단위) · ₩6,700 · ₩43,400 · ₩63,900 · ₩6,550', () => {
  const cases = [[5300, 15, 6240], [4350, 35, 6700], [14760, 66, 43400], [40900, 36, 63900], [5890, 10, 6550]];
  for (const [final, d, orig] of cases) {
    const p = getPriceInfo(game(row(final, d, orig)));
    assert.equal(p.original, orig);
    assert.equal(p.formattedOriginal, `₩${orig.toLocaleString('ko-KR')}`);
  }
});

test('정가 없음(null·빈 칸) → original null, 역산하지 않음', () => {
  for (const o of [null, undefined]) {
    const p = getPriceInfo(game(row(11270, 45, o)));
    assert.equal(p.original, null);
    assert.equal(p.formattedOriginal, null);
    assert.equal(p.final, 11270);
    assert.equal(p.discount, 45); // 할인율·최종가는 그대로
  }
});

test('할인 없음 → original null (정가 칸에 값이 있어도)', () => {
  assert.equal(getPriceInfo(game(row(53000, 0, 53000))).original, null);
  assert.equal(getPriceInfo(game(row(53000, 0, null))).formattedOriginal, null);
});

test('정가가 최종가보다 크지 않으면 믿지 않고 null', () => {
  assert.equal(getPriceInfo(game(row(11270, 45, 11270))).original, null);
  assert.equal(getPriceInfo(game(row(11270, 45, 9000))).original, null);
  assert.equal(getPriceInfo(game(row(11270, 45, 'abc'))).original, null);
});

test('PostgREST numeric은 문자열로 와도 숫자로 읽음', () => {
  const p = getPriceInfo(game(row(11270, 45, '20500.00')));
  assert.equal(p.original, 20500);
  assert.equal(p.formattedOriginal, '₩20,500');
});

test('가장 최근 기록의 정가를 씀 (옛 기록의 정가는 무시)', () => {
  const p = getPriceInfo(game(row(20500, 0, 20500, '2026-09-01T00:00:00Z'), row(11270, 45, 20500, '2026-10-09T00:00:00Z'), row(15000, 27, 20500, '2026-09-20T00:00:00Z')));
  assert.equal(p.final, 11270);
  assert.equal(p.original, 20500);
});

test('메인 목록용 펴진 칸(price_final·price_discount·price_original)도 같은 규칙', () => {
  const p = getPriceInfo({ price_final: 5300, price_discount: 15, price_original: 6240 });
  assert.equal(p.formattedOriginal, '₩6,240');
  assert.equal(getPriceInfo({ price_final: 5300, price_discount: 15 }).original, null);
  assert.equal(getPriceInfo({ price_final: 53000 }).original, null);
});

test('flattenGame: price_original은 정가가 있을 때만 실리고, price_history는 빠짐', () => {
  const withOrig = flattenGame({ id: 'a', ...game(row(11270, 45, 20500)) });
  assert.equal(withOrig.price_final, 11270);
  assert.equal(withOrig.price_discount, 45);
  assert.equal(withOrig.price_original, 20500);
  assert.equal('price_history' in withOrig, false);
  const without = flattenGame({ id: 'b', ...game(row(11270, 45, null)) });
  assert.equal('price_original' in without, false);
  const noSale = flattenGame({ id: 'c', ...game(row(53000, 0, 53000)) });
  assert.equal('price_original' in noSale, false);
  assert.equal('price_discount' in noSale, false);
});

test('flattenGame을 거쳐도 화면에 나가는 정가가 같음', () => {
  const flat = flattenGame({ id: 'a', ...game(row(5300, 15, 6240)) });
  assert.equal(getPriceInfo(flat).formattedOriginal, '₩6,240');
});

test('가격 유형 게임(월 구독 등)·100원 미만 기록은 가격 없음', () => {
  assert.equal(getPriceInfo({ price_type: 'subscription', ...game(row(11270, 45, 20500)) }), null);
  assert.equal(getPriceInfo(game(row(12, 0, null))), null);
});
