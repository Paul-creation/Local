'use client';

import { useState } from 'react';
import InfoTip from './InfoTip';

// 상세 "가능한 활동" 칩 — 확정은 전부, 확인 중은 점선 칩(오른쪽 끝에 작은 ⓘ) 3개까지 보이고 나머지는 "+N"으로 펼친다
// ⓘ는 InfoTip — 열린 설명은 한 번에 하나
// 라벨은 서버가 분류표 순서대로 정리해서 넘긴다
const UNSURE_VISIBLE = 3;
const UNSURE_TIP = 'AI가 있을 것으로 판단했지만 공식 설명에서 확인하지 못한 활동이에요';

export default function ActivityChips({ confirmed, unsure }: { confirmed: string[]; unsure: string[] }) {
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState<string | null>(null);
  const shown = open ? unsure : unsure.slice(0, UNSURE_VISIBLE);
  const hidden = unsure.length - UNSURE_VISIBLE;

  return (
    <>
      {confirmed.map((label) => <span key={label} className="activity-chip">{label}</span>)}
      {shown.map((label) => {
        const on = tip === label;
        return (
          <span key={label} className="activity-chip is-unsure">
            {label}
            <InfoTip
              label={`${label}: 확인 중이 무슨 뜻인가요?`}
              text={UNSURE_TIP}
              open={on}
              onOpenChange={(v) => setTip((cur) => (v ? label : cur === label ? null : cur))}
            />
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
