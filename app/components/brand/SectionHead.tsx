import Link from 'next/link';
import type { ReactNode } from 'react';
import './brand.css';

// 메인 모든 섹션이 쓰는 공통 머리(Backloggd 식) — 작은 라벨(label) 또는 큰 제목(title) + 오른쪽 "더 보기 →" + 아래 1px 선
// more.hard: 주소의 필터를 새로 읽어야 하는 링크는 Link 대신 a. actions: "더 보기" 앞에 놓을 것(←·→ 버튼 등)
export default function SectionHead({ id, title, label, more, actions }: { id: string; title?: string; label?: string; more?: { href: string; text: string; hard?: boolean }; actions?: ReactNode }) {
  return (
    <div className="sec-head">
      {label && title ? (
        <div className="sec-head-text">
          <p className="sec-label">{label}</p>
          <h2 id={id} className="sec-title">{title}</h2>
        </div>
      ) : <h2 id={id} className={label ? 'sec-label' : 'sec-title'}>{label ?? title}</h2>}
      {(actions || more) && (
        <div className="sec-head-right">
          {actions}
          {more && (more.hard ? <a href={more.href} className="sec-more">{more.text} →</a> : <Link href={more.href} className="sec-more">{more.text} →</Link>)}
        </div>
      )}
    </div>
  );
}
