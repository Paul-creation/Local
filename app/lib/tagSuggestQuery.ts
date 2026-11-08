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
