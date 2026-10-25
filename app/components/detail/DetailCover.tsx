'use client';

import { useState } from 'react';
import GameImage from '../GameImage';

// 세로 표지 — 스팀 library_600x900. 저장된 주소(games.cover_vertical_url)가 있으면 그것, 없으면 앱 ID로 만든 주소를 시도하고
// 이미지가 없으면(404) 기존 가로 이미지로 대체한다
const libraryUrl = (appid: string) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/library_600x900.jpg`;

export default function DetailCover({ verticalUrl, steamAppid, fallback, name }: { verticalUrl: string | null; steamAppid: string | null; fallback: string | null; name: string }) {
  const vertical = verticalUrl || (steamAppid ? libraryUrl(steamAppid) : null);
  const [failed, setFailed] = useState(false);
  const useVertical = !!vertical && !failed;
  const src = useVertical ? vertical : fallback;
  if (!src) return <div className="dx-cover is-empty" aria-hidden="true" />;
  return (
    <div className={`dx-cover${useVertical ? '' : ' is-wide'}`}>
      <GameImage src={src} fallbackWidth={600} alt={name} fetchPriority="high" onError={() => { if (useVertical) setFailed(true); }} />
    </div>
  );
}
