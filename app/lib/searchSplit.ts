// 검색창 입력(Enter·예전 ?q= 주소)을 활동·태그·이름으로 나누는 규칙 — import 없는 순수 함수 (useGameFilters가 실제 판정 함수를 넘기고, 테스트는 가짜를 넘김)
// 1) 비었거나 게임 이름과 똑같으면 나누지 않고 이름 검색
// 2) 활동 라벨과 정확히 같을 때만 활동 조건 하나로 ("운전" → 활동 운전). "운전 협동"처럼 다른 말이 섞이면 활동으로 바꾸지 않는다
// 3) 그 밖에는 태그 단어만 태그 조건으로 옮기고 나머지는 이름 검색 (활동과 같은 뜻의 태그 단어는 parse가 이미 뺀 상태로 넘어온다)
export type SplitDeps = {
  normalize: (text: string) => string;
  isGameName: (key: string) => boolean;
  activityOf: (key: string) => string | undefined;
  parse: (text: string) => { tags: string[]; rest: string };
};

export function splitSearchInput(text: string, d: SplitDeps): { tags: string[]; acts: string[]; rest: string } {
  const key = d.normalize(text);
  if (!key || d.isGameName(key)) return { tags: [], acts: [], rest: text.trim() };
  const act = d.activityOf(key);
  if (act) return { tags: [], acts: [act], rest: '' };
  return { ...d.parse(text), acts: [] };
}
