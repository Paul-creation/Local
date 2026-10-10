'use client';

import { useEffect, useState } from 'react';

// 가이드 목차 — 1440px은 왼쪽 sticky 세로 목록, 900px 미만은 위쪽 sticky 가로 칩 줄(globals.css .guide-toc).
// 지금 읽는 섹션은 IntersectionObserver로 찾아 aria-current + 공통 .chip.on으로 표시 (움직임 없음). 앵커 링크라 JS가 없어도 이동은 됨
export default function GuideToc({ items, label }: { items: { id: string; label: string }[]; label: string }) {
  const [active, setActive] = useState(items[0]?.id ?? '');

  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => !!e);
    if (!els.length || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: '-25% 0px -65% 0px' },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [items]);

  return (
    <nav className="guide-toc" aria-label={label}>
      <ul>
        {items.map((i) => (
          <li key={i.id}>
            <a href={`#${i.id}`} className={`chip${active === i.id ? ' on' : ''}`} aria-current={active === i.id ? 'true' : undefined} onClick={() => setActive(i.id)}>{i.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
