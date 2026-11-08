// scripts/lib/korean-support.mjs
// 스팀 appdetails의 supported_languages → games.korean_support ('한국어 없음' | '자막' | '자막+더빙')
// DB 채우기(enrich-specs·fix-data-gaps)와 릴스 생성기(insta/reel-trend)가 같은 판정을 쓴다
// - 스팀은 음성까지 지원하는 언어 뒤에 <strong>*</strong>를 붙임 (full_audio_languages 칸은 응답에 없는 경우가 많음)
// - supported_languages 자체가 비어 있으면 '한국어 없음'이 아니라 null (모름, 상점 정보가 비었을 뿐)
const KOREAN = /(한국어|Korean)(<strong>\*<\/strong>)?/;
const plain = (s) => String(s || '').replace(/<[^>]+>/g, '');

export function parseKoreanSupport(languages, fullAudioLanguages) {
  if (!languages) return null;
  const m = KOREAN.exec(languages);
  if (!m) return '한국어 없음';
  if (m[2] || /한국어|korean/i.test(plain(fullAudioLanguages))) return '자막+더빙';
  return '자막';
}

// 카드·릴스에 쓰는 문구
export const koreanLabel = (support) => (support === '자막+더빙' ? '한국어 자막+더빙' : support === '자막' ? '한국어 자막' : null);
