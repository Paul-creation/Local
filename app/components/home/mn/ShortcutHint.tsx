'use client';

import { useEffect, useState } from 'react';

// 검색창 단축키 표시 — 맥은 "⌘K", 그 외는 "Ctrl K". 서버가 그린 첫 화면은 비워 두고 마운트 뒤 채운다(깜빡임 없이).
// 터치 기기(pointer: coarse)와 768px 미만에서는 보이지 않는다. 단축키 동작(⌘K / Ctrl+K)은 MainHero가 처리
const SHOW = '(min-width: 768px) and (pointer: fine)';

export default function ShortcutHint() {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    const mac = /Mac/i.test(nav.userAgentData?.platform ?? '') || /Mac/i.test(navigator.userAgent);
    const mq = window.matchMedia(SHOW);
    const on = () => setLabel(mq.matches ? (mac ? '⌘K' : 'Ctrl K') : '');
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return label ? <kbd className="mn-kbd" aria-hidden="true">{label}</kbd> : null;
}
