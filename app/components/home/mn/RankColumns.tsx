'use client';

import { useState, type ReactNode } from 'react';

// 메인 순위 3개(인기 차트·출시 예정·다시 뜨는 중) — 데스크톱은 3단으로 나란히(탭 막대는 CSS로 숨김, 패널은 display: contents),
// 휴대폰(767px 이하)은 탭 하나로 합쳐 고른 목록만 보인다 (docs/design/mobile MobMain). 패널은 서버가 그린 목록을 그대로 받는다
export default function RankColumns({ titles, panels }: { titles: string[]; panels: ReactNode[] }) {
  const [active, setActive] = useState(0);
  return (
    <div className="mn-cols">
      <div className="mn-rank-tabs" role="tablist" aria-label="순위 보기">
        {titles.map((t, i) => (
          <button key={t} type="button" role="tab" id={`mn-rank-tab-${i}`} aria-selected={active === i} aria-controls={`mn-rank-panel-${i}`} className="mn-rank-tab" onClick={() => setActive(i)}>{t}</button>
        ))}
      </div>
      {panels.map((p, i) => (
        <div key={titles[i]} id={`mn-rank-panel-${i}`} role="tabpanel" aria-labelledby={`mn-rank-tab-${i}`} className={`mn-col-panel${active === i ? ' is-active' : ''}`}>{p}</div>
      ))}
    </div>
  );
}
