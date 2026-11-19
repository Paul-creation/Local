'use client';

import { useEffect, useRef, type ReactNode } from 'react';

// 상세 오른쪽 aside — 높이가 (화면 높이 - 32px) 이하면 top 16px에 고정, 더 길면 top을 (화면 높이 - aside 높이 - 16px)(음수 가능)로 둬서
// 같이 스크롤되다가 aside 맨 아래가 화면 아래 16px에 닿으면 고정된다. 값은 --aside-top으로 넣고(CSS: .gd-aside), 높이·창 크기가 바뀔 때마다 다시 잰다
// aside 안에는 스크롤바를 만들지 않는다. 1열(960px 이하)에서는 CSS가 sticky를 끈다
export default function StickyAside({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const h = el.offsetHeight;
      const vh = window.innerHeight;
      el.style.setProperty('--aside-top', `${h <= vh - 32 ? 16 : vh - h - 16}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => { ro.disconnect(); window.removeEventListener('resize', update); };
  }, []);
  return <aside ref={ref} className="gd-aside">{children}</aside>;
}
