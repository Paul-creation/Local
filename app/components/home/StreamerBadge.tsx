'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// 스트리머 이름 칩 — 이름마다 칩 하나, 남은 인원은 마지막에 "+N명" 칩 (모양: globals.css .sc-chip)
// max: 카드(기획전·지금 뜨는 게임) 2, 순위 행 1. 한 줄 고정 — 칸이 좁으면 뒤쪽 이름 칩을 빼고 "+N명"으로 합친다 (글자를 자르지 않음)
// 칩 폭은 처음 한 번 재서 기억하고, 칸 폭이 바뀔 때마다 그 폭으로 몇 개까지 들어가는지만 다시 계산한다
const GAP = 4;
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export default function StreamerBadge({ names, max }: { names?: string[]; max: number }) {
  const list = names ?? [];
  const cap = Math.min(max, list.length);
  const [shown, setShown] = useState(cap);
  const rowRef = useRef<HTMLSpanElement>(null);
  const widths = useRef<{ names: number[]; plus: number } | null>(null);

  const fit = useCallback(() => {
    const row = rowRef.current;
    if (!row || cap === 0) return;
    if (!widths.current) {
      const chips = [...row.querySelectorAll<HTMLElement>('[data-sc]')];
      const probe = row.querySelector<HTMLElement>('[data-sc-probe]');
      if (chips.length < cap || !probe || !chips[0].offsetWidth) return;
      widths.current = { names: chips.slice(0, cap).map((c) => c.offsetWidth), plus: probe.offsetWidth };
    }
    const w = widths.current;
    const room = row.clientWidth;
    let k = cap;
    for (; k > 0; k--) {
      const used = w.names.slice(0, k).reduce((a, b) => a + b, 0) + GAP * (k - 1);
      const rest = list.length - k;
      if (used + (rest > 0 ? GAP + w.plus : 0) <= room) break;
    }
    setShown(k);
  }, [cap, list.length]);

  useIsoLayoutEffect(() => {
    widths.current = null;
    fit();
    const row = rowRef.current;
    if (!row) return;
    const ro = new ResizeObserver(fit);
    ro.observe(row);
    // 글꼴이 늦게 도착하면 칩 폭이 달라지므로 다시 잰다
    document.fonts?.ready.then(() => { widths.current = null; fit(); });
    return () => ro.disconnect();
  }, [fit, list.join('|')]);

  if (!list.length) return null;
  const rest = list.length - shown;
  return (
    <span className="sc-row" ref={rowRef} aria-label={`${list.join(', ')} 플레이`}>
      {list.slice(0, cap).map((n, i) => (
        <span key={n} data-sc className={`sc-chip${i < shown ? '' : ' is-off'}`}>{n}</span>
      ))}
      {rest > 0 && <span className="sc-chip sc-more">+{rest}명</span>}
      <span data-sc-probe className="sc-chip sc-more is-off" aria-hidden="true">+{list.length}명</span>
    </span>
  );
}
