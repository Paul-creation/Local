'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

// 카드 칩 줄 — 한 줄로 고정. 들어가는 만큼만 보이고 나머지는 "+N" 공통 칩(.chip.is-static, 같은 높이)으로 묶는다
// 처음엔 전부 그린 뒤 폭을 재서 넘치는 것만 숨긴다(칸 폭이 바뀌면 다시 계산). 숨긴 칩 이름은 +N 칩의 title에 담는다
export default function ChipRow({ items, labels }: { items: ReactNode[]; labels: string[] }) {
  const rowRef = useRef<HTMLSpanElement>(null);
  const [hidden, setHidden] = useState(0);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const fit = () => {
      const els = Array.from(row.querySelectorAll<HTMLElement>('[data-ci]'));
      const more = row.querySelector<HTMLElement>('[data-more]');
      if (!more) return;
      els.forEach((e) => { e.style.display = ''; });
      more.style.display = '';
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      const ws = els.map((e) => e.offsetWidth);
      const mw = more.offsetWidth;
      const room = row.clientWidth;
      const total = ws.reduce((a, w) => a + w, 0) + gap * Math.max(0, ws.length - 1);
      let show = ws.length;
      if (total > room) {
        // +N 칩 자리를 남기고 앞에서부터 채운다 (최소 1개는 보인다)
        let used = mw;
        show = 0;
        for (const w of ws) {
          if (used + gap + w > room && show >= 1) break;
          used += gap + w;
          show++;
        }
      }
      els.forEach((e, i) => { e.style.display = i < show ? '' : 'none'; });
      more.style.display = show < ws.length ? '' : 'none';
      setHidden(ws.length - show);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(row);
    return () => ro.disconnect();
  }, [items.length]);

  return (
    <span className="gc-chips" ref={rowRef}>
      {items.map((it, i) => <span key={i} data-ci className="gc-chip-item">{it}</span>)}
      <span data-more className="chip is-static" style={{ display: 'none' }} title={labels.slice(labels.length - hidden).join(' · ')}>+{hidden}</span>
    </span>
  );
}
