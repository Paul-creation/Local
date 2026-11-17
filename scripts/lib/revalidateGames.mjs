// scripts/lib/revalidateGames.mjs
// 값이 실제로 바뀐 게임의 상세 페이지(/games/[id], revalidate 7일)만 골라서 새로 만들게 하는 도우미 (Vercel ISR 쓰기 절약)
// - 갱신 스크립트는 바뀐 게임 id를 recordChangedGames로 파일에 모아 두고, run-steps가 마지막에 flushChangedGames를 한 번 부른다
// - 바뀐 게 없으면 호출하지 않는다. 로그에는 개수만 찍고 키는 출력하지 않는다
import fs from 'node:fs';
import path from 'node:path';

export const CHANGED_FILE = path.join('scripts', '.cache', 'changed-game-ids.json');
export const MAX_IDS_PER_CALL = 500; // /api/admin/revalidate의 한 번 최대 개수

function readIds(file) {
  try {
    const v = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
}

// 바뀐 게임 id를 파일에 더한다 (중복은 합침). 반영 모드가 아닐 때(미리보기)는 부르지 않는다
export function recordChangedGames(ids, file = CHANGED_FILE) {
  const add = [...new Set([...(ids || [])].filter(Boolean))];
  if (!add.length) return 0;
  const all = new Set(readIds(file));
  for (const id of add) all.add(id);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify([...all]));
  return add.length;
}

// 모아 둔 id를 500개씩 나눠 /api/admin/revalidate로 보내고 파일을 지운다. 반환: { ids, calls, skipped }
export async function flushChangedGames({ file = CHANGED_FILE, env = process.env, fetchImpl = fetch, log = console.log } = {}) {
  const ids = [...new Set(readIds(file))];
  if (!ids.length) { log('♻️  상세 페이지 갱신 대상 없음 — 호출 안 함'); return { ids: 0, calls: 0, skipped: 'none' }; }
  const key = env.ADMIN_REVALIDATE_KEY;
  if (!key) { log(`ℹ️  ADMIN_REVALIDATE_KEY 없음 — 상세 페이지 ${ids.length}개 갱신 생략 (7일 안에 저절로 갱신됨)`); return { ids: ids.length, calls: 0, skipped: 'no-key' }; }
  const site = (env.NEXT_PUBLIC_SITE_URL || 'https://select-screen.com').replace(/\/$/, '');
  let calls = 0, failed = 0;
  for (let i = 0; i < ids.length; i += MAX_IDS_PER_CALL) {
    const chunk = ids.slice(i, i + MAX_IDS_PER_CALL);
    try {
      const res = await fetchImpl(`${site}/api/admin/revalidate`, {
        method: 'POST',
        headers: { 'x-admin-key': key, 'content-type': 'application/json' },
        body: JSON.stringify({ ids: chunk }),
      });
      if (res.ok) calls++; else { failed += chunk.length; log(`⚠️ 상세 페이지 갱신 실패 (${res.status}) — ${chunk.length}개`); }
    } catch (e) { failed += chunk.length; log(`⚠️ 상세 페이지 갱신 실패 (${e.message}) — ${chunk.length}개`); }
  }
  if (!failed) { try { fs.unlinkSync(file); } catch { /* 이미 없음 */ } }
  log(`♻️  상세 페이지 갱신 요청 ${ids.length - failed}개 (호출 ${calls}번${failed ? `, 실패 ${failed}개` : ''})`);
  return { ids: ids.length, calls, failed };
}
