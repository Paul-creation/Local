// 담당: 친구(검색·태그·비교)
// 게임 이름 검색 공통 규칙 — 메인 검색 결과, 검색창 자동완성, 비교 만들기 화면이 같이 쓴다
// 소문자로 바꾸고 띄어쓰기·기호(™ ® © : - . 등)를 전부 지운 뒤 포함 여부로 판단
// 영어 이름(name)과 한국어 이름·별명(search_name_ko, 쉼표로 여러 개) 중 하나라도 맞으면 찾은 것으로 본다

type Searchable = { name?: string | null; search_name_ko?: string | null };

export function normalizeSearch(text: string | null | undefined) {
  return String(text || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}

export function searchNames(game: Searchable) {
  return [game.name || '', ...String(game.search_name_ko || '').split(',')].map((n) => n.trim()).filter(Boolean);
}

// 0: 이름이 검색어로 시작, 1: 이름 중간에 포함, -1: 안 맞음 (자동완성 정렬용)
export function matchRank(game: Searchable, query: string) {
  const q = normalizeSearch(query);
  if (!q) return -1;
  let rank = -1;
  for (const n of searchNames(game)) {
    const name = normalizeSearch(n);
    if (name.startsWith(q)) return 0;
    if (name.includes(q)) rank = 1;
  }
  return rank;
}

export function matchesGame(game: Searchable, query: string) {
  return matchRank(game, query) >= 0;
}

// Supabase ilike용 느슨한 패턴: "리썰컴퍼니" → "%리%썰%컴%퍼%니%" (띄어쓰기·기호가 끼어 있어도 걸리게)
// 정확한 판단은 받아온 뒤 matchesGame으로 다시 거른다. 기호를 다 지운 글자라 or() 필터에 그대로 넣어도 안전
export function looseIlikePattern(query: string) {
  const q = normalizeSearch(query);
  return q ? `%${[...q].join('%')}%` : '';
}
