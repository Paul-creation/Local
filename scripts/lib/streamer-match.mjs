// scripts/lib/streamer-match.mjs
// 스트리머 영상 한 개(제목·설명)를 게임에 연결하는 규칙 — scripts/fetch-streamer-videos.mjs가 쓰고, 테스트에서도 그대로 불러 씀
// 이름 찾기는 app/lib/gameMatch.mjs (영어 이름·한국어 이름·별칭), 여기서는 일반 단어 이름·비교 표현·속편 숫자 같은 오탐을 거름
import { hitsIn, PLAY_CUE } from '../../app/lib/videoRelevance.mjs';
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

// 짧거나(이름 3글자 이하: 롤·발로·배그·피크·레포) 흔한 단어 이름은 더 엄격하게 봄
const isStrict = (game, h) => h.len <= 3 || isGenericName(game);

// 짧은 이름 게임이 "실제로 그 게임 플레이 영상"이라는 근거: 유튜브 카테고리 게임(20), 태그에 게임 이름, 주제 링크(위키)에 게임 이름, 제목의 플레이 단서
// v.categoryId·v.tags·v.topics(topicCategories 주소)가 전부 없으면(예전 호출) 판단하지 않고 통과
function playEvidence(v, game) {
  if (v.categoryId === undefined && v.tags === undefined && v.topics === undefined) return true;
  if (String(v.categoryId) === '20') return true;
  // 한 글자 별칭(롤)도 태그와 정확히 같으면 인정해야 해서 gameNameKeys(두 글자 미만 제외)를 쓰지 않음
  const keys = [...new Set([game.name, ...String(game.search_name_ko || '').split(',')].map(norm))].filter(Boolean);
  if ((v.tags || []).some((t) => { const n = norm(t); return keys.some((k) => n === k || (k.length >= 4 && n.includes(k))); })) return true;
  const slugs = (v.topics || []).map((u) => { try { return norm(decodeURIComponent(String(u).split('/').pop())); } catch { return ''; } });
  if (slugs.some((sl) => sl && keys.some((k) => k.length >= 4 && (sl === k || sl.startsWith(k))))) return true;
  return PLAY_CUE.test(v.title);
}

// 판단 과정까지 돌려줌 → { hit, dropped: [{ id, where, reason }] } (dropped = 이름은 나왔지만 규칙에 걸려 뺀 것, 목록 점검용)
export function judgeVideo(v, matchers, gamesById) {
  const title = hitsIn(v.title, 'title', matchers);
  const desc = v.is_short ? { hits: [] } : hitsIn((v.description || '').slice(0, DESC_HEAD), 'description', matchers);
  // 제목에서 "그 게임이 아니"라고 드러난 게임은 설명(해시태그 등)에서도 연결하지 않음. 제목에서 사람 소개로만 나온 게임도 마찬가지
  const blocked = new Set([...title.notIds, ...title.hits.filter((h) => h.person).map((h) => h.id)]);
  const dropped = [];
  const hits = [...title.hits, ...desc.hits.filter((h) => !blocked.has(h.id))].filter((h) => {
    const g = gamesById.get(h.id);
    const drop = (reason) => { dropped.push({ id: h.id, where: h.where, reason }); return false; };
    // 1글자 별칭("롤")은 설명에서는 안 씀: 채널 소개 문구("유튜브에는 롤, 메인 영상…")만으로 연결되는 걸 막음
    if (h.len < 2 && h.where !== 'title') return drop('1글자 별칭은 설명에서 안 씀');
    const strict = isStrict(g, h);
    if (h.person === 'core' || (h.person === 'strict' && strict)) return drop('사람 소개·수식어로만 나옴');
    if (isGenericName(g) && !(h.where === 'title' && genericOk(g, v.title))) return drop('일반 단어 이름');
    if (strict && !playEvidence(v, g)) return drop('플레이 근거 없음');
    return true;
  });
  if (!hits.length) return { hit: null, dropped };
  hits.sort((a, b) => b.len - a.len || (a.where === 'title' ? 0 : 1) - (b.where === 'title' ? 0 : 1) || a.start - b.start);
  return { hit: hits[0], dropped };
}

export const matchVideo = (v, matchers, gamesById) => judgeVideo(v, matchers, gamesById).hit;
