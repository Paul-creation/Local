'use client';

import { useState } from 'react';

// 상세 "가능한 활동" 칩 — 확정은 전부, 확인 중은 흐린 칩 3개까지 보이고 나머지는 "+N"으로 펼친다
// 라벨은 서버가 분류표 순서대로 정리해서 넘긴다
const UNSURE_VISIBLE = 3;

export default function ActivityChips({ confirmed, unsure }: { confirmed: string[]; unsure: string[] }) {
  const [open, setOpen] = useState(false);
  const shown = open ? unsure : unsure.slice(0, UNSURE_VISIBLE);
  const hidden = unsure.length - UNSURE_VISIBLE;

  return (
    <>
      {confirmed.map((label) => <span key={label} className="activity-chip">{label}</span>)}
      {unsure.length > 0 && (
        <>
          <span className="activity-unsure-label">확인 중</span>
          {shown.map((label) => <span key={label} className="activity-chip is-unsure">{label}</span>)}
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
