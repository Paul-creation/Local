import type { NextConfig } from "next";

// 숨긴 중복 게임(games.hidden + merged_into)의 상세 주소 → 남긴 게임으로 308 이동. 빌드할 때 목록을 읽음
// 새로 숨긴 게임은 다음 배포부터 308이 되고, 그 전까지는 상세 페이지가 대신 이동시킴 (app/games/[id]/page.tsx)
async function mergedGameRedirects() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  try {
    const res = await fetch(`${url}/rest/v1/games?select=id,merged_into&hidden=eq.true&merged_into=not.is.null`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows: { id: string; merged_into: string }[] = await res.json();
    return rows.map((r) => ({ source: `/games/${r.id}`, destination: `/games/${r.merged_into}`, permanent: true }));
  } catch (e) {
    console.warn('숨긴 게임 이동 목록을 못 읽음 (상세 페이지 이동으로 대신함):', e);
    return [];
  }
}

const nextConfig: NextConfig = {
  redirects: mergedGameRedirects,
  // Vercel 이미지 변환(무료 한도) 안 씀 — 스팀은 CDN 크기별 이미지, 에픽은 CDN 파라미터로 줄여 받는다 (components/GameImage)
  images: { unoptimized: true },
  // 공유 미리보기 이미지에서 쓰는 한글 글꼴을 배포 파일에 포함
  outputFileTracingIncludes: {
    '/api/og/**': [
      './node_modules/pretendard/dist/public/static/Pretendard-Medium.otf',
      './node_modules/pretendard/dist/public/static/Pretendard-ExtraBold.otf',
    ],
  },
  // OG 이미지는 resvg.wasm으로 그려서 sharp(libvips 약 18MB)가 필요 없음
  outputFileTracingExcludes: {
    '/api/og/**': [
      './node_modules/@img/sharp-libvips-*/**',
      './node_modules/sharp/**',
    ],
  },
};

export default nextConfig;
