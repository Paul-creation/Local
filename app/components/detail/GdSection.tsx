import type { ReactNode } from 'react';

// 게임 상세 섹션 한 칸 — 머리(제목 24px/900 + 아래 1px 선, padding-bottom 12, margin-bottom 18)와 본문. 머리 오른쪽(right)은 링크 같은 보조 요소
// 서버·클라이언트 컴포넌트 모두에서 쓴다 (스타일은 app/games/[id]/game-detail.css)
export default function GdSection({ title, right, label, id, children }: { title: string; right?: ReactNode; label?: string; id?: string; children: ReactNode }) {
  return (
    <section className="gd-sec" aria-label={label ?? title} id={id}>
      <div className="gd-sec-head">
        <h2 className="gd-sec-title">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}
