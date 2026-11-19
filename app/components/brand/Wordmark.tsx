import { SITE_NAME } from '../../lib/site';

// 공식 워드마크 — 디자인팀 원본 파일(public/select-screen_13.png, 2530×792, 어두운 바탕 포함)을 그대로 쓴다.
// 헤더 높이 28px(모바일 22px) · 푸터 22px, 너비 auto. 파일의 어두운 바탕은 mix-blend-mode: lighten으로 투명하게 보이게 한다(히어로 위에 얹힌 투명 헤더에서 네모가 보이지 않게)
// 일반 img를 쓴다 — next/image는 Vercel 이미지 최적화 사용량을 늘리고, 이 파일은 이미 2x 이상 해상도라 줄일 필요가 없다
export default function Wordmark({ size = 'md', priority = false }: { size?: 'md' | 'sm'; priority?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 위 설명
    <img className={`wm-img wm-${size}`} src="/select-screen_13.png" width={2530} height={792} alt={SITE_NAME} fetchPriority={priority ? 'high' : undefined} decoding={priority ? 'sync' : 'async'} />
  );
}
