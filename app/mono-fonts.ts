import { Geist, Noto_Sans_KR } from 'next/font/google';

// 모노 디자인 글꼴 — app/layout.tsx가 html에 변수만 붙이고, 실제 font-family는 mono-tokens.css의 .mn(--mn-font) 안에서만 쓴다
const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });
const notoKr = Noto_Sans_KR({ weight: ['400', '500', '700', '800'], variable: '--font-noto-kr', display: 'swap', preload: false });

export const mnFontClass = `${geist.variable} ${notoKr.variable}`;
