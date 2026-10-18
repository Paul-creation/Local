// 화면에 보이는 게임 이름 — display_name(스팀명이 "영문 + 한글 음역"으로 겹친 게임에 손으로 넣은 표시명)이 있으면 그것, 없으면 스팀 이름(name)
// 검색·AI 프롬프트·외부 검색 링크처럼 "이름으로 찾는" 곳은 name을 그대로 쓴다 (display_name은 검색에서만 이름 후보로 더함)
export type NamedGame = { name?: string | null; display_name?: string | null };

export const gameName = (g: NamedGame): string => g.display_name ?? g.name ?? '';
