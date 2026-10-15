// 실행: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, parseJson } from './activities-classify.mjs';

const HAY = 'Drive trucks across Europe. Build a rail network with "Train" tags (120).';
const v = (o) => ({ ...Object.fromEntries([]), ...o });

test('입력에 있는 인용이면 confirmed, 모델 지식이면 unsure', () => {
  const r = classify({
    v: v({ drive: 'yes', train: 'yes', fish: 'yes', cook: 'no', sail: 'unknown' }),
    e: {
      drive: { basis: 'input', quote: 'Drive trucks across Europe', note: '트럭 운전' },
      train: { basis: 'knowledge', quote: '', note: '기차' },
      fish: { basis: 'input', quote: 'catch fish in the lake', note: '낚시' },
    },
  }, HAY);
  assert.deepEqual(r.confirmed, ['drive']);
  assert.deepEqual(r.unsure.sort(), ['fish', 'train']);
  assert.equal(r.evidence.fish.basis, 'knowledge'); // 인용이 입력에 없으면 근거를 지움
  assert.equal(r.evidence.fish.quote, '');
  assert.equal(r.quoteFail, 1);
  assert.equal(r.no, 1);
});

test('대소문자·따옴표·공백 차이는 같은 인용으로 본다', () => {
  const r = classify({ v: { build: 'yes' }, e: { build: { basis: 'input', quote: 'build a  RAIL network', note: '' } } }, HAY);
  assert.deepEqual(r.confirmed, ['build']);
});

test('너무 짧은 인용·모르는 키·누락 키는 확정하지 않는다', () => {
  const r = classify({ v: { drive: 'yes', nope: 'yes' }, e: { drive: { basis: 'input', quote: 'Dr', note: '' } } }, HAY);
  assert.deepEqual(r.confirmed, []);
  assert.deepEqual(r.unsure, ['drive']);
});

test('parseJson: 앞뒤 설명이 붙어도 JSON만 읽는다', () => {
  assert.deepEqual(parseJson('결과:\n{"v":{}}\n끝'), { v: {} });
  assert.throws(() => parseJson('없음'));
});
