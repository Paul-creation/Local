// 영상 제목에서 게임 이름이 "그 게임 이야기"로 나왔는지 보는 규칙 — 영상 연결(scripts/lib/streamer-match.mjs)과 상세 대표 영상 고르기(app/games/[id]/page.tsx)가 같이 씀
// - 이름 바로 뒤가 비교·후속작 표현("피코파크 같은", "오공 후속작")이거나 따로 떨어진 한 자리 숫자(속편)면 그 게임 영상이 아님
// - 이름 바로 뒤가 사람 소개·수식어("롤 챌린저", "발로란트 프로 출신")면 그 게임 영상이 아님 (게스트 소개에 게임 이름이 든 영상)
//   person = 'core'(어떤 이름이든 제외) | 'strict'(짧거나 흔한 이름일 때만 제외: "롤 프로", "롤 유저")
// - 연결과 대표 영상 고르기가 같은 규칙을 쓰도록 한 곳에 둠
import { findGameHits, normalize } from './gameMatch.mjs';

const BOUNDARY = '(?=$| |[은는이가을를의도와과로에](?:$| ))';
const PERSON_CORE = '챌린저|그랜드마스터|그마|프로게이머|출신|선수|감독|코치|랭커|국가대표';
const PERSON_STRICT = '고인물|프로|유저|장인|덕후|마스터|해설|캐스터|스트리머|bj|전직';
const PERSON_CORE_RE = new RegExp(`^ ?(?:${PERSON_CORE})${BOUNDARY}`, 'u');
const PERSON_STRICT_RE = new RegExp(`^ ?(?:${PERSON_STRICT})${BOUNDARY}`, 'u');

export const COMPARE_AFTER = /^(?:같은|처럼|감성|느낌|스러운|후속|짝퉁|아류)/;
export const SEQUEL_AFTER = /^ ?\d(?=$| |[은는이가을를의도와과로에](?:$| ))/;

// 제목에 이게 있으면 그 게임을 직접 하는 영상일 가능성이 높음 (대표 영상 점수, 짧은 이름의 플레이 근거)
export const PLAY_CUE = /플레이|play|랭크|솔랭|듀오|내전|합방|실황|스크림|배치|승급|협동|멀티|멀티플레이/i;

// rest: 이름 바로 뒤 글(정규화·띄어쓴 꼴)
export function personAfter(rest) {
  if (PERSON_CORE_RE.test(rest)) return 'core';
  if (PERSON_STRICT_RE.test(rest)) return 'strict';
  return null;
}

// → { hits: 쓸 수 있는 매칭(person 표시 포함), notIds: 이 글에서 "그 게임이 아니"라고 드러난 게임 }
export function hitsIn(raw, where, matchers) {
  const text = raw.replace(/#(?=\s?\d)/g, 'ep '); // "#1"은 회차 번호 → 속편 숫자로 안 봄
  const spaced = normalize(text);
  const keyText = spaced.replace(/ /g, '');
  const keyToSpaced = [];
  for (let i = 0; i < spaced.length; i++) if (spaced[i] !== ' ') keyToSpaced.push(i);
  const hits = [];
  const notIds = new Set();
  for (const h of findGameHits(text, matchers)) {
    const end = h.start + h.len;
    const rest = spaced.slice(keyToSpaced[end - 1] + 1);
    if (COMPARE_AFTER.test(keyText.slice(end)) || SEQUEL_AFTER.test(rest)) { notIds.add(h.id); continue; }
    const person = personAfter(rest);
    hits.push({ ...h, where, ...(person ? { person } : {}) });
  }
  return { hits, notIds };
}

// 대표 영상 점수 (게임 하나의 matchers로): 제목에 그 게임 이름이 사람 소개 아닌 모습으로 있으면 2, 플레이 단서가 있으면 +1
export function titleScore(title, matchers) {
  const { hits } = hitsIn(title, 'title', matchers);
  if (!hits.some((h) => !h.person)) return 0;
  return 2 + (PLAY_CUE.test(title) ? 1 : 0);
}
