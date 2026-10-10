'use client';

import { useEffect } from 'react';

// 라이트 모드를 없애기 전에 저장된 테마 키('theme')를 한 번 지운다 — 라이트를 골랐던 브라우저도 다크로 보이고 남은 키가 없게
export default function ThemeKeyCleanup() {
  useEffect(() => {
    try { localStorage.removeItem('theme'); } catch {}
  }, []);
  return null;
}
