// scripts/lib/html-entities.mjs
// 스팀 appdetails의 HTML 문자열(&amp; &quot; 등)에서 태그를 지운 뒤 엔티티를 글자로 풀어 저장하기 위한 함수
// app/lib/htmlEntities.ts와 같은 규칙 (한 번만 풀고, 모르는 엔티티는 그대로)
const NAMED = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', reg: '®', trade: '™', copy: '©' };

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}
