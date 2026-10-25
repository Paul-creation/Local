'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeftIcon, ArrowRightIcon } from './icons';

// 메인 가로 스크롤 줄 공용 컴포넌트 — 제목 줄(데스크톱 ←·→ 버튼) + 스크롤 스냅 한 줄 + 양쪽 끝 페이드
// perDesktop·perMobile: 한 번에 보이는 카드 수(소수면 오른쪽 카드가 잘려 보임) — 768px 미만이 mobile. 스크롤바는 숨김, 터치는 스와이프, 키보드 포커스가 가면 그 카드가 보이게 스크롤
// 줄 안 항목은 <li>로 넘긴다
export default function HScrollRow({ id, title, label, perDesktop, perMobile, children }: { id: string; title: string; label: string; perDesktop: number; perMobile: number; children: ReactNode }) {
  const rowRef = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const [overflow, setOverflow] = useState(false); // 줄 안 내용이 폭보다 넓을 때만 ←·→ 버튼을 그린다
  const update = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    const start = el.scrollLeft <= 1;
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
    setEdge((e) => (e.start === start && e.end === end ? e : { start, end }));
    setOverflow(el.scrollWidth > el.clientWidth + 1);
  }, []);
  // 창·줄 폭이 바뀌어 넘치게 되거나 다 들어가게 되면 다시 판정
  useEffect(() => {
    update();
    const el = rowRef.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update]);
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const page = (dir: 1 | -1) => rowRef.current?.scrollBy({ left: dir * rowRef.current.clientWidth, behavior: reduced() ? 'auto' : 'smooth' });
  return (
    <section className="mn-sec" aria-labelledby={id}>
      <div className="mn-sec-head">
        <h2 id={id}>{title}</h2>
        {overflow && <div className="mn-hs-arrows">
          <button type="button" className="mn-hs-arrow" aria-label={`${label} 이전`} disabled={edge.start} onClick={() => page(-1)}><ArrowLeftIcon /></button>
          <button type="button" className="mn-hs-arrow" aria-label={`${label} 다음`} disabled={edge.end} onClick={() => page(1)}><ArrowRightIcon /></button>
        </div>}
      </div>
      <div className={`mn-hs${edge.start ? '' : ' has-prev'}${edge.end ? '' : ' has-next'}`} style={{ '--per-d': perDesktop, '--per-m': perMobile } as React.CSSProperties}>
        <ul
          ref={rowRef}
          className="mn-hs-row"
          onScroll={update}
          onFocus={(e) => (e.target as HTMLElement).scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' })}
          aria-label={label}
        >
          {children}
        </ul>
      </div>
    </section>
  );
}
