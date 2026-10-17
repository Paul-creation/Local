'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

// 작은 ⓘ 버튼 + 설명 말풍선 — 마우스를 올리거나 키보드로 포커스하면 뜨고, 터치에서는 눌러서 열고 닫는다(바깥을 누르거나 Esc로도 닫힘)
// open·onOpenChange를 넘기면 부모가 상태를 쥐고(칩 여러 개 중 하나만 열기), 안 넘기면 혼자 상태를 가진다
export default function InfoTip({ label, text, open, onOpenChange }: {
  label: string;
  text: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [inner, setInner] = useState(false);
  const on = open ?? inner;
  const set = (v: boolean | ((cur: boolean) => boolean)) => {
    const next = typeof v === 'function' ? v(on) : v;
    if (open === undefined) setInner(next);
    onOpenChange?.(next);
  };
  const bubble = useRef<HTMLSpanElement>(null);
  const pointer = useRef('');
  const id = useId();

  useEffect(() => {
    if (!on) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent) { if (e.key === 'Escape') set(false); }
      else if (!(e.target as Element | null)?.closest?.('.activity-info')) set(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  // 말풍선이 화면 밖으로 나가면 안쪽으로 민다 (375px에서 잘리지 않게)
  useLayoutEffect(() => {
    const b = bubble.current;
    if (!b) return;
    b.style.transform = '';
    const r = b.getBoundingClientRect();
    const over = r.right - (window.innerWidth - 16);
    if (over > 0) b.style.transform = `translateX(${-over}px)`;
    else if (r.left < 16) b.style.transform = `translateX(${16 - r.left}px)`;
  }, [on]);

  return (
    <span className={`activity-info${on ? ' is-open' : ''}`}>
      <button
        type="button"
        className="activity-info-btn"
        aria-label={label}
        aria-describedby={on ? id : undefined}
        aria-expanded={on}
        onPointerDown={(e) => { pointer.current = e.pointerType; }}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') set(true); }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') set(false); }}
        onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) set(true); }}
        onBlur={() => set(false)}
        onClick={() => { if (pointer.current === 'mouse') { pointer.current = ''; return; } pointer.current = ''; set((v) => !v); }}
      >ⓘ</button>
      {on && <span ref={bubble} id={id} role="tooltip" className="activity-info-tip">{text}</span>}
    </span>
  );
}
