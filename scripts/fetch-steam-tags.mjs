// scripts/fetch-steam-tags.mjs — 스팀 태그 원본 데이터를 data/tags/에 받아둠 (DB·화면은 건드리지 않음)
// 실행: node scripts/fetch-steam-tags.mjs   (게임 목록은 data/meta/source.json 사용 → 먼저 export-meta.mjs)
// - steam-tags.json: 스팀 전체 태그 목록 (id, 영문, 한국어) — IStoreService/GetTagList
// - game-steam-tags.json: 게임별 스팀 태그와 투표 수 — 상점 페이지의 InitAppTagModal 데이터
//   · 이미 받은 게임은 다시 받지 않음 (중간에 끊겨도 다시 실행하면 이어서 받음). 실패한 게임만 다시 시도
//   · 스팀 앱 번호 없는 게임은 no_appid, 실패한 게임은 failed 목록에
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const OUT_DIR = 'data/tags';
const TAGS_FILE = `${OUT_DIR}/steam-tags.json`;
const GAMES_FILE = `${OUT_DIR}/game-steam-tags.json`;
const REQUEST_GAP_MS = 1500;
const RETRY_WAIT_MS = [30000, 60000, 120000];
// 성인 인증 페이지 건너뛰기
const COOKIE = 'birthtime=0; lastagecheckage=1-0-1990; wants_mature_content=1; mature_content=1';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = () => new Date().toISOString().slice(0, 10);
const save = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2) + '\n');

let lastRequestAt = 0;
async function get(url, asJson) {
  for (let attempt = 0; ; attempt++) {
    const wait = lastRequestAt + REQUEST_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    let status = 0;
    try {
      const res = await fetch(url, { headers: { Cookie: COOKIE }, redirect: 'follow' });
      status = res.status;
      if (res.ok) return { url: res.url, body: asJson ? await res.json() : await res.text() };
    } catch {
      // 네트워크 오류도 다시 시도
    }
    const retryable = status === 0 || status === 429 || status === 403 || status >= 500;
    if (!retryable || attempt >= RETRY_WAIT_MS.length) throw new Error(`응답 ${status || '연결 실패'}`);
    console.log(`   ⏳ 응답 ${status || '연결 실패'} — ${RETRY_WAIT_MS[attempt] / 1000}초 뒤 다시 시도`);
    await sleep(RETRY_WAIT_MS[attempt]);
  }
}

// 1) 전체 태그 목록
const tagList = async (lang) =>
  (await get(`https://api.steampowered.com/IStoreService/GetTagList/v1/?language=${lang}`, true)).body.response.tags;
const [en, ko] = [await tagList('english'), await tagList('koreana')];
const koById = new Map(ko.map((t) => [t.tagid, t.name]));
const tags = en
  .map((t) => ({ id: t.tagid, en: t.name, ko: koById.get(t.tagid) ?? null }))
  .sort((a, b) => a.id - b.id);
const tagById = new Map(tags.map((t) => [t.id, t]));
mkdirSync(OUT_DIR, { recursive: true });
save(TAGS_FILE, {
  fetched_at: today(),
  source: 'IStoreService/GetTagList (english, koreana)',
  categories: null, // 스팀 상위 분류(장르·시각·테마 등)는 공개 API로 제공되지 않음 (스팀웍스 태그 마법사 전용)
  count: tags.length,
  tags,
});
console.log(`✅ 스팀 태그 ${tags.length}개 → ${TAGS_FILE}`);

// 2) 게임별 태그
const source = JSON.parse(readFileSync('data/meta/source.json', 'utf8')).games;
const prev = existsSync(GAMES_FILE) ? JSON.parse(readFileSync(GAMES_FILE, 'utf8')) : null;
const done = new Map((prev?.games || []).map((g) => [g.id, g]));
const failed = [];
const noAppid = source.filter((g) => !g.steam_appid).map((g) => ({ id: g.id, name: g.name }));
const targets = source.filter((g) => g.steam_appid && !done.has(g.id));
console.log(`게임 ${source.length}개 중 앱 번호 없음 ${noAppid.length}개, 이미 받음 ${done.size}개, 이번에 받을 ${targets.length}개`);

const write = () => {
  const games = [...done.values()].sort((a, b) => a.id - b.id);
  save(GAMES_FILE, {
    fetched_at: today(),
    source: 'store.steampowered.com/app/<appid> InitAppTagModal (votes = 태그 투표 수)',
    count: games.length,
    games,
    no_appid: noAppid,
    failed,
  });
};

let n = 0;
for (const g of targets) {
  n++;
  try {
    const { url, body } = await get(`https://store.steampowered.com/app/${g.steam_appid}/?l=english`);
    if (!url.includes(`/app/${g.steam_appid}/`)) throw new Error('상점 페이지 없음 (다른 곳으로 이동됨)');
    const m = body.match(/InitAppTagModal\(\s*\d+,\s*(\[[\s\S]*?\])\s*,/);
    if (!m) throw new Error('태그 데이터 없음');
    const list = JSON.parse(m[1]).map((t) => ({
      id: t.tagid,
      en: tagById.get(t.tagid)?.en ?? t.name,
      ko: tagById.get(t.tagid)?.ko ?? null,
      votes: t.count,
      ...(t.browseable === false ? { browseable: false } : {}),
    }));
    done.set(g.id, { id: g.id, name: g.name, steam_appid: g.steam_appid, tags: list });
    console.log(`[${n}/${targets.length}] ${g.name}: ${list.length}개`);
  } catch (e) {
    failed.push({ id: g.id, name: g.name, steam_appid: g.steam_appid, reason: e.message });
    console.log(`[${n}/${targets.length}] ❌ ${g.name} (${g.steam_appid}): ${e.message}`);
  }
  if (n % 25 === 0) write();
}
write();

const games = [...done.values()];
const totalTags = games.reduce((s, g) => s + g.tags.length, 0);
const used = new Set(games.flatMap((g) => g.tags.map((t) => t.id)));
console.log(`\n✅ 게임 ${games.length}개 → ${GAMES_FILE}`);
console.log(`   게임당 평균 태그 ${(totalTags / (games.length || 1)).toFixed(1)}개, 게임에 쓰인 서로 다른 태그 ${used.size}개`);
console.log(`   앱 번호 없음 ${noAppid.length}개, 실패 ${failed.length}개`);
for (const f of failed) console.log(`   - ${f.name} (${f.steam_appid}): ${f.reason}`);
