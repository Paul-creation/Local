'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type Screenshot = { path_thumbnail: string; path_full: string };

// 상세 스크린샷 갤러리 — 가로 한 줄 썸네일(scroll-snap), 클릭하면 큰 사진 라이트박스.
// next/image를 쓰지 않고 일반 img를 쓴다 (Vercel 이미지 최적화 사용량을 늘리지 않으려고). 로딩 전에는 같은 비율의 정지된 빈 틀
export default function ScreenshotGallery({ shots, name }: { shots: Screenshot[]; name: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const rowRef = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const count = shots.length;
  const isOpen = open != null;

  const move = useCallback((d: number) => setOpen((i) => (i == null ? i : (i + d + count) % count)), [count]);
  const close = useCallback(() => setOpen(null), []);

  const updateEdge = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    const start = el.scrollLeft <= 1;
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
    setEdge((p) => (p.start === start && p.end === end ? p : { start, end }));
  }, []);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    updateEdge();
    el.addEventListener('scroll', updateEdge, { passive: true });
    window.addEventListener('resize', updateEdge);
    return () => {
      el.removeEventListener('scroll', updateEdge);
      window.removeEventListener('resize', updateEdge);
    };
  }, [updateEdge, count]);

  // 썸네일 한 장 반 만큼 이동. 모션 줄이기 설정이면 즉시 이동
  const scrollRow = useCallback((dir: 1 | -1) => {
    const el = rowRef.current;
    const item = el?.firstElementChild as HTMLElement | null;
    if (!el || !item) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * (item.offsetWidth + 10) * 1.5, behavior: reduce ? 'auto' : 'smooth' });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') move(-1);
      else if (e.key === 'ArrowRight') move(1);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      lastFocus.current?.focus();
    };
  }, [isOpen, close, move]);

  return (
    <section className="detail-card shots" aria-label="스크린샷">
      <h3 className="detail-card-title">스크린샷</h3>
      <div className="shots-wrap">
      <ul className="shots-row" ref={rowRef} data-end={edge.end || undefined}>
        {shots.map((s, i) => (
          <li key={s.path_thumbnail} className="shots-item">
            <button
              type="button"
              className="shots-thumb"
              onClick={(e) => { lastFocus.current = e.currentTarget; setOpen(i); }}
              aria-label={`${name} 스크린샷 ${i + 1} 크게 보기`}
            >
              <img src={s.path_thumbnail} alt="" loading="lazy" decoding="async" />
            </button>
          </li>
        ))}
      </ul>
      {!edge.start && <button type="button" className="shots-nav shots-nav-prev" onClick={() => scrollRow(-1)} aria-label="이전 스크린샷 보기">‹</button>}
      {!edge.end && <button type="button" className="shots-nav shots-nav-next" onClick={() => scrollRow(1)} aria-label="다음 스크린샷 보기">›</button>}
      </div>

      {open != null && (
        <div className="shots-lightbox" role="dialog" aria-modal="true" aria-label={`${name} 스크린샷`} onClick={close}>
          <div className="shots-stage">
            <img src={shots[open].path_full} alt={`${name} 스크린샷 ${open + 1}`} onClick={(e) => e.stopPropagation()} />
          </div>
          <div className="shots-bar" onClick={(e) => e.stopPropagation()}>
            {count > 1 && <button type="button" className="shots-btn" onClick={() => move(-1)} aria-label="이전 사진">‹</button>}
            <span className="shots-count num">{open + 1} / {count}</span>
            {count > 1 && <button type="button" className="shots-btn" onClick={() => move(1)} aria-label="다음 사진">›</button>}
            <button type="button" ref={closeRef} className="shots-btn shots-close" onClick={close}>닫기</button>
          </div>
        </div>
      )}
    </section>
  );
}
