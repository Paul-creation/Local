import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applyClosing, releaseState, CLOSING } from './closing-template.mjs';

const load = (f) => JSON.parse(fs.readFileSync(new URL(`../insta/copy/${f}.json`, import.meta.url), 'utf8'));

test('trash-island: 출시 예정 템플릿은 원문과 같다(문장·덩어리·설정)', () => {
  const c = load('trash-island'), before = JSON.stringify([c.narration.text, c.chunks]);
  const r = applyClosing(c, { state: 'coming_soon', name: '트래시 아일랜드' });
  assert.equal(JSON.stringify([c.narration.text, c.chunks]), before);
  assert.equal(r.template, 'trash-island');
  assert.equal(c.cardFrom, '이름은');
  assert.deepEqual(c.narration.sentenceSettings['9'], CLOSING.coming_soon.voice);
});

test('crack-trend-v2: 출시작 템플릿은 원문 마지막 두 문장과 같다', () => {
  const c = load('crack-trend-v2');
  applyClosing(c, { state: 'released', name: '크랙' });
  assert.match(c.narration.text, /게임 이름은 크랙입니다\. 근데 진짜, 이 알 안에 뭐가 들었을까요\?$/);
});

test('copy에 다른 마지막 문장이 있어도 템플릿이 우선하고 이름만 바뀐다', () => {
  const c = { narration: { text: '하나예요. 둘이에요. 이름은 원 탱크 트립입니다. 출시 예정, 스팀에서 찜!', sentenceSettings: { 1: { stability: 0.2 }, 3: { stability: 0.9 }, 4: { stability: 0.9 } } }, chunks: ['하나예요', '둘이에요', '이름은', '[원 탱크 트립]입니다', '출시 예정', '[스팀에서 찜]'] };
  applyClosing(c, { state: 'coming_soon', name: '원 탱크 트립' });
  assert.equal(c.narration.text, '하나예요. 둘이에요. 이름은 원 탱크 트립입니다. 저장해두고, 출시 후 플레이해보세요!');
  assert.deepEqual(c.chunks.slice(-5), ['이름은', '[원 탱크 트립]입니다', '저장해두고', '출시 후', '플레이해보세요']);
  assert.deepEqual(c.narration.sentenceSettings['3'], CLOSING.coming_soon.voice);
  assert.deepEqual(c.narration.sentenceSettings['4'], CLOSING.coming_soon.voice);
  assert.equal(c.narration.sentenceSettings['1'].stability, 0.2);
});

test('closing:false·문장 단위가 아닌 copy는 건너뛴다', () => {
  assert.ok(applyClosing({ closing: false, narration: { text: 'a.' } }, { state: 'released', name: 'x' }).skipped);
  assert.ok(applyClosing({ narration: { text: 'a.', perSentence: false } }, { state: 'released', name: 'x' }).skipped);
});

test('출시 상태: games 값 우선, 없으면 appdetails', async () => {
  const env = { NEXT_PUBLIC_SUPABASE_URL: 'http://db', SUPABASE_SERVICE_ROLE_KEY: 'k' };
  const mk = (rows) => async () => ({ ok: true, json: async () => rows });
  assert.deepEqual(await releaseState('1', false, { env, fetchFn: mk([{ release_status: 'coming_soon' }]) }), { state: 'coming_soon', source: 'games' });
  assert.deepEqual(await releaseState('1', true, { env, fetchFn: mk([]) }), { state: 'coming_soon', source: 'steam appdetails' });
  assert.deepEqual(await releaseState('1', false, { env: {}, fetchFn: mk([]) }), { state: 'released', source: 'steam appdetails' });
});
