// scripts/lib/streamer-match.mjs
// 스트리머 영상 한 개(제목·설명)를 게임에 연결하는 규칙 — scripts/fetch-streamer-videos.mjs가 쓰고, 테스트에서도 그대로 불러 씀
// 이름 찾기는 app/lib/gameMatch.mjs (영어 이름·한국어 이름·별칭), 여기서는 일반 단어 이름·비교 표현·속편 숫자 같은 오탐을 거름
import { findGameHits, normalize } from '../../app/lib/gameMatch.mjs';
import { GAME_WORDS, isGenericName } from './video-filter.mjs';
import { DESC_HEAD, gameNameKeys } from './coop-targets.mjs';

const norm = (s) => String(s || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');

// 일반 단어 이름 게임: 제목에 게임 단어(이름 부분 빼고) 또는 영문 원제 + 한국어 이름이 같이 있어야 함
function genericOk(game, title) {
  const keys = gameNameKeys(game);
  let rest = norm(title);
  for (const k of keys) rest = rest.split(k).join(' ');
  if (GAME_WORDS.test(rest)) return true;
  const t = norm(title);
  const en = norm(String(game.name || '').replace(/[™®©]/g, ''));
  const ko = keys.filter((k) => /[가-힣]/.test(k));
  return t.includes(en) && ko.some((k) => t.includes(k));
}

// 이름 바로 뒤가 비교·후속작 표현("피코파크 같은", "스타듀밸리 감성", "오공 후속작")이거나
// 따로 떨어진 한 자리 숫자("그레이브야드 키퍼 2", "keeper2는")면 그 게임 영상이 아님
// "빅워크 3원정대"·"롤 1대1"·"문명6 3화"·"세피리아 2026-08-26"·"스테퍼 레트로 #1"은 그대로 연결
const COMPARE_AFTER = /^(?:같은|처럼|감성|느낌|스러운|후속|짝퉁|아류)/;
const SEQUEL_AFTER = /^ ?\d(?=$| |[은는이가을를의도와과로에](?:$| ))/;

// → { hits: 쓸 수 있는 매칭, notIds: 이 글에서 "그 게임이 아니"라고 드러난 게임 }
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
    if (COMPARE_AFTER.test(keyText.slice(end)) || SEQUEL_AFTER.test(spaced.slice(keyToSpaced[end - 1] + 1))) notIds.add(h.id);
    else hits.push({ ...h, where });
  }
  return { hits, notIds };
}

export function matchVideo(v, matchers, gamesById) {
  const title = hitsIn(v.title, 'title', matchers);
  const desc = v.is_short ? { hits: [] } : hitsIn(v.description.slice(0, DESC_HEAD), 'description', matchers);
  // 제목에서 "그 게임이 아니"라고 드러난 게임은 설명(해시태그 등)에서도 연결하지 않음
  const hits = [...title.hits, ...desc.hits.filter((h) => !title.notIds.has(h.id))].filter((h) => {
    const g = gamesById.get(h.id);
    // 1글자 별칭("롤")은 설명에서는 안 씀: 채널 소개 문구("유튜브에는 롤, 메인 영상…")만으로 연결되는 걸 막음
    if (h.len < 2 && h.where !== 'title') return false;
    return !isGenericName(g) || (h.where === 'title' && genericOk(g, v.title));
  });
  if (!hits.length) return null;
  hits.sort((a, b) => b.len - a.len || (a.where === 'title' ? 0 : 1) - (b.where === 'title' ? 0 : 1) || a.start - b.start);
  return hits[0];
}

