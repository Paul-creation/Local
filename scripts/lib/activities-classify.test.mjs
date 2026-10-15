// 실행: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, parseJson } from './activities-classify.mjs';

const HAY = 'Drive trucks across Europe. Build a rail network with "Train" tags (120). Online PvP. Steam Workshop.';
const yes = (basis, quote, strength = 'strong') => ({ basis, strength, quote, note: '' });

test('input+strong은 confirmed, knowledge+strong은 unsure', () => {
  const r = classify({
    v: { drive: 'yes', train: 'yes', cook: 'no', sail: 'unknown' },
    e: { drive: yes('input', 'Drive trucks across Europe'), train: yes('knowledge', '') },
  }, HAY);
  assert.deepEqual(r.confirmed, ['drive']);
  assert.deepEqual(r.unsure, ['train']);
  assert.deepEqual(r.weak, []);
  assert.equal(r.no, 1);
  assert.equal(r.unknown, 36); // 답하지 않은 키 35개 + unknown 1개
});

test('weak는 confirmed·unsure 어디에도 넣지 않고 evidence에만 남긴다', () => {
  const r = classify({
    v: { drive: 'yes', hunt: 'yes' },
    e: { drive: yes('input', 'Drive trucks across Europe', 'weak'), hunt: yes('knowledge', '', 'weak') },
  }, HAY);
  assert.deepEqual(r.confirmed, []);
  assert.deepEqual(r.unsure, []);
  assert.deepEqual(r.weak.sort(), ['drive', 'hunt']);
  assert.equal(r.evidence.drive.strength, 'weak');
  assert.equal(r.evidence.hunt.basis, 'knowledge');
});

test('strength가 없거나 이상하면 weak로 본다', () => {
  const r = classify({ v: { drive: 'yes' }, e: { drive: { basis: 'input', quote: 'Drive trucks across Europe', note: '' } } }, HAY);
  assert.deepEqual(r.weak, ['drive']);
  assert.deepEqual(r.confirmed, []);
});

test('인용이 입력에 없으면 strong이어도 unsure(근거 인용은 지움)', () => {
  const r = classify({ v: { fish: 'yes' }, e: { fish: yes('input', 'catch fish in the lake') } }, HAY);
  assert.deepEqual(r.unsure, ['fish']);
  assert.equal(r.evidence.fish.basis, 'knowledge');
  assert.equal(r.evidence.fish.quote, '');
  assert.equal(r.quoteFail, 1);
});

test('스팀 카테고리 문구만 인용하면 strong이어도 weak', () => {
  const r = classify({
    v: { pvp: 'yes', mod_edit: 'yes' },
    e: { pvp: yes('input', 'Online PvP'), mod_edit: yes('input', 'Steam Workshop') },
  }, HAY, ['Online PvP', 'Steam Workshop']);
  assert.deepEqual(r.weak.sort(), ['mod_edit', 'pvp']);
  assert.equal(r.categoryOnly, 2);
  assert.deepEqual(r.confirmed, []);
});

test('"Includes level editor" 카테고리는 mod_edit 근거로 인정, 다른 키나 Workshop은 weak', () => {
  const hay = 'Includes level editor. Steam Workshop.';
  const cats = ['Includes level editor', 'Steam Workshop'];
  let r = classify({ v: { mod_edit: 'yes' }, e: { mod_edit: yes('input', 'Includes level editor') } }, hay, cats);
  assert.deepEqual(r.confirmed, ['mod_edit']);
  assert.equal(r.categoryOnly, 0);
  r = classify({ v: { mod_edit: 'yes' }, e: { mod_edit: yes('input', 'Steam Workshop') } }, hay, cats);
  assert.deepEqual(r.weak, ['mod_edit']);
  r = classify({ v: { build: 'yes' }, e: { build: yes('input', 'Includes level editor') } }, hay, cats);
  assert.deepEqual(r.weak, ['build']);
});

test('대소문자·따옴표·공백 차이는 같은 인용으로 본다. 짧은 인용·모르는 키는 확정하지 않는다', () => {
  let r = classify({ v: { build: 'yes' }, e: { build: yes('input', 'build a  RAIL network') } }, HAY);
  assert.deepEqual(r.confirmed, ['build']);
  r = classify({ v: { drive: 'yes', nope: 'yes' }, e: { drive: yes('input', 'Dr') } }, HAY);
  assert.deepEqual(r.confirmed, []);
  assert.deepEqual(r.unsure, ['drive']);
});

test('parseJson: 앞뒤 설명이 붙어도 JSON만 읽는다', () => {
  assert.deepEqual(parseJson('결과:\n{"v":{}}\n끝'), { v: {} });
  assert.throws(() => parseJson('없음'));
});
