// 실행: npm test — 출시 예정·데모 칸 판정, 매일 출시 전환 패치, 일일 요약 줄
import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseFields, comingSoonPatch, comingSoonLine, demoUrl } from './coming-soon.mjs';

const soon = (extra = {}) => ({ release_date: { coming_soon: true, date: '2026년 11월' }, ...extra });

test('출시 예정 + 데모: 상태·데모 번호(문자열)·출시일 원문', () => {
  assert.deepEqual(releaseFields(soon({ demos: [{ appid: 4000111, description: 'Demo' }] })), { release_status: 'coming_soon', demo_appid: '4000111', release_date_text: '2026년 11월' });
});

test('데모가 없거나 출시일 원문이 비면 null', () => {
  assert.deepEqual(releaseFields({ release_date: { coming_soon: true, date: ' ' } }), { release_status: 'coming_soon', demo_appid: null, release_date_text: null });
  assert.equal(releaseFields(soon({ demos: [{ description: 'x' }] })).demo_appid, null);
});

test('출시된 게임이나 정보 없음은 released, 데모·출시일 원문은 안 채움', () => {
  const out = { release_status: 'released', demo_appid: null, release_date_text: null };
  assert.deepEqual(releaseFields({ release_date: { coming_soon: false, date: '2024년 5월 1일' }, demos: [{ appid: 1 }] }), out);
  assert.deepEqual(releaseFields(null), out);
});

test('매일 확인: 출시됐으면 release_status만, 아직이면 바뀐 칸만, 응답에 값이 없다고 비우지 않음', () => {
  const cur = { release_date_text: '출시 예정', demo_appid: null };
  assert.deepEqual(comingSoonPatch(cur, { release_date: { coming_soon: false, date: '2026년 10월 30일' } }), { released: true, patch: { release_status: 'released' } });
  assert.deepEqual(comingSoonPatch(cur, soon({ demos: [{ appid: 7 }] })), { released: false, patch: { release_date_text: '2026년 11월', demo_appid: '7' } });
  assert.deepEqual(comingSoonPatch({ release_date_text: '2026년 11월', demo_appid: '7' }, soon({ demos: [{ appid: 7 }] })), { released: false, patch: null });
  assert.deepEqual(comingSoonPatch({ release_date_text: '2026년 11월', demo_appid: '7' }, { release_date: { coming_soon: true, date: '' } }), { released: false, patch: null });
});

test('일일 요약 줄: 확인한 게임이 없으면 줄을 뺌', () => {
  assert.equal(comingSoonLine(null), '');
  assert.equal(comingSoonLine({ checked: 0, released: 0, failed: 0 }), '');
  assert.equal(comingSoonLine({ checked: 6, released: 1, failed: 0 }), '\n🚀 출시 전환 1개 (출시 예정 6개 확인)');
  assert.match(comingSoonLine({ checked: 6, released: 0, failed: 2 }), /확인 실패 2개/);
});

test('데모 상점 페이지 주소', () => {
  assert.equal(demoUrl('7'), 'https://store.steampowered.com/app/7');
});
