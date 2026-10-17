import test from 'node:test';
import assert from 'node:assert/strict';
import { splitSearchInput } from './searchSplit.ts';

const deps = {
  normalize: (t) => String(t || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, ''),
  isGameName: (k) => k === 'partyanimals',
  activityOf: (k) => ({ 운전: 'drive', 낚시: 'fish', 기차운행: 'train' })[k],
  // 협동만 태그 단어, 운전은 활동과 같은 뜻이라 parse가 태그로 보지 않음
  parse: (text) => {
    const words = text.split(/[\s,]+/).filter(Boolean);
    return { tags: words.filter((w) => w === '협동'), rest: words.filter((w) => w !== '협동').join(' ') };
  },
};

test('활동 라벨과 정확히 같을 때만 활동 칩으로', () => {
  assert.deepEqual(splitSearchInput('운전', deps), { tags: [], acts: ['drive'], rest: '' });
  assert.deepEqual(splitSearchInput('  낚시 ', deps), { tags: [], acts: ['fish'], rest: '' });
  assert.deepEqual(splitSearchInput('기차 운행', deps), { tags: [], acts: ['train'], rest: '' });
});

test('다른 말이 섞이면 활동으로 바꾸지 않고 이름 검색(태그 단어만 태그)', () => {
  assert.deepEqual(splitSearchInput('운전 협동', deps), { tags: ['협동'], acts: [], rest: '운전' });
  assert.deepEqual(splitSearchInput('운전사', deps), { tags: [], acts: [], rest: '운전사' });
  assert.deepEqual(splitSearchInput('엘든링', deps), { tags: [], acts: [], rest: '엘든링' });
});

test('빈 입력·게임 이름과 똑같은 입력은 나누지 않는다', () => {
  assert.deepEqual(splitSearchInput('   ', deps), { tags: [], acts: [], rest: '' });
  assert.deepEqual(splitSearchInput('Party Animals', deps), { tags: [], acts: [], rest: 'Party Animals' });
});
