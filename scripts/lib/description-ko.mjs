// scripts/lib/description-ko.mjs
// 스팀 한국어 설명이 없는 게임의 한국어 상세 설명(games.description_ko) 규칙 — fill-description-ko.mjs가 씀
const HANGUL = /[가-힣]/;

// 스팀 about_the_game(HTML) → 평문. 이미지·GIF 줄은 버리고 최대 maxLen자
export function aboutToText(html, maxLen = 2500) {
  const text = String(html || '')
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/<\/(p|div|li|h\d)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
  return text.slice(0, maxLen);
}

// 스팀 한국어 설명이 없는 게임 = DB description(한국어 상점 short_description)에 한글이 없음 (스팀은 번역이 없으면 영어를 그대로 줌)
export const lacksSteamKorean = (g) => !!g.description && !HANGUL.test(g.description);

export const needsDescriptionKo = (g) => lacksSteamKorean(g) && !g.description_ko && !g.description_ko_at;

const sentences = (t) => t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);

// 문제 목록 (비어 있으면 통과): 2~3문장 · 존댓말(요체) · 영어 덩어리·마크다운 없음 · 길이 60~320자
export function checkDescriptionKo(text) {
  const t = String(text || '').trim();
  const problems = [];
  const ss = sentences(t);
  if (ss.length < 2 || ss.length > 3) problems.push(`문장이 ${ss.length}개예요 — 2~3문장으로`);
  if (t.length < 60 || t.length > 320) problems.push(`길이가 ${t.length}자예요 — 60~320자로`);
  const bad = ss.filter((s) => !/(요|니다|세요)[.!?]?$/.test(s.replace(/["”')\]]+$/, '')));
  if (bad.length) problems.push(`존댓말(~요체)이 아닌 문장: "${bad[0].slice(0, 30)}"`);
  if (/[*#`]|^\s*[-•]/m.test(t)) problems.push('마크다운·목록 표시가 있어요');
  if (/[A-Za-z]{4,}\s+[A-Za-z]{4,}\s+[A-Za-z]{4,}/.test(t)) problems.push('영어 문장이 섞여 있어요');
  if (!HANGUL.test(t)) problems.push('한글이 없어요');
  return problems;
}
