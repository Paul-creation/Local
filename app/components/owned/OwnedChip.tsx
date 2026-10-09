'use client';

import { useOwned } from './useOwned';

// "보유 중" 칩 — 공통 .chip(선택 상태 on) 그대로, 눌리지 않는 표시라 is-static만 더한다.
// 스팀에서 가져온 보유 목록에 이 게임의 appid가 있을 때만 보이고, 없거나 목록을 못 가져왔으면 아무것도 그리지 않는다 (미보유라고 단정하지 않음)
export default function OwnedChip({ steamAppid, className = '' }: { steamAppid: string | number | null | undefined; className?: string }) {
  const { has } = useOwned();
  if (!has(steamAppid)) return null;
  return <span className={`chip on is-static${className ? ` ${className}` : ''}`}>보유 중</span>;
}
