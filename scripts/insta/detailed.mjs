// scripts/insta/detailed.mjs
// --detailed: 기본 게시물(posts/<id>.json의 표지·트레일러·팔로우 카드)에 복사/DB 값으로 만든 슬라이드를 끼워 10장으로 늘린다
//   1 표지 · 2 트레일러 · 3 개요(copy.overview 있을 때만) · 4~7 플레이 스크린샷 4장 · 8 팔로우 카드
// 문구는 scripts/insta/copy/<id>.json 값이 우선이고, 비어 있으면 DB 값으로 만든 문구를 쓴다 (빈 문자열·null은 "없음")
import fs from 'fs';
import path from 'path';
import { resolveGame, gameTitle } from './pick.mjs';

export function loadCopy(dir, postId) {
  const file = path.join(dir, 'copy', `${postId}.json`);
  if (!fs.existsSync(file)) return {};
  const raw = fs.readFileSync(file, 'utf8');
  if (raw.includes('재밌드나')) throw new Error('화면에는 "재밌드나"를 쓰지 않아요. JamiDuNow만 쓰세요.');
  return JSON.parse(raw);
}

const pick = (v) => (typeof v === 'string' ? v.trim() || undefined : v ?? undefined);
// 한 줄 소개 자동 문구: 스팀 설명 첫 문장이 40자 이내면 그것, 아니면 DB의 플레이 활동(activities)
function autoTagline(g) {
  const first = (g.fun_description ?? '').split(/(?<=[.다요])\s+/)[0]?.trim();
  if (first && first.length <= 40) return first;
  const acts = (g.activities ?? []).slice(0, 3);
  return acts.length ? acts.join(' · ') : undefined;
}

export async function expandDetailed(base, copy, log = console.log) {
  const gameKey = base.find((s) => s.game)?.game;
  if (!gameKey) throw new Error('--detailed: posts json에 game이 있는 슬라이드가 필요해요');
  const game = await resolveGame(gameKey);
  const cover = base.find((s) => s.type === 'poster-cover');
  if (!cover) throw new Error('--detailed: posts json에 poster-cover(표지) 슬라이드가 필요해요');
  const data = base.find((s) => s.type === 'game-data') ?? { type: 'game-data', game: gameKey, index: 1, video: true };
  const follow = base.find((s) => s.type === 'follow-card') ?? { type: 'follow-card', game: gameKey, title: '친구랑 할 게임, 고민되면' };
  const total = (game.screenshots ?? []).length;
  const coverImage = pick(copy.coverImage); // 스크린샷 번호 또는 이미지 경로·주소. 없으면 스팀 키아트(library_hero → header)
  const used = new Set([coverImage].filter((b) => typeof b === 'number'));
  const pool = Array.from({ length: total }, (_, i) => i + 1).filter((n) => !used.has(n));
  const next = (explicit) => { const n = pick(explicit); if (n) { const at = pool.indexOf(Number(n)); if (at >= 0) pool.splice(at, 1); return Number(n); } return pool.shift(); };

  const out = [{ ...cover, bg: coverImage ?? 'keyart', headline: pick(copy.headline) ?? cover.headline }];
  out.push({ ...data, tagline: pick(copy.tagline) ?? data.tagline ?? autoTagline(game) });

  // overview는 객체({index,headline,body}) 또는 문자열(첫 줄 = 헤드라인, 나머지 줄 = 본문)
  const ov = typeof copy.overview === 'string'
    ? (([head, ...rest]) => ({ headline: head, body: rest.join('\n') }))(copy.overview.trim().split('\n'))
    : copy.overview ?? {};
  if (pick(ov.headline) && pick(ov.body)) {
    const index = next(copy.overviewIndex ?? ov.index); // 문자열 형식일 땐 copy.overviewIndex로 스크린샷 지정
    if (index) out.push({ type: 'overview', game: gameKey, index, headline: ov.headline.trim(), body: ov.body.trim() });
    else log('경고: 스크린샷이 없어 개요 슬라이드를 건너뜀');
  } else log('개요 슬라이드 생략 (copy의 overview가 비어 있음)');

  const minis = [];
  for (let i = 0; i < 4; i++) {
    const c = (copy.shots ?? [])[i] ?? {};
    const index = next(c.index);
    if (!index) break;
    minis.push({ type: 'minigame', game: gameKey, index, heading: pick(c.heading), body: pick(c.body) });
  }
  if (minis.length < 4) log(`경고: 스크린샷이 부족해 플레이 슬라이드 ${minis.length}장만 만들어요 (스팀 스크린샷 ${total}장)`);
  out.push(...minis);

  out.push(follow);
  log(`자세한 버전: ${gameTitle(game)} → ${out.length}장`);
  return out;
}
