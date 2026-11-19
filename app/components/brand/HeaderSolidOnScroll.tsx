'use client';

import { useEffect, useRef } from 'react';

// 투명 헤더(게임 상세) — 맨 위에서는 투명, 스크롤이 히어로를 지나간 뒤에만 헤더에 data-solid를 달아 배경·blur·아래 선이 생기게 한다 (CSS: globals.css .site-header[data-solid])
// 히어로 맨 아래에 두는 1px 표지(sentinel)가 헤더 밑으로 올라가 보이지 않게 되면 켠다. 헤더 높이는 CSS 변수 --header-h
export default function HeaderSolidOnScroll() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const header = document.querySelector('.site-header');
    if (!el || !header) return;
    const h = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 61;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting || e.boundingClientRect.top >= 0) header.removeAttribute('data-solid');
      else header.setAttribute('data-solid', '');
    }, { rootMargin: `-${h}px 0px 0px 0px`, threshold: 0 });
    io.observe(el);
    return () => { io.disconnect(); header.removeAttribute('data-solid'); };
  }, []);
  return <div ref={ref} className="hero-sentinel" aria-hidden="true" />;
}
