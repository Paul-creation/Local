// /my-pc?back= 돌아가기 주소 검사 (순수 함수 — 테스트가 .ts를 바로 불러온다, 다른 파일을 import하지 않는다)
// 같은 사이트 안의 경로만 허용: "/"로 시작, "//"(프로토콜 상대 주소)·백슬래시·제어문자(브라우저가 지워서 "//"가 되는 탭·줄바꿈 포함) 금지, 길이 제한
// 마지막으로 가짜 기준 주소에 붙여 보고 같은 출처인지 한 번 더 확인한다. 통과하지 못하면 null (돌아가기 링크를 안 보임)
const MAX = 500;

export function safeBackPath(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (value.includes('\\')) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const u = new URL(value, 'http://site.invalid');
    if (u.origin !== 'http://site.invalid') return null;
  } catch {
    return null;
  }
  return value;
}
