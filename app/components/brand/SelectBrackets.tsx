import type { ReactNode } from 'react';
import './brand.css';

// 선택 괄호 — 파란 꺾쇠 네 개가 감싼 요소의 네 모서리를 가리킨다 (굵기·길이·벌어진 정도는 brand-tokens.css의 --sb-*, 크기별)
// 서버·클라이언트 어디서든 쓴다 (상태 없음, CSS만). 보이는 때:
//   on        — 늘 보임 (선택된 인원 탭·켜진 필터 칩·값이 들어간 검색 칸·로고)
//   hover     — 가장 가까운 .sb-group 조상(카드 링크 등)에 마우스를 올리거나 키보드 포커스가 오면 바깥에서 안으로 150ms 들어오며 나타남. 움직임 줄이기 설정이면 바로 나타남
export type BracketSize = 'tab' | 'chip' | 'tile' | 'poster' | 'logo';

// 호스트 요소(position: relative) 안에 넣는 괄호 네 개 — 호스트에 .sb-host 클래스를 줄 것
export function BracketCorners({ size, on = false, hover = false }: { size: BracketSize; on?: boolean; hover?: boolean }) {
  return (
    <span className="sb-set" data-size={size} data-on={on || undefined} data-hover={hover || undefined} aria-hidden="true">
      <i className="sb-c tl" /><i className="sb-c tr" /><i className="sb-c bl" /><i className="sb-c br" />
    </span>
  );
}

// 감싸는 형태 — 안쪽 내용(children)의 네 모서리에 괄호를 그린다
export default function SelectBrackets({ size, on = false, hover = false, className, children }: { size: BracketSize; on?: boolean; hover?: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={`sb-host sb-wrap${className ? ` ${className}` : ''}`} data-size={size}>
      {children}
      <BracketCorners size={size} on={on} hover={hover} />
    </span>
  );
}
