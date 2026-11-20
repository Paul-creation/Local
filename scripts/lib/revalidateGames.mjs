// scripts/lib/revalidateGames.mjs
// 값이 실제로 바뀐 게임의 상세 페이지(/games/[id], revalidate 7일)만 골라서 새로 만들게 하는 도우미 (Vercel ISR 쓰기 절약)
// - 갱신 스크립트는 바뀐 게임 id를 recordChangedGames로 파일에 모아 두고, run-steps가 마지막에 flushChangedGames를 한 번 부른다
// - 바뀐 게 없으면 호출하지 않는다. 로그에는 개수만 찍고 키는 출력하지 않는다
import fs from 'node:fs';
import path from 'node:path';

export const CHANGED_FILE = path.join('scripts', '.cache', 'changed-game-ids.json');
export const MAX_IDS_PER_CALL = 500; // /api/admin/revalidate의 한 번 최대 개수
export const WARM_TOP_N = 200; // 갱신 뒤 미리 만들어 둘 상세 페이지 수 (비운 게임 중 인기 순위 상위) — 조절은 이 값만
export const WARM_CONCURRENCY = 5; // 동시에 요청하는 수
export const WARM_GAP_MS = 200; // 각 작업자가 요청 사이에 쉬는 시간

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
  return { ids: ids.length, calls, failed, idList: ids };
}

// 방금 비운 게임 중 인기 순위(games.heat_rank) 상위 WARM_TOP_N개의 상세 페이지를 한 번씩 GET해서 미리 만든다 (첫 방문자가 느린 첫 로딩을 겪지 않게)
// 실패는 로그만 남기고 계속한다. rankedIds는 인기 순위순 id 목록 (없으면 아무것도 안 함)
export async function warmGamePages({ ids, rankedIds, env = process.env, fetchImpl = fetch, log = console.log, topN = WARM_TOP_N, concurrency = WARM_CONCURRENCY, gapMs = WARM_GAP_MS, now = Date.now } = {}) {
  const changed = new Set(ids || []);
  const targets = (rankedIds || []).filter((id) => changed.has(id)).slice(0, topN);
  if (!targets.length) { log('🔥 예열 대상 없음'); return { warmed: 0, failed: 0, sec: 0 }; }
  const site = (env.NEXT_PUBLIC_SITE_URL || 'https://select-screen.com').replace(/\/$/, '');
  const started = now();
  let next = 0, warmed = 0, failed = 0;
  const worker = async () => {
    while (next < targets.length) {
      const id = targets[next++];
      try {
        const res = await fetchImpl(`${site}/games/${id}`);
        await res.arrayBuffer?.();
        if (res.ok) warmed++; else { failed++; log(`⚠️ 예열 실패 (${res.status}) ${id}`); }
      } catch (e) { failed++; log(`⚠️ 예열 실패 (${e.message}) ${id}`); }
      if (gapMs > 0 && next < targets.length) await new Promise((r) => setTimeout(r, gapMs));
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));
  const sec = Math.round((now() - started) / 1000);
  log(`🔥 상세 페이지 예열 ${warmed}개${failed ? `, 실패 ${failed}개` : ''} (${sec}초)`);
  return { warmed, failed, sec };
}

// 큐레이터 게시물을 추가한 뒤 그 큐레이터 페이지(/c/<handle>)·메인·연결된 게임 상세를 바로 새로 만들게 한다. 키가 없거나 실패해도 던지지 않음(하루 안에 저절로 갱신됨)
export async function revalidateCurators({ handles, gameIds = [], env = process.env, fetchImpl = fetch, log = console.log } = {}) {
  const hs = [...new Set((handles || []).filter(Boolean))];
  if (!hs.length) return { ok: false, skipped: 'none' };
  const key = env.ADMIN_REVALIDATE_KEY;
  if (!key) { log('ℹ️  ADMIN_REVALIDATE_KEY 없음 — 큐레이터 페이지 갱신 생략 (하루 안에 저절로 갱신됨)'); return { ok: false, skipped: 'no-key' }; }
  const site = (env.NEXT_PUBLIC_SITE_URL || 'https://select-screen.com').replace(/\/$/, '');
  const ids = [...new Set(gameIds.filter(Boolean))].slice(0, MAX_IDS_PER_CALL);
  try {
    const res = await fetchImpl(`${site}/api/admin/revalidate`, {
      method: 'POST',
      headers: { 'x-admin-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ curators: hs.slice(0, 20), ...(ids.length ? { ids } : {}) }),
    });
    log(res.ok ? `♻️  큐레이터 페이지 갱신 요청 ${hs.length}개 (+게임 상세 ${ids.length}개)` : `⚠️ 큐레이터 페이지 갱신 실패 (${res.status})`);
    return { ok: res.ok };
  } catch (e) {
    log(`⚠️ 큐레이터 페이지 갱신 실패 (${e.message})`);
    return { ok: false };
  }
}
