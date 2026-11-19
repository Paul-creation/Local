import { SITE_NAME } from '../../lib/site';

// 공식 워드마크 — 디자인팀 원본 파일(public/select-screen_13.png, 글자·괄호 영역에 딱 맞게 잘라 낸 2151×470, 어두운 바탕 포함)을 그대로 쓴다.
// 크기는 너비로 정한다: 헤더 168px(모바일 132px) · 푸터 132px, 높이 auto. 메인·상세·다른 페이지 모두 이 컴포넌트 하나를 쓴다
// 일반 img를 쓴다 — next/image는 Vercel 이미지 최적화 사용량을 늘리고, 이 파일은 이미 2x 이상 해상도라 줄일 필요가 없다
export default function Wordmark({ size = 'md', priority = false }: { size?: 'md' | 'sm'; priority?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 위 설명
    <img className={`wm-img wm-${size}`} src="/select-screen_13.png" width={2151} height={470} alt={SITE_NAME} fetchPriority={priority ? 'high' : undefined} decoding={priority ? 'sync' : 'async'} />
  );
}
