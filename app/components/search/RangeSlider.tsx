// 담당: 친구(검색·태그·비교)
'use client';

import type { Range } from '../../lib/rangeFilter';

// 양쪽 손잡이 범위 슬라이더 — 눈금 번호(0~max)로 동작. 브라우저 기본 range 두 개를 겹쳐서
// 터치·마우스 끌기와 키보드 화살표(Home·End 포함)를 그대로 쓴다. 손잡이는 44px (모바일에서 잡기 쉽게)
export default function RangeSlider({
  title, value, max, minHigh = 0, label, onChange, lowName, highName,
}: {
  title: string;
  value: Range;
  max: number;
  minHigh?: number; // 오른쪽 손잡이 최솟값 (인원은 1명 이상)
  label: (i: number) => string;
  onChange: (r: Range) => void;
  lowName: string;
  highName: string;
}) {
  const [lo, hi] = value;
  const setLow = (v: number) => onChange([Math.min(v, hi), hi]);
  const setHigh = (v: number) => onChange([lo, Math.max(v, lo, minHigh)]);
  // 두 손잡이가 겹쳤을 때 끝 쪽에 붙어 있으면 왼쪽 손잡이를 위로 (오른쪽 끝에서 왼쪽 손잡이를 꺼낼 수 있게)
  const lowOnTop = lo === hi && lo > max / 2;

  return (
    <div className="range-field">
      <div className="range-head">
        <span className="range-title">{title}</span>
        <span className="range-value" aria-live="polite">{label(lo)} ~ {label(hi)}</span>
      </div>
      <div className="range-slider">
        <div className="range-track" aria-hidden="true">
          <div
            className="range-fill"
            style={{ left: `${(lo / max) * 100}%`, width: `${((hi - lo) / max) * 100}%` }}
          />
        </div>
        <input
          type="range" min={0} max={max} step={1} value={lo}
          onChange={(e) => setLow(Number(e.target.value))}
          aria-label={lowName} aria-valuetext={label(lo)}
          style={{ zIndex: lowOnTop ? 3 : 2 }}
        />
        <input
          type="range" min={0} max={max} step={1} value={hi}
          onChange={(e) => setHigh(Number(e.target.value))}
          aria-label={highName} aria-valuetext={label(hi)}
          style={{ zIndex: lowOnTop ? 2 : 3 }}
        />
      </div>
      <div className="range-ends" aria-hidden="true">
        <span>{label(0)}</span>
        <span>{label(max)}</span>
      </div>
    </div>
  );
}
