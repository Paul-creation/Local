'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import glossary from '../../lib/tag-glossary.json';
import { translateTag } from '../../lib/tagTranslate';

const GLOSSARY = glossary as Record<string, string>;

export function getTagDescription(tag: string): string {
  return (GLOSSARY[tag] || GLOSSARY[translateTag(tag)] || '').trim();
}

// 태그 칩 오른쪽 위 ? — 호버(마우스)·탭·키보드 포커스로 설명(최대 2줄)을 띄움. 설명이 없으면 아무것도 안 그림
export default function TagHelp({ tag }: { tag: string }) {
  const desc = getTagDescription(tag);
  const id = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || focused || pinned;

  const close = () => { setHovered(false); setFocused(false); setPinned(false); };

  // 바깥을 누르거나 Esc, 스크롤하면 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, { passive: true });
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  // 화면 밖으로 나가지 않게 위치 계산 (아래 공간이 모자라면 위로). 그리기 전에 DOM에 바로 적용
  useLayoutEffect(() => {
    const el = popRef.current;
    const b = btnRef.current?.getBoundingClientRect();
    if (!open || !el || !b) return;
    const p = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const M = 8;
    const left = Math.min(Math.max(M, b.left + b.width / 2 - p.width / 2), vw - p.width - M);
    const below = b.bottom + 6;
    const top = below + p.height > vh - M ? Math.max(M, b.top - 6 - p.height) : below;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.visibility = 'visible';
  }, [open]);

  if (!desc) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="tag-help-btn"
        aria-label={`${translateTag(tag)} 설명`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHovered(true); }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHovered(false); }}
        onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) setFocused(true); }}
        onBlur={() => setFocused(false)}
        onClick={(e) => { e.stopPropagation(); setPinned((v) => !v); }}
      >?</button>
      {open && (
        <div
          ref={popRef}
          id={id}
          role="tooltip"
          className="tag-help-pop"
          style={{ left: 0, top: 0, visibility: 'hidden' }}
        >
          <span className="tag-help-text">{desc}</span>
        </div>
      )}
    </>
  );
}
