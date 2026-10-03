import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 공유 미리보기 이미지에서 쓰는 한글 글꼴을 배포 파일에 포함
  outputFileTracingIncludes: {
    '/api/og/**': [
      './node_modules/pretendard/dist/public/static/Pretendard-Medium.otf',
      './node_modules/pretendard/dist/public/static/Pretendard-ExtraBold.otf',
    ],
  },
};

export default nextConfig;
