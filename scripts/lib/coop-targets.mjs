// scripts/lib/coop-targets.mjs
// "친구랑 하는 영상" 대상 게임: max_players 2 이상 중 인기 상위 50개 (heat_rank 순, 없으면 current_players 순)
// fetch-coop-videos, fill-search-names가 같은 기준을 쓰도록 공통으로 둔다
export const COOP_TOP_N = 50;

export async function getCoopTargets(supabase, fields) {
  const { data, error } = await supabase
    .from('games')
    .select(`id, name, heat_rank, current_players, ${fields}`)
    .gte('max_players', 2);
  if (error) throw new Error(`게임 목록을 못 불러옴: ${error.message}`);
  return data
    .filter((g) => g.heat_rank || g.current_players)
    .sort((a, b) => {
      if (a.heat_rank && b.heat_rank) return a.heat_rank - b.heat_rank;
      if (a.heat_rank) return -1;
      if (b.heat_rank) return 1;
      return (b.current_players || 0) - (a.current_players || 0);
    })
    .slice(0, COOP_TOP_N);
}

// 협동(여럿이 같이 하는) 영상인지 — 제목이나 설명 앞부분에 이 단어가 있어야 "친구랑 하는 영상"으로 고른다
// "개같이"(비속어 강조), "같이보기"(트레일러 같이 보기 방송)는 제외. "11명이", "4인", "혜안져스", "(w. 페이커)", "feat." 포함
export const COOP_WORDS = /합방|멀티|(?<!개)같이(?!\s*보)|친구|협동|듀오|스쿼드|트리오|\d+\s*인(?![가-힣])|\d+\s*명(이서|이|에서)|다같이|함께|코옵|co-?op|져스|(^|[\s(\[])w[./]|feat|가족|여럿|크루/i;
export const isCoopVideo = (text) => COOP_WORDS.test(String(text || ''));

// 설명은 앞부분만 본다 (끝에 붙는 채널 공통 문구·해시태그 때문에 엉뚱한 영상이 통과하지 않게)
export const DESC_HEAD = 200;

// app/lib/searchMatch.ts의 normalizeSearch와 같은 기준: 소문자 + 띄어쓰기·기호 제거
const norm = (s) => String(s || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');

// 영상에서 찾을 게임 이름들: 한국어 이름·별명 + 영어 이름 + 영어 이름의 앞부분("ARK: Survival Evolved" → "ARK")
export function gameNameKeys(game) {
  const en = String(game.name || '').replace(/[™®©]/g, '');
  const base = en.split(/\s[–-]\s|:/)[0];
  return [...new Set([...koNames(game.search_name_ko), en, base].map(norm))].filter((k) => k.length >= 2);
}

// 제목 또는 설명 앞부분에 게임 이름이 있는지
export const mentionsGame = (text, game) => {
  const t = norm(text);
  return gameNameKeys(game).some((k) => t.includes(k));
};

// "친구랑 하는 영상"으로 고를지: 게임 이름 + 협동 단어 둘 다 (제목 또는 설명 앞부분에서)
export function isCoopVideoFor(video, game) {
  const text = `${video.title || ''}\n${String(video.description || '').slice(0, DESC_HEAD)}`;
  return mentionsGame(text, game) && isCoopVideo(text);
}

// search_name_ko는 쉼표로 여러 이름을 넣을 수 있음 (예: "파스모포비아, 파즈모포비아")
export const koNames = (value) => String(value || '').split(',').map((s) => s.replace(/[™®©]/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
