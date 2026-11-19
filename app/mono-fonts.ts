import localFont from 'next/font/local';

import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';

// 글꼴은 전부 자체 호스팅 — 빌드 때 구글 폰트 서버에 묻지 않는다 (간헐적 응답 실패로 빌드가 깨졌었음)
// - 영문 워드마크·숫자: Inter 가변 (npm @fontsource-variable/inter의 latin 파일을 app/fonts에 복사, next/font/local). 변수 --font-inter. 쓰는 굵기는 900 (자간 -0.05em은 brand-tokens.css)
// - 한글: Pretendard Variable dynamic subset (npm 패키지 pretendard, unicode-range로 나뉜 woff2 조각, 가변 굵기 45~920). 글에 쓰인 글자가 든 조각만 받는다. font-display: swap
//   next/font/local은 unicode-range를 지원하지 않아 한글은 패키지 CSS(@font-face 'Pretendard Variable')를 그대로 불러오고, 변수 --font-pretendard는 globals.css의 .pretendard-var가 정한다
// 대체 글꼴 'Pretendard Hangul Fallback'은 globals.css(@font-face) — 글이 바뀔 때 줄바꿈이 달라지지 않게 크기를 맞춘 시스템 한글 글꼴
// app/layout.tsx가 html에 클래스만 붙이고, 실제 font-family는 본문(globals.css, Pretendard)과 brand-tokens.css(--font-ko·--font-num)에서 쓴다
const inter = localFont({
  src: './fonts/Inter-latin-wght.woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--font-inter',
  fallback: ['system-ui', 'Arial'],
});

export const mnFontClass = `${inter.variable} pretendard-var`;
