'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

// 상세 "가능한 활동" 칩 — 확정은 전부, 확인 중은 점선 칩(오른쪽 끝에 작은 ⓘ) 3개까지 보이고 나머지는 "+N"으로 펼친다
// ⓘ: 마우스를 올리거나 키보드로 포커스하면 설명이 뜨고, 터치에서는 눌러서 열고 닫는다(바깥을 누르거나 Esc로도 닫힘). 열린 설명은 한 번에 하나
// 라벨은 서버가 분류표 순서대로 정리해서 넘긴다
const UNSURE_VISIBLE = 3;
const UNSURE_TIP = 'AI가 있을 것으로 판단했지만 공식 설명에서 확인하지 못한 활동이에요';

export default function ActivityChips({ confirmed, unsure }: { confirmed: string[]; unsure: string[] }) {
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState<string | null>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const pointer = useRef('');
  const baseId = useId();
  const shown = open ? unsure : unsure.slice(0, UNSURE_VISIBLE);
  const hidden = unsure.length - UNSURE_VISIBLE;

  useEffect(() => {
    if (!tip) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent) { if (e.key === 'Escape') setTip(null); }
      else if (!(e.target as Element | null)?.closest?.('.activity-info')) setTip(null);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [tip]);

  // 말풍선이 화면 밖으로 나가면 안쪽으로 민다 (375px에서 잘리지 않게)
  useLayoutEffect(() => {
    const b = bubble.current;
    if (!b) return;
    b.style.transform = '';
    const r = b.getBoundingClientRect();
    const over = r.right - (window.innerWidth - 16);
    if (over > 0) b.style.transform = `translateX(${-over}px)`;
    else if (r.left < 16) b.style.transform = `translateX(${16 - r.left}px)`;
  }, [tip]);

  return (
    <>
      {confirmed.map((label) => <span key={label} className="activity-chip">{label}</span>)}
      {shown.map((label) => {
        const id = `${baseId}-${label}`;
        const on = tip === label;
        return (
          <span key={label} className="activity-chip is-unsure">
            {label}
            <span className={`activity-info${on ? ' is-open' : ''}`}>
              <button
                type="button"
                className="activity-info-btn"
                aria-label={`${label}: 확인 중이 무슨 뜻인가요?`}
                aria-describedby={on ? id : undefined}
                aria-expanded={on}
                onPointerDown={(e) => { pointer.current = e.pointerType; }}
                onPointerEnter={(e) => { if (e.pointerType === 'mouse') setTip(label); }}
                onPointerLeave={(e) => { if (e.pointerType === 'mouse') setTip((v) => (v === label ? null : v)); }}
                onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) setTip(label); }}
                onBlur={() => setTip((v) => (v === label ? null : v))}
                onClick={() => { if (pointer.current === 'mouse') { pointer.current = ''; return; } pointer.current = ''; setTip((v) => (v === label ? null : label)); }}
              >ⓘ</button>
              {on && <span ref={bubble} id={id} role="tooltip" className="activity-info-tip">{UNSURE_TIP}</span>}
            </span>
          </span>
        );
      })}
      {unsure.length > 0 && hidden > 0 && !open && (
        <button type="button" className="activity-chip is-unsure activity-more" aria-expanded={false} onClick={() => setOpen(true)}>
          +{hidden}
        </button>
      )}
    </>
  );
}
