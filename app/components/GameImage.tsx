import type { ImgHTMLAttributes } from 'react';
import { getImageProps } from 'next/image';
import { sizedImage } from '../lib/imageUrl';

// 게임 이미지 공통. 스팀 이미지는 next/image 최적화(WebP + 화면 폭에 맞춘 srcset)를 거쳐 받고,
// 나머지(에픽·IGDB)는 sizedImage 주소 그대로. 허용 주소는 next.config.ts의 images.remotePatterns
// width·height·style은 받지 않아서 지금까지처럼 CSS가 크기를 정한다. loading도 넘긴 값 그대로 (기본 즉시 로딩)
const STEAM_HOST = 'shared.akamai.steamstatic.com';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet' | 'sizes'> & {
  src: string | null | undefined;
  sizes: string; // 화면에 보이는 폭. 예: "(max-width: 640px) 50vw, 300px"
  fallbackWidth?: number; // 스팀이 아닐 때 sizedImage로 줄일 폭
};

export default function GameImage({ src, sizes, fallbackWidth = 480, alt = '', loading, ...rest }: Props) {
  if (!src) return null;
  let steam = false;
  try { steam = new URL(src).hostname === STEAM_HOST; } catch {}
  if (!steam) return <img src={sizedImage(src, fallbackWidth)} alt={alt} loading={loading} {...rest} />;
  const { props: { style: _style, loading: _loading, ...img } } = getImageProps({ src, alt, sizes, fill: true });
  return <img {...img} loading={loading} {...rest} />;
}
