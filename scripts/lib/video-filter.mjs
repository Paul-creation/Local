// scripts/lib/video-filter.mjs
// 유튜브 검색 결과에서 같은 이름의 영화·다른 작품 영상을 걸러내는 공통 규칙 (트레일러 대체·하이라이트·친구랑 플레이)
// - 제외: 제목·채널에 movie, film, 영화가 있으면 뺌 (게임 이름 자체에 든 단어는 빼고 봄. "매드무비"는 해당 없음)
// - 게임 단어 필수: 제목·채널에 게임 이름과 함께 game(s/play)·gaming·steam·게임·스팀 중 하나
//   트레일러 대체 검색은 항상, 하이라이트·친구랑은 이름이 일반 단어인 게임(GENERIC_NAMES)만 적용
//   세 글자 이상 한국어 이름이 제목·채널에 있으면 게임 단어가 없어도 통과
//   (합방·하이라이트 정상 영상은 "레식 5인 합방"처럼 게임 단어가 없는 경우가 대부분이라)

const norm = (s) => String(s || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');

export const GAME_WORDS = /game|gaming|steam|게임|스팀/i;
export const MOVIE_WORDS = /movie|film|영화/gi;

// 이름이 일반 영어 단어라 영화·다른 뜻과 섞이는 게임 (앞의 The 빼고, 소문자·띄어쓰기 없이). 새로 생기면 여기에 추가
export const GENERIC_NAMES = new Set([
  'muck', 'inside', 'prey', 'control', 'limbo', 'portal', 'granny', 'devour', 'geronimo', 'raft', 'rust',
  'steep', 'trove', 'celeste', 'hades', 'doom', 'smite', 'sworn', 'subsistence', 'melatonin', 'viewfinder', 'unpacking',
  'journey', 'outlast', 'stray', 'hollow', 'scorn', 'forest', 'classrooms',
  'ticktockatalefortwo', // 한국어 이름 '틱톡'이 TikTok과 섞임
]);

export function isGenericName(game) {
  const en = String(game.name || '').replace(/[™®©]/g, '').trim().replace(/^the\s+/i, '');
  return GENERIC_NAMES.has(norm(en));
}

// 게임 이름 후보들 (keys: gameNameKeys(game) 결과)
function stripNames(text, keys) {
  let t = norm(text);
  for (const k of keys) t = t.split(k).join(' ');
  return t;
}

// video: { title, channel_title }, keys: 정규화된 게임 이름들
// 반환: 통과면 null, 아니면 빠진 이유
export function videoRejectReason(video, keys, { requireGameWord }) {
  const text = `${video.title || ''} ${video.channel_title || ''}`;
  // 띄어쓰기를 지우면 "of ilm"이 film이 되므로 원문에서 찾고, 게임 이름에 든 단어(The Movies 등)는 봐줌
  const movieHits = String(text).toLowerCase().match(MOVIE_WORDS) || [];
  if (movieHits.some((w) => !keys.some((k) => k.includes(w)))) return '영화 단어';
  if (!requireGameWord) return null;
  const t = norm(text);
  if (!keys.some((k) => t.includes(k))) return '제목·채널에 게임 이름 없음';
  // 세 글자 이상 한국어 이름(러스트·래프트)이 있으면 게임 영상으로 봄. 두 글자(포탈·먹·피크)는 다른 뜻과 섞여서 안 됨
  if (keys.some((k) => /[가-힣]/.test(k) && k.length >= 3 && t.includes(k))) return null;
  if (!GAME_WORDS.test(stripNames(text, keys))) return '게임 단어 없음';
  return null;
}

// ---- 트레일러 대체 검색용 (enrich-videos) — 스팀 공식 영상이 없는 게임에만 쓰는 더 엄격한 규칙 ----
// 하이라이트·합방 검색(videoRejectReason)은 "레식 5인 합방"처럼 트레일러 단서 없는 정상 영상이 많아서 위의 느슨한 규칙을 그대로 씀
// a. 제목에 게임 이름이 있어야 함 (채널에만 있으면 탈락)
// b. 제목에 trailer·트레일러·official·공식·launch·론치·PV·gameplay·announce·cinematic·reveal·teaser·시네마틱·오프닝·티저 중 하나가 있어야 함
// c. review·리뷰·공략·방법·how to·guide·tutorial·후기·playthrough·let's play·speedrun·part N·EP N이 있으면 탈락 (게임 이름 자체에 든 단어는 봐줌)
// d. "세 글자 이상 한국어 이름이면 게임 단어 없이 통과" 예외 없음 ("낚시 방법" 같은 흔한 구절이 낚시 강좌와 섞였음)
export const TRAILER_WORDS = /trailer|트레일러|official|공식|launch|론치|\bpv\b|gameplay|announce|cinematic|reveal|teaser|시네마틱|오프닝|티저/i;
export const NOT_TRAILER_WORDS = /review|리뷰|공략|방법|how to|guide|tutorial|후기|playthrough|let['’]?s play|speedrun|\bpart\s*\d+|\bep\.?\s*\d+/gi;

// 영어 원제 대용: 스팀 외 게임(에픽·배틀넷·라이엇)에는 스토어 주소 이름(games.external_id, 예: "ghostrunner-2")이 저장돼 있음.
// 에픽 주소 끝의 6자리 해시(-51e5e9)는 떼고, 글자가 없거나 짧으면 쓰지 않음. 스팀 게임은 영어 이름 칸이 없어서 빈 배열 (새로 수집하지 않음)
export function englishNameKeys(game) {
  const slug = String(game.external_id || '').toLowerCase().replace(/-(?=[0-9a-f]*\d)[0-9a-f]{6}$/, '');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || !/[a-z]{3}/.test(slug)) return [];
  const key = norm(slug.replace(/-/g, ' '));
  return key.length >= 4 ? [key] : [];
}

// video: { title, channel_title }, keys: gameNameKeys(game) (+ englishNameKeys(game)) — 어느 이름이든 제목에 있으면 됨. 통과면 null, 아니면 빠진 이유
export function trailerRejectReason(video, keys) {
  const movie = videoRejectReason(video, keys, { requireGameWord: false }); // 영화 단어 (제목·채널)
  if (movie) return movie;
  const title = String(video.title || '');
  if (!keys.some((k) => norm(title).includes(k))) return '제목에 게임 이름 없음';
  const deny = (title.toLowerCase().match(NOT_TRAILER_WORDS) || []).find((w) => !keys.some((k) => k.includes(norm(w))));
  if (deny) return `트레일러가 아닌 단어 (${deny.trim()})`;
  if (!TRAILER_WORDS.test(title)) return '트레일러 단서 없음';
  return null;
}
