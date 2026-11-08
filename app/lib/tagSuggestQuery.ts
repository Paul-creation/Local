// 담당: 친구(검색·태그·비교)
// 자동완성이 태그·활동 후보를 찾을 때 쓰는 검색어 — 마지막 단어 하나만 보면 "finals w"의 "w"가 "전쟁(war)"·"무협(wuxia)"에 걸린다
// - 단어가 하나: 그 단어
// - 앞 단어들이 전부 이미 태그("좀비 협"처럼 태그를 이어 치는 중): 마지막 단어. 영문·숫자 한 글자만 안 건다(한글 한 글자는 "협"→협동처럼 허용)
// - 그 밖: 입력 전체(띄어쓰기 포함). 후보는 이름·별칭이 이 전체를 실제로 포함할 때만 나온다
export function suggestQuery(words: string[], prefixIsAllTags: boolean): string {
  const last = words[words.length - 1] ?? '';
  if (!last) return '';
  if (words.length === 1) return last;
  if (prefixIsAllTags) return [...last].length >= 2 || /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(last) ? last : '';
  return words.join(' ');
}

// ── 게임 결과 매칭 — 태그 쪽과 같은 원칙 (import 없는 순수 함수, 실제 판정 함수는 SearchBox가 넘기고 테스트는 가짜를 넘김) ──
// 1) 단어 하나: 입력 그대로 이름·별칭 매칭
// 2) 앞 단어가 전부 태그(이어 치기): 그 태그를 모두 가진 게임 중에서만 마지막 단어로 이름·별칭 매칭.
//    마지막 단어가 영문·숫자 한 글자면 이름 매칭은 하지 않고 그 태그를 가진 인기 게임 몇 개만
// 3) 앞 단어 중에 태그가 아닌 게 있으면: 입력 전체(띄어쓰기 포함)가 이름·별칭에 포함될 때만 (맞는 게 없을 때의 "태그 단어를 뺀 나머지" 대체는 호출하는 쪽이 그대로 한다)
export type GamePlan = { mode: 'single' | 'chain' | 'whole'; tags: string[]; name: string; popular: boolean };
export function planGameSearch(words: string[], prefixTags: string[] | null): GamePlan {
  const last = words[words.length - 1] ?? '';
  if (words.length <= 1) return { mode: 'single', tags: [], name: last, popular: false };
  if (prefixTags && prefixTags.length) {
    const oneAscii = [...last].length === 1 && /^[a-z0-9]$/i.test(last);
    return { mode: 'chain', tags: prefixTags, name: oneAscii ? '' : last, popular: oneAscii };
  }
  return { mode: 'whole', tags: [], name: words.join(' '), popular: false };
}

export function pickGames<G>(games: G[], plan: GamePlan, d: { rank: (g: G, q: string) => number; owns: (g: G, tag: string) => boolean; heat: (g: G) => number; limit: number }): G[] {
  const pool = plan.tags.length ? games.filter((g) => plan.tags.every((t) => d.owns(g, t))) : games;
  if (plan.popular) return [...pool].sort((a, b) => d.heat(a) - d.heat(b)).slice(0, d.limit);
  if (!plan.name) return [];
  return pool.map((g) => ({ g, r: d.rank(g, plan.name) })).filter((x) => x.r >= 0).sort((a, b) => a.r - b.r).slice(0, d.limit).map((x) => x.g);
}
