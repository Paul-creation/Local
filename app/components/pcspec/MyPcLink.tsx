'use client';

import type { ReactNode } from 'react';

// /my-pc로 가는 링크 — 지금 보던 주소(경로+검색)를 ?back=으로 실어 보내서 저장 뒤 "돌아가기 →"로 돌아올 수 있게 한다
// 서버가 그린 첫 HTML과 새 탭으로 열기·가운데 클릭은 그냥 /my-pc (돌아가기 없음). 메인 필터가 주소에서 상태를 읽으므로 a(전체 이동)를 쓴다
export default function MyPcLink({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <a
      href="/my-pc"
      className={className}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        window.location.assign(`/my-pc?back=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      }}
    >
      {children}
    </a>
  );
}
