// 이름 + 주격 조사 — 받침이 있는 한글이면 "이", 받침 없는 한글이면 "가", 그 밖(영문·숫자 등)은 "이"
export function withSubjectJosa(name: string) {
  const code = name.trim().slice(-1).charCodeAt(0);
  const hangul = code >= 0xac00 && code <= 0xd7a3;
  return `${name}${hangul && (code - 0xac00) % 28 === 0 ? '가' : '이'}`;
}
