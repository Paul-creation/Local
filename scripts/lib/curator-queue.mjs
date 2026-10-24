// scripts/lib/curator-queue.mjs
// 큐레이터 게임 추가 대기열(curator_game_queue) 처리용 순수 함수 + 일일 요약용 작은 파일
// import-curator-queue(데일리 단계)와 daily-summary가 같이 쓴다
import fs from 'fs';

const FILE = 'scripts/.cache/curator-queue.json';
export const RETRY_DAYS = 14; // 이 기간이 지나도록 못 가져온 appid는 더 시도하지 않음 (스팀 기준 미달·판매 중단 등)
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());

// 이번에 처리할 대기열 행: 아직 안 가져왔고(imported_at 없음) 너무 오래되지 않은 것
export function pendingRows(rows, now = Date.now()) {
  const limit = now - RETRY_DAYS * 24 * 60 * 60 * 1000;
  return rows.filter((r) => !r.imported_at && new Date(r.created_at).getTime() >= limit);
}

// 대기열 행 + appid → game_id 표 → 넣을 curator_posts 행과 가져온 행 id
// - 게임이 아직 DB에 없는 행은 left(남김). 같은 (계정, 게임, 게시물)은 한 번만
// - post_type·post_title·posted_at은 대기열에 넣을 때 저장해 둔 값 (예전 행처럼 비어 있으면 단일·제목 없음·만든 날)
export function buildLinks(rows, gameIdByAppid) {
  const posts = [];
  const doneIds = [];
  const left = [];
  const seen = new Set();
  for (const r of rows) {
    const game_id = gameIdByAppid.get(String(r.appid));
    if (!game_id) { left.push(r); continue; }
    doneIds.push(r.id);
    const key = `${r.curator_id}|${game_id}|${r.post_url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    posts.push({
      curator_id: r.curator_id,
      game_id,
      post_url: r.post_url,
      post_type: r.post_type === 'collection' ? 'collection' : 'single',
      post_title: r.post_title || null,
      posted_at: r.posted_at || r.created_at,
    });
  }
  return { posts, doneIds, left };
}

// 일일 요약용 (오늘 기록만 유효)
export function readQueueResult() {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return data.date === today() ? data : null;
  } catch {
    return null;
  }
}

export function recordQueueResult({ added, linked, left }) {
  try {
    fs.mkdirSync('scripts/.cache', { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify({ added, linked, left, date: today() }));
  } catch (e) {
    console.log(`큐레이터 대기열 결과 파일 저장 실패 (${e.message}) — 일일 요약에서 빠짐`);
  }
}

// 일일 요약 한 줄 (대기열이 비어 있던 날은 줄 자체를 뺌)
export function queueLine(r) {
  if (!r || (!r.added && !r.linked && !r.left)) return '';
  return `\n📸 큐레이터 게임 추가 ${r.added}개 (게시물 연결 ${r.linked}개${r.left ? ` · 가져오지 못해 대기 중 ${r.left}개` : ''})`;
}
