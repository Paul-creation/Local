import { Geist, Noto_Sans_KR } from 'next/font/google';

// 메인 리디자인 글꼴 — mono-tokens.css의 --mn-font가 이 변수를 쓴다. 클래스는 .mn 루트(GameGrid)에만 붙인다
const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });
const notoKr = Noto_Sans_KR({ weight: ['400', '500', '700', '800'], variable: '--font-noto-kr', display: 'swap', preload: false });

export const mnFontClass = `${geist.variable} ${notoKr.variable}`;
