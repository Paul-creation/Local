// 실행: npm test — 등급표를 고쳤는데 버전을 안 올리면 실패 (저장된 내 PC 사양이 옛 등급으로 남는 것을 막음)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { SPEC_TABLES_VERSION, SPEC_TABLES_FINGERPRINT } from './specTablesVersion.ts';

const read = (f) => JSON.parse(fs.readFileSync(`data/pc-spec/${f}`, 'utf8'));
const fingerprint = (t) => createHash('sha1').update([...t.gpu.entries, ...t.cpu.entries].map((e) => `${e.key}:${e.vendor}:${e.tier}`).sort().join('\n')).digest('hex').slice(0, 12);

test('등급표 지문이 specTablesVersion.ts와 같다 (등급표를 바꿨으면 버전을 올리고 지문을 갱신)', () => {
  const now = fingerprint({ gpu: read('gpu-tiers.json'), cpu: read('cpu-tiers.json') });
  assert.equal(SPEC_TABLES_FINGERPRINT, now, `등급표가 바뀌었어요 → SPEC_TABLES_VERSION(지금 ${SPEC_TABLES_VERSION})을 올리고 SPEC_TABLES_FINGERPRINT를 '${now}'로 바꾸세요`);
});
