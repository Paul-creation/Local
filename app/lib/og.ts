import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// 공유 미리보기 이미지(ImageResponse)용 공통 설정
// 기본 글꼴은 한글이 안 나와서 Pretendard를 직접 불러옴 (서버가 처음 뜰 때 한 번만 읽음)
let fontsPromise: Promise<{ name: string; data: Buffer; weight: 400 | 800; style: 'normal' }[]> | null = null;

export function loadOgFonts() {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      readFile(join(process.cwd(), 'node_modules/pretendard/dist/public/static/Pretendard-Medium.otf')),
      readFile(join(process.cwd(), 'node_modules/pretendard/dist/public/static/Pretendard-ExtraBold.otf')),
    ]).then(([medium, extraBold]) => [
      { name: 'Pretendard', data: medium, weight: 400, style: 'normal' },
      { name: 'Pretendard', data: extraBold, weight: 800, style: 'normal' },
    ]);
    fontsPromise.catch(() => { fontsPromise = null; });
  }
  return fontsPromise;
}

export const OG_SIZE = { width: 1200, height: 630 };
// 하루 동안 캐시 (CDN도 같이)
export const OG_CACHE = 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400';

export { playersText } from './players';

// OG 이미지 색 — app/globals.css 다크 토큰과 같은 값 (ImageResponse는 CSS 변수를 못 읽어서 값을 그대로 둠)
export const OG_COLOR = {
  bg: '#0b0e13',           // --bg
  card: '#151A24',         // --card
  inset: '#10141C',        // --inset (이미지 없는 칸)
  text: '#F3F4F6',         // --text
  textMuted: '#9CA3AF',    // --text-muted
  accent: '#66C0F4',       // --accent
  review: '#A3D4F5',       // --review (스팀 평가)
  discountBg: '#4c6b22',   // --discount-bg
  discountText: '#beee11', // --discount-text
};

// 카드 이미지를 서버에서 미리 받아 data URI로 넘김. 못 받거나 형식이 안 맞으면 null → 그 게임은 이름만 보여줌
// (ImageResponse에 주소를 그대로 넘기면 이미지 하나만 실패해도 그림 전체가 깨져서 빈 응답이 됨)
export async function fetchOgImage(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const type = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (!res.ok || !['image/jpeg', 'image/png', 'image/gif'].includes(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 2_000_000) return null;
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

// 메시지 앱마다 미리보기를 정사각형·4:3 등으로 가운데만 잘라 보여줘서, 핵심 내용은 가운데 600x600 안에만 둔다
export const OG_SAFE = 600;
