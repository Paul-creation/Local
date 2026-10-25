'use client';

import { useEffect, useRef, type ReactNode } from 'react';

// 메인 커맨드바 아래에 뜨는 필터 패널 껍데기 — 열리면 포커스가 패널로 가고, 바깥 클릭·Esc·× 버튼으로 닫히면 포커스가 "필터" 버튼으로 돌아온다
// 모양(떠 있는 패널 / 휴대폰 아래 시트)은 mn.css(.filter-wrap.is-float). 안 내용(FilterPanel)과 동작은 그대로
export default function FilterFloat({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const toggle = document.querySelector<HTMLElement>('.mn-cmd .filter-toggle');
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || toggle?.contains(t)) return; // 패널 안·"필터" 버튼(스스로 열고 닫음)은 제외
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      toggle?.focus({ preventScroll: true }); // 닫히면 필터 버튼으로
    };
  }, [onClose]);
  return <div ref={ref} className="filter-wrap is-float" tabIndex={-1}>{children}</div>;
}
