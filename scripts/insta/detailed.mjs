// scripts/insta/detailed.mjs
// --detailed: 기본 게시물(posts/<id>.json의 표지·트레일러·팔로우 카드)에 복사/DB 값으로 만든 슬라이드를 끼워 10장으로 늘린다
//   1 표지 · 2 트레일러 · 3 직접 해봄(copy.review 있을 때만) · 4~7 플레이 스크린샷 4장 · 8 이런 친구랑 하세요 · 9 알아둘 점 · 10 팔로우 카드
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
const range = (g) => (g.min_players === g.max_players ? `${g.max_players}인` : `${g.min_players}~${g.max_players}인`);
const modes = (g) => [g.has_online_coop && '온라인 협동', g.has_local_coop && '로컬 협동', g.has_pvp && '대전'].filter(Boolean);

// 한 줄 소개 자동 문구: 스팀 설명 첫 문장이 40자 이내면 그것, 아니면 DB의 플레이 활동(activities)
function autoTagline(g) {
  const first = (g.fun_description ?? '').split(/(?<=[.다요])\s+/)[0]?.trim();
  if (first && first.length <= 40) return first;
  const acts = (g.activities ?? []).slice(0, 3);
  return acts.length ? acts.join(' · ') : undefined;
}

function autoFriends(g) {
  const out = [];
  const acts = (g.activities ?? []).slice(0, 2);
  if (acts.length) out.push(`${acts.join(' · ')} 취향이 맞는 친구`);
  out.push(`${range(g).replace('인', '명')}이 같이 모일 수 있는 친구들`);
  if (g.has_online_coop && g.has_local_coop) out.push('온라인으로도, 한자리에서도 같이 할 친구');
  else if (g.has_online_coop) out.push('멀리 있어도 온라인으로 같이 할 친구');
  else if (g.has_local_coop) out.push('한자리에 모여서 같이 할 친구');
  return out.slice(0, 3);
}

function autoNotes(g) {
  const korean = !g.korean_support ? undefined : g.korean_support === '없음' ? '없음' : g.korean_support;
  return { people: range(g), mode: modes(g).join(' · ') || undefined, length: undefined, korean };
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
  const used = new Set([cover.bg].filter((b) => typeof b === 'number'));
  const pool = Array.from({ length: total }, (_, i) => i + 1).filter((n) => !used.has(n));
  const next = (explicit) => { const n = pick(explicit); if (n) { const at = pool.indexOf(Number(n)); if (at >= 0) pool.splice(at, 1); return Number(n); } return pool.shift(); };

  const out = [{ ...cover, headline: pick(copy.headline) ?? cover.headline }];
  out.push({ ...data, tagline: pick(copy.tagline) ?? data.tagline ?? autoTagline(game) });

  const rv = copy.review ?? {};
  if (pick(rv.headline) && pick(rv.body)) {
    const index = next(rv.index);
    if (index) out.push({ type: 'review', game: gameKey, index, label: pick(rv.label) ?? '직접 해봤습니다', headline: rv.headline.trim(), body: rv.body.trim() });
    else log('경고: 스크린샷이 없어 "직접 해봄" 슬라이드를 건너뜀');
  } else log('"직접 해봄" 슬라이드 생략 (copy의 review.headline·body가 비어 있음)');

  const minis = [];
  for (let i = 0; i < 4; i++) {
    const c = (copy.shots ?? [])[i] ?? {};
    const index = next(c.index);
    if (!index) break;
    minis.push({ type: 'minigame', game: gameKey, index, heading: pick(c.heading), body: pick(c.body) });
  }
  if (minis.length < 4) log(`경고: 스크린샷이 부족해 플레이 슬라이드 ${minis.length}장만 만들어요 (스팀 스크린샷 ${total}장)`);
  out.push(...minis);

  const friends = [0, 1, 2].map((i) => pick((copy.friends ?? [])[i]));
  const autoF = autoFriends(game);
  const items = friends.map((f, i) => f ?? autoF[i]).filter(Boolean);
  out.push({ type: 'friends', game: gameKey, bg: minis.at(-1)?.index ?? 1, title: pick(copy.friendsTitle) ?? '이런 친구랑 하세요', items });

  const cn = copy.notes ?? {};
  const an = autoNotes(game);
  const val = (k) => pick(cn[k]) ?? an[k];
  const rows = [['인원', val('people')], ['플레이 방식', val('mode')], ['한 판 길이', val('length')], ['한국어 지원', val('korean')]].filter(([, v]) => v);
  const missing = ['인원', '플레이 방식', '한 판 길이', '한국어 지원'].filter((l) => !rows.some(([r]) => r === l));
  if (missing.length) log(`알아둘 점에서 빠진 줄(데이터 없음): ${missing.join(', ')} — copy의 notes로 채울 수 있어요`);
  out.push({ type: 'notes', game: gameKey, title: pick(copy.notesTitle) ?? '알아둘 점', rows });

  out.push(follow);
  log(`자세한 버전: ${gameTitle(game)} → ${out.length}장`);
  return out;
}
