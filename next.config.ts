import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 스팀 게임 이미지만 next/image로 최적화 (components/GameImage). 스팀 주소는 ?t=로 바뀌므로 한 번 만든 결과는 31일 보관
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'shared.akamai.steamstatic.com', pathname: '/store_item_assets/**' }],
    minimumCacheTTL: 2678400,
  },
  // 공유 미리보기 이미지에서 쓰는 한글 글꼴을 배포 파일에 포함
  outputFileTracingIncludes: {
    '/api/og/**': [
      './node_modules/pretendard/dist/public/static/Pretendard-Medium.otf',
      './node_modules/pretendard/dist/public/static/Pretendard-ExtraBold.otf',
    ],
  },
};

export default nextConfig;
