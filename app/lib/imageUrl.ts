// 스토어 이미지를 화면에 맞는 크기로 받는 주소. 에픽 CDN은 주소 뒤 파라미터로 줄여 줌 (3.6MB PNG → 약 20KB JPEG)
// Steam·IGDB 등 나머지는 원래 주소 그대로
export function sizedImage(url: string | null | undefined, width = 480): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (u.hostname === 'cdn1.epicgames.com' && !u.search) return `${url}?resize=1&w=${width}&quality=medium`;
  } catch {}
  return url;
}
