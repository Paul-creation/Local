'use client';

import { useEffect, useState } from 'react';

// 검색창 단축키 표시 — 맥은 "⌘K", 그 외는 "Ctrl K". 고정 폭 상자는 서버가 먼저 그려 자리를 잡고(밀림 없음), 마운트 뒤 글자만 채운다
// 터치 기기·768px 미만에서 숨기는 건 CSS 미디어쿼리(mn.css .mn-kbd)라 마운트 전후 차이가 없다. 단축키 동작(⌘K / Ctrl+K)은 MainHero가 처리
export default function ShortcutHint() {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    const mac = /Mac/i.test(nav.userAgentData?.platform ?? '') || /Mac/i.test(navigator.userAgent);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저(운영체제)에서 한 번 읽어 오는 초기화
    setLabel(mac ? '⌘K' : 'Ctrl K');
  }, []);
  return <kbd className="mn-kbd" aria-hidden="true">{label}</kbd>;
}
