'use client';

import { useState } from 'react';
import GameImage from '../../GameImage';
import type { Cover } from '../../../lib/homeMain';

// 세로 표지(2:3) — 저장된 주소(cover_vertical_url)를 우선 쓰고, ''(없음 확인됨)이면 바로 가로 이미지,
// 아직 확인 안 한 게임(null)은 스팀 앱 ID로 만든 주소를 시도하다가 이미지가 없으면(404) 가로 이미지로 대체한다 (components/detail/DetailCover와 같은 규칙)
const libraryUrl = (appid: string) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/library_600x900.jpg`;

export default function PosterImage({ cover, eager = false }: { cover: Cover; eager?: boolean }) {
  const vertical = cover.vertical === '' ? null : cover.vertical || (cover.appid ? libraryUrl(cover.appid) : null);
  const [failed, setFailed] = useState(false);
  const useVertical = !!vertical && !failed;
  const src = useVertical ? vertical : cover.wide;
  if (!src) return null;
  return <GameImage src={src} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" fallbackWidth={400} onError={() => { if (useVertical) setFailed(true); }} />;
}
