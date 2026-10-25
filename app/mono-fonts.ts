import localFont from 'next/font/local';
import { GeistSans } from 'geist/font/sans';

// 글꼴은 전부 자체 호스팅 — 빌드 때 구글 폰트 서버에 묻지 않는다 (간헐적 응답 실패로 빌드가 깨졌었음)
// - 영문·숫자: Geist (npm 패키지 geist, 로컬 파일 + 크기를 맞춘 대체 글꼴이 들어 있음). 변수 --font-geist-sans
// - 한글: Pretendard Variable (woff2 한 파일, 모든 굵기). preload + display: swap + 크기를 맞춘 대체 글꼴(Arial 기준)로 교체될 때 글자가 덜 밀린다. 변수 --font-pretendard
// 대체 글꼴 'Pretendard Hangul Fallback'은 globals.css(@font-face) — 글이 바뀔 때 줄바꿈이 달라지지 않게 크기를 맞춘 시스템 한글 글꼴
// app/layout.tsx가 html에 변수만 붙이고, 실제 font-family는 본문(globals.css, Pretendard)과 .mn 범위(mono-tokens.css의 --mn-font: Geist → Pretendard)에서 쓴다
const pretendard = localFont({
  src: '../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2',
  variable: '--font-pretendard',
  weight: '45 920',
  display: 'swap',
  preload: true,
  adjustFontFallback: 'Arial',
  fallback: ['Pretendard Hangul Fallback', '-apple-system', 'BlinkMacSystemFont', 'Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'],
});

export const mnFontClass = `${GeistSans.variable} ${pretendard.variable}`;
