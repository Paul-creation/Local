'use client';

import { useEffect } from 'react';

// 페이지가 열리면 항상 맨 위에서 시작
export default function ScrollToTop() {
  useEffect(() => {
    const prev = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    const id = requestAnimationFrame(() => window.scrollTo(0, 0));
    return () => {
      cancelAnimationFrame(id);
      history.scrollRestoration = prev;
    };
  }, []);
  return null;
}
