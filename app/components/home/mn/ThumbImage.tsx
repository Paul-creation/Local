'use client';

import { useEffect, useRef, useState } from 'react';

// 유튜브 영상 썸네일 — 가장 큰 maxresdefault(1280x720)부터 쓰고, 없으면 sddefault(640x480) → hqdefault(480x360) 순으로 내려간다
// 유튜브는 큰 썸네일이 없으면 오류 대신 120x90 기본 이미지를 주므로, 불러온 뒤 naturalWidth가 120 이하이면(또는 오류면) 다음 크기로 바꾼다
const SIZES = ['maxresdefault', 'sddefault', 'hqdefault'] as const;

export default function ThumbImage({ videoId, eager = false }: { videoId: string; eager?: boolean }) {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLImageElement>(null);
  const check = (img: HTMLImageElement) => { if (i < SIZES.length - 1 && img.naturalWidth <= 120) setI(i + 1); };
  // 서버가 그린 이미지가 화면 준비(hydration) 전에 이미 받아졌으면 onLoad가 안 불리므로 한 번 더 확인
  useEffect(() => { const img = ref.current; if (img?.complete) check(img); }); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 유튜브 썸네일 (이미지 최적화 안 씀)
    <img ref={ref} src={`https://i.ytimg.com/vi/${videoId}/${SIZES[i]}.jpg`} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" onLoad={(e) => check(e.currentTarget)} onError={() => { if (i < SIZES.length - 1) setI(i + 1); }} />
  );
}
