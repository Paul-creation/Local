import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// 공유 미리보기 이미지(ImageResponse)용 공통 설정
// 기본 글꼴은 한글이 안 나와서 Pretendard를 직접 불러옴 (서버가 처음 뜰 때 한 번만 읽음)
const fontDir = join(process.cwd(), 'node_modules/pretendard/dist/public/static');
let fontsPromise: Promise<{ name: string; data: Buffer; weight: 400 | 800; style: 'normal' }[]> | null = null;

export function loadOgFonts() {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      readFile(join(fontDir, 'Pretendard-Medium.otf')),
      readFile(join(fontDir, 'Pretendard-ExtraBold.otf')),
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

// 메시지 앱마다 미리보기를 정사각형·4:3 등으로 가운데만 잘라 보여줘서, 핵심 내용은 가운데 600x600 안에만 둔다
export const OG_SAFE = 600;
