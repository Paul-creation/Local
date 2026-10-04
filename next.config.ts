import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel 이미지 변환(무료 한도) 안 씀 — 스팀은 CDN 크기별 이미지, 에픽은 CDN 파라미터로 줄여 받는다 (components/GameImage)
  images: { unoptimized: true },
  // 공유 미리보기 이미지에서 쓰는 한글 글꼴을 배포 파일에 포함
  outputFileTracingIncludes: {
    '/api/og/**': [
      './node_modules/pretendard/dist/public/static/Pretendard-Medium.otf',
      './node_modules/pretendard/dist/public/static/Pretendard-ExtraBold.otf',
    ],
  },
};

export default nextConfig;
