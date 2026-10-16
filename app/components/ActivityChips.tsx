'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

// 상세 "가능한 활동" 칩 — 확정은 전부, 확인 중은 흐린 칩("?"로 끝남) 3개까지 보이고 나머지는 "+N"으로 펼친다
// "확인 중" 옆 ⓘ: 마우스를 올리거나 키보드로 포커스하면 설명이 뜨고, 터치에서는 눌러서 열고 닫는다(바깥을 누르거나 Esc로도 닫힘)
// 라벨은 서버가 분류표 순서대로 정리해서 넘긴다
const UNSURE_VISIBLE = 3;
const UNSURE_TIP = 'AI가 있을 것으로 판단했지만 공식 설명에서 확인하지 못한 활동이에요';

export default function ActivityChips({ confirmed, unsure }: { confirmed: string[]; unsure: string[] }) {
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const tipId = useId();
  const shown = open ? unsure : unsure.slice(0, UNSURE_VISIBLE);
  const hidden = unsure.length - UNSURE_VISIBLE;

  useEffect(() => {
    if (!tip) return;
    const close = (e: Event) => { if (e instanceof KeyboardEvent ? e.key === 'Escape' : !wrap.current?.contains(e.target as Node)) setTip(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [tip]);

  // 말풍선이 화면 밖으로 나가면 안쪽으로 민다 (칩 줄이 화면 오른쪽에 있어도 375px에서 잘리지 않게)
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
      {unsure.length > 0 && (
        <>
          <span className="activity-unsure-label">
            확인 중
            <span ref={wrap} className={`activity-info${tip ? ' is-open' : ''}`}>
              <button type="button" className="activity-info-btn" aria-label="확인 중이 무슨 뜻인가요?" aria-describedby={tipId} aria-expanded={tip} onClick={() => setTip((v) => !v)}>ⓘ</button>
              <span ref={bubble} id={tipId} role="tooltip" className="activity-info-tip">{UNSURE_TIP}</span>
            </span>
          </span>
          {shown.map((label) => <span key={label} className="activity-chip is-unsure">{label}?</span>)}
          {hidden > 0 && !open && (
            <button type="button" className="activity-chip is-unsure activity-more" aria-expanded={false} onClick={() => setOpen(true)}>
              +{hidden}
            </button>
          )}
        </>
      )}
    </>
  );
}
