'use client';

import { useEffect, useRef, useState } from 'react';
import AutoBrackets from './brand/AutoBrackets';

// 큐레이터 페이지 포스터 — Steam 세로 캡슐(library_600x900, 2:3, cover). 칸 크기별 작은 버전이 Steam CDN에 없어 이 파일 하나를 쓴다(lazy)
// 세로 이미지가 없거나(404) 받기 실패하면: 가로 헤더 이미지를 흐린 배경으로 깔고 원본 헤더를 가운데에
const libraryUrl = (appid: string) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/library_600x900.jpg`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 게임 카드 칸은 목록(gameIndex)과 같은 느슨한 모양
export default function CuratorPoster({ game, eager = false }: { game: any; eager?: boolean }) {
  const stored: string | null = game.cover_vertical_url ?? null;
  const vertical = stored === '' ? null : stored || (game.steam_appid ? libraryUrl(String(game.steam_appid)) : null);
  const wide: string | null = game.cover_image_url || game.card_image_url || null;
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // 서버에서 그린 이미지가 hydration 전에 이미 실패했으면 onError가 안 불리므로 한 번 더 확인
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) setFailed(true);
  }, [vertical]);
  const loading = eager ? 'eager' : 'lazy';
  return (
    <span className="cp-poster sb-host">
      <span className="cp-clip">
      {vertical && !failed ? (
        <img ref={ref} src={vertical} alt="" loading={loading} decoding="async" onError={() => setFailed(true)} />
      ) : wide ? (
        <>
          <img className="cp-bg" src={wide} alt="" loading={loading} decoding="async" />
          <img className="cp-fg" src={wide} alt="" loading={loading} decoding="async" />
        </>
      ) : null}
      </span>
      <AutoBrackets />
    </span>
  );
}
