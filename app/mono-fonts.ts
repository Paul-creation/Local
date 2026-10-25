import { GeistSans } from 'geist/font/sans';

import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';

// 글꼴은 전부 자체 호스팅 — 빌드 때 구글 폰트 서버에 묻지 않는다 (간헐적 응답 실패로 빌드가 깨졌었음)
// - 영문·숫자: Geist (npm 패키지 geist, 로컬 파일 + 크기를 맞춘 대체 글꼴이 들어 있음). 변수 --font-geist-sans
// - 한글: Pretendard Variable dynamic subset (npm 패키지 pretendard, unicode-range로 나뉜 woff2 조각, 가변 굵기 45~920). 글에 쓰인 글자가 든 조각만 받는다. font-display: swap
//   next/font/local은 unicode-range를 지원하지 않아 패키지 CSS(@font-face 'Pretendard Variable')를 그대로 불러오고, 변수 --font-pretendard는 globals.css의 .pretendard-var가 정한다
// 대체 글꼴 'Pretendard Hangul Fallback'은 globals.css(@font-face) — 글이 바뀔 때 줄바꿈이 달라지지 않게 크기를 맞춘 시스템 한글 글꼴
// app/layout.tsx가 html에 클래스만 붙이고, 실제 font-family는 본문(globals.css, Pretendard)과 .mn 범위(mono-tokens.css의 --mn-font: Geist → Pretendard)에서 쓴다
export const mnFontClass = `${GeistSans.variable} pretendard-var`;
