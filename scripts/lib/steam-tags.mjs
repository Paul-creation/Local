// scripts/lib/steam-tags.mjs
// 게임별 스팀 태그(투표 수 포함) 받기 + data/tags/game-tags.json과 같은 규칙으로 태그 나무에 연결
// - 받기: fetch-steam-tags.mjs와 같은 방식 (상점 페이지 InitAppTagModal, 한국 상점 cc=kr, 요청 간격 1.5초, 막히면 기다렸다 재시도)
// - 변환 규칙 (game-tags.json의 rule):
//   제외 태그(excluded.json) 빼고, 합친 태그(merged.json)는 같은 칸으로 모은 뒤(투표 수는 큰 쪽),
//   투표 10표 이상이면서 그 게임 1위 태그(제외 전 원본 기준) 투표의 20% 이상, 투표 많은 순 최대 15개
//   → 기존 636개 게임으로 다시 만들어 game-tags.json과 같은지 확인함 (1위는 제외 태그를 빼기 전 기준이어야 일치)
import { readFileSync } from 'node:fs';

const REQUEST_GAP_MS = 1500;
const RETRY_WAIT_MS = [30000, 60000, 120000];
// 성인 인증 페이지 건너뛰기
const COOKIE = 'birthtime=0; lastagecheckage=1-0-1990; wants_mature_content=1; mature_content=1';
export const MIN_VOTES = 10;
export const MIN_RATIO = 0.2;
export const MAX_TAGS = 15;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

// 다시 시도해도 소용없는 실패 (상점 페이지 없음·태그 없음) — 처리 완료로 표시해도 되는 경우
export class SteamTagsMissing extends Error {}

let lastRequestAt = 0;
async function get(url, asJson) {
  for (let attempt = 0; ; attempt++) {
    const wait = lastRequestAt + REQUEST_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    let status = 0;
    try {
      const res = await fetch(url, { headers: { Cookie: COOKIE }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
      status = res.status;
      if (res.ok) return { url: res.url, body: asJson ? await res.json() : await res.text() };
    } catch {
      // 네트워크 오류도 다시 시도
    }
    const retryable = status === 0 || status === 429 || status === 403 || status >= 500;
    if (!retryable) throw new SteamTagsMissing(`응답 ${status}`);
    if (attempt >= RETRY_WAIT_MS.length) throw new Error(`응답 ${status || '연결 실패'}`);
    console.log(`   ⏳ 응답 ${status || '연결 실패'} — ${RETRY_WAIT_MS[attempt] / 1000}초 뒤 다시 시도`);
    await sleep(RETRY_WAIT_MS[attempt]);
  }
}

// 게임 하나의 스팀 태그 [{ id, en, votes }] (투표 많은 순, 스팀이 주는 순서 그대로)
export async function fetchSteamTags(appid) {
  const { url, body } = await get(`https://store.steampowered.com/app/${appid}/?l=english&cc=kr`);
  if (!url.includes(`/app/${appid}/`)) throw new SteamTagsMissing('상점 페이지 없음 (다른 곳으로 이동됨)');
  const m = body.match(/InitAppTagModal\(\s*\d+,\s*(\[[\s\S]*?\])\s*,/);
  if (!m) throw new SteamTagsMissing('태그 데이터 없음');
  return JSON.parse(m[1]).map((t) => ({ id: t.tagid, en: t.name, votes: t.count }));
}

// 스팀 태그 한국어 이름 (분류 안 된 새 태그 기록용) — 한 번만 받아 둠
let koNames = null;
export async function steamTagKoNames() {
  if (!koNames) {
    const { body } = await get('https://api.steampowered.com/IStoreService/GetTagList/v1/?language=koreana', true);
    koNames = new Map(body.response.tags.map((t) => [t.tagid, t.name]));
  }
  return koNames;
}

// 변환 규칙 파일 읽기
export function loadTagRules() {
  return {
    excluded: new Set(readJson('data/tags/excluded.json').tags.map((t) => t.id)),
    merged: new Map(readJson('data/tags/merged.json').merges.map((m) => [m.from.id, m.into.id])),
    tree: new Map(readJson('data/tags/tree.json').nodes.filter((n) => n.steam_tag_id).map((n) => [n.steam_tag_id, n])),
  };
}

// 스팀 태그 → { tags: [{ tag_id, votes, rank }], unknown: [{ id, en, votes }] }
// unknown: 기준(투표 수)은 넘었지만 tree.json에 없는 새 태그 — 저장하지 않고 기록만
export function toGameTags(steamTags, { excluded, merged, tree }) {
  const top = Math.max(0, ...steamTags.map((t) => t.votes));
  const best = new Map(); // tag id → { votes, en }
  for (const t of steamTags) {
    if (excluded.has(t.id)) continue;
    const id = merged.get(t.id) ?? t.id;
    if (!best.has(id) || best.get(id).votes < t.votes) best.set(id, { votes: t.votes, en: t.en });
  }
  const passed = [...best]
    .map(([id, v]) => ({ id, ...v }))
    .filter((t) => t.votes >= MIN_VOTES && t.votes >= top * MIN_RATIO);
  const tags = passed
    .filter((t) => tree.has(t.id))
    .sort((a, b) => b.votes - a.votes)
    .slice(0, MAX_TAGS)
    .map((t, i) => ({ tag_id: t.id, votes: t.votes, rank: i + 1 }));
  const unknown = passed.filter((t) => !tree.has(t.id));
  return { tags, unknown };
}
