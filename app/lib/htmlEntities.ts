// 스팀 appdetails의 pc_requirements는 태그만 지우고 저장돼 &amp; &quot; 같은 엔티티가 그대로 남아 있다.
// 화면(React)이 한 번 더 이스케이프해서 "&amp;"가 글자 그대로 보였다. 표시 직전에 풀어 쓴다(저장값은 그대로)
// 순수 함수 — 다른 파일을 가져오지 않는다
const NAMED: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', reg: '®', trade: '™', copy: '©' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}
