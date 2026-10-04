'use client';

import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react';
import { sizedImage } from '../lib/imageUrl';

// 게임 이미지 공통. Vercel 이미지 변환(무료 한도)을 쓰지 않고 스토어 CDN 이미지를 그대로 받는다 (next.config.ts images.unoptimized)
// - 스팀: steamSize를 주면 스팀 CDN의 크기별 이미지로 바꿔 받음. 그 크기가 없는 게임(404)이면 원래 주소로 다시 받음
//   표준 이름(apps/<id>/header.jpg 등)일 때만 바꾼다 — 해시가 붙은 새 주소는 크기별 이미지가 옛 그림일 수 있어 원본 그대로
// - 에픽: sizedImage가 CDN 파라미터로 줄여 받음. IGDB 등 나머지는 원본
// width·height·style은 받지 않아서 지금까지처럼 CSS가 크기를 정한다
const STEAM_HOST = 'shared.akamai.steamstatic.com';
const STEAM_STANDARD = /^(\/store_item_assets\/steam\/apps\/\d+\/)[a-z0-9_]+\.jpg$/;

// 스팀 CDN 크기별 이미지 (가로×세로). 화면 폭의 2배(고해상도 화면)를 넘는 것 중 가장 작은 것을 고른다
// capsule_616x353(16:9 카드·배너), header(460×215), header_292x136(작은 목록·검색 추천), capsule_231x87, capsule_sm_120(120×45)
export type SteamSize = 'capsule_616x353' | 'header' | 'header_292x136' | 'capsule_231x87' | 'capsule_sm_120';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> & {
  src: string | null | undefined;
  steamSize?: SteamSize; // 없으면 원본 그대로
  fallbackWidth?: number; // 에픽 이미지를 줄일 폭
};

function steamVariant(src: string, size: SteamSize): string {
  try {
    const u = new URL(src);
    const m = u.hostname === STEAM_HOST && STEAM_STANDARD.exec(u.pathname);
    if (m) return `${u.origin}${m[1]}${size}.jpg${u.search}`;
  } catch {}
  return src;
}

export default function GameImage({ src, steamSize, fallbackWidth = 480, alt = '', onError, ...rest }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const ref = useRef<HTMLImageElement>(null);
  const sized = src && steamSize && failedSrc !== src ? steamVariant(src, steamSize) : src;
  // 서버에서 그린 이미지가 화면 준비(hydration) 전에 실패했으면 onError가 안 불리므로 한 번 더 확인
  useEffect(() => {
    const img = ref.current;
    if (src && sized !== src && img?.complete && img.naturalWidth === 0) setFailedSrc(src);
  }, [src, sized]);
  if (!src || !sized) return null;
  return (
    <img
      ref={ref}
      src={sizedImage(sized, fallbackWidth)}
      alt={alt}
      onError={(e) => {
        if (sized !== src) setFailedSrc(src); // 크기별 이미지가 없으면 원본으로
        onError?.(e);
      }}
      {...rest}
    />
  );
}
