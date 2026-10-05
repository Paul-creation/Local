'use client';

import { useId, useState } from 'react';

// 필터 그룹 아래 한 줄 안내 — 칩을 호버·포커스·탭하면 그 칩 설명으로 바뀌고, 평소엔 짧은 안내 (상세 태그 안내와 같은 방식)
// bind(키): 칩에 펼쳐 쓰는 핸들러 (클릭은 캡처 단계에서 받아 칩 자체의 onClick과 겹치지 않음)
export function useChipHint(descs: Record<string, string>, fallback: string) {
  const id = useId();
  const [hover, setHover] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const shown = hover ?? focus ?? pinned;

  const bind = (key: string) => ({
    'aria-describedby': id,
    onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') setHover(key); },
    onPointerLeave: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') setHover(null); },
    onFocus: (e: React.FocusEvent<HTMLElement>) => { if (e.currentTarget.matches(':focus-visible')) setFocus(key); },
    onBlur: () => setFocus(null),
    onClickCapture: () => setPinned(key),
  });

  const hint = (
    <p id={id} className={`filter-hint${shown ? ' is-active' : ''}`} aria-live="polite">
      {shown ? <><strong>{shown}</strong> {descs[shown] ?? ''}</> : fallback}
    </p>
  );
  return { bind, hint };
}
