// scripts/insta/roundup.mjs
// --roundup: 여러 게임 모음. posts/<id>.json의 roundup-cover·follow-card 사이에 copy/<id>.json의 games 순서대로 게임 장을 끼운다
//   1 표지(첫 게임 스크린샷) · 게임마다 2장(소개 장 + 데이터 상세 장) · 마지막 팔로우 카드. 인스타 한도 20장을 넘으면 에러
import { loadCopy } from './detailed.mjs';

export function expandRoundup(base, copy) {
  const games = copy.games ?? [];
  if (!games.length) throw new Error('--roundup: copy/<id>.json의 games가 비어 있어요');
  const cover = base.find((s) => s.type === 'roundup-cover');
  if (!cover) throw new Error('--roundup: posts json에 roundup-cover 슬라이드가 필요해요');
  const follow = base.find((s) => s.type === 'follow-card') ?? { type: 'follow-card', title: '친구랑 할 게임, 고민되면' };
  const fill = (v) => String(v).replace('{N}', games.length);
  const out = [
    { ...cover, game: games[0].appid, shot: copy.coverShot ?? 1, title1: fill(cover.title1), title2: fill(cover.title2) },
    ...games.flatMap((g) => {
      const shots = g.shots ?? [1, 2];
      return [{ type: 'roundup-game', game: g.appid, desc: g.desc, shots }, { type: 'roundup-detail', game: g.appid, oneliner: g.oneliner, shots, detailShot: g.detailShot }];
    }),
    { ...follow, game: follow.game ?? games[0].appid },
  ];
  if (out.length > 20) throw new Error(`--roundup: ${out.length}장이라 인스타 한도(20장)를 넘어요 — 게임을 ${Math.floor((20 - 2) / 2)}개 이하로 줄이세요`);
  return out;
}
export { loadCopy };

// 상세 장 행: DB에 있는 값만 (없으면 행을 만들지 않고 missing에 이름을 남긴다). price는 스팀 KR 가격 {price, discount}, lowest는 가격 기록 안의 최저가
export function detailRows(game, { oneliner, price, discount, lowest }) {
  const rows = [], missing = [];
  const add = (label, value, extra = {}) => (value ? rows.push({ label, value, ...extra }) : missing.push(label));
  const solo = game.solo_playable === true ? '혼자도 가능' : game.solo_playable === false ? '혼자는 어려움' : null;
  add('인원', game.max_players ? [`최대 ${game.max_players}인`, solo].filter(Boolean).join(' · ') : null);
  const text = `${game.fun_description ?? ''} ${(game.tags ?? []).join(' ')}`;
  const modes = [/비대칭/.test(text) ? '비대칭 대전' : game.has_pvp && '대전', game.has_online_coop && '온라인 협동', game.has_local_coop && '로컬 협동'].filter(Boolean);
  add('플레이 방식', modes.join(' · '));
  add('난이도', game.difficulty);
  const acts = (game.activities ?? []).slice(0, 4);
  add('이런 걸 해요', acts.length ? 'chips' : null, { chips: acts });
  const man = (n) => (n >= 10000 ? `${(Math.floor(n / 1000) / 10).toFixed(1).replace(/\.0$/, '')}만` : n.toLocaleString('ko-KR'));
  add('스팀 평가', game.review_summary && game.review_total ? `${game.review_summary} · 리뷰 ${man(game.review_total)} 개` : null);
  add('가격', price ? `${Math.round(price).toLocaleString('ko-KR')}원${discount ? ` (-${discount}%)` : ''}` : null, { badge: price && lowest != null && price <= lowest ? '기록상 최저가' : null });
  add('한 줄 평', oneliner ? `"${oneliner}"` : (game.fun_description ?? '').split(/(?<=[.다요])\s+/)[0]?.trim());
  return { rows, missing };
}
