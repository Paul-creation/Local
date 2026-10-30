// scripts/insta/roundup.mjs
// --roundup: 여러 게임 모음. posts/<id>.json의 roundup-cover·follow-card 사이에 copy/<id>.json의 games 순서대로 게임 장을 끼운다
//   1 표지(첫 게임 스크린샷) · 2~N+1 게임 장(위아래 스크린샷 2장 + 이름·정보 줄·설명) · 마지막 팔로우 카드
import { loadCopy } from './detailed.mjs';

export function expandRoundup(base, copy) {
  const games = copy.games ?? [];
  if (!games.length) throw new Error('--roundup: copy/<id>.json의 games가 비어 있어요');
  const cover = base.find((s) => s.type === 'roundup-cover');
  if (!cover) throw new Error('--roundup: posts json에 roundup-cover 슬라이드가 필요해요');
  const follow = base.find((s) => s.type === 'follow-card') ?? { type: 'follow-card', title: '친구랑 할 게임, 고민되면' };
  const fill = (v) => String(v).replace('{N}', games.length);
  return [
    { ...cover, game: games[0].appid, shot: copy.coverShot ?? 1, title1: fill(cover.title1), title2: fill(cover.title2) },
    ...games.map((g) => ({ type: 'roundup-game', game: g.appid, desc: g.desc, shots: g.shots ?? [1, 2] })),
    { ...follow, game: follow.game ?? games[0].appid },
  ];
}
export { loadCopy };
