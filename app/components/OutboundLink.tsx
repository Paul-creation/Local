'use client';

import type { AnchorHTMLAttributes } from 'react';
import { OUTBOUND_PATH } from '../lib/outbound';

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel'> & { href: string; curator: string; gameId?: string | null };

// 인스타그램으로 나가는 링크 — 클릭을 sendBeacon으로 보내 이동을 막지 않는다 (가운데 클릭도 센다). 기록 실패는 조용히 무시
export default function OutboundLink({ href, curator, gameId = null, onClick, onAuxClick, ...rest }: Props) {
  const record = () => {
    try {
      navigator.sendBeacon(OUTBOUND_PATH, JSON.stringify({ curator, game_id: gameId, target_url: href }));
    } catch {}
  };
  return (
    <a
      {...rest}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => { record(); onClick?.(e); }}
      onAuxClick={(e) => { if (e.button === 1) record(); onAuxClick?.(e); }}
    />
  );
}
