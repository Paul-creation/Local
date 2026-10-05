'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDate } from '../lib/date';

type PriceRecord = { price: number; discount_percent: number | null; checked_at: string };
type Point = { t: number; price: number; discount: number };

const DAY = 24 * 60 * 60 * 1000;
const PERIODS = [
  { key: '6m', label: '6개월', days: 183, summary: '최근 6개월' },
  { key: '1y', label: '1년', days: 365, summary: '최근 1년' },
  { key: 'all', label: '전체', days: 0, summary: '전체 기간' },
] as const;
type PeriodKey = (typeof PERIODS)[number]['key'];

const HEIGHT = 180;
const PAD = { top: 14, right: 12, bottom: 28, left: 64 };

// 서버(UTC)와 브라우저 시간대가 달라도 같은 글자가 나오게 한국 시간으로 고정
const kst = (t: number) => {
  const d = new Date(t + 9 * 60 * 60 * 1000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
};
const won = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`;

// 실제 값보다 위아래로 튀지 않는 부드러운 곡선 (monotone cubic, d3의 curveMonotoneX와 같은 방식)
function monotonePath(pts: { x: number; y: number }[]) {
  const n = pts.length;
  if (n < 2) return '';
  if (n === 2) return `M${pts[0].x},${pts[0].y}L${pts[1].x},${pts[1].y}`;
  const dx = pts.slice(1).map((p, i) => p.x - pts[i].x);
  const slope = pts.slice(1).map((p, i) => (dx[i] === 0 ? 0 : (p.y - pts[i].y) / dx[i]));
  const tan = pts.map((_, i) => {
    if (i === 0) return slope[0];
    if (i === n - 1) return slope[n - 2];
    const a = slope[i - 1], b = slope[i];
    if (a * b <= 0) return 0;
    const h0 = dx[i - 1], h1 = dx[i];
    return (3 * (h0 + h1)) / ((2 * h1 + h0) / a + (h1 + 2 * h0) / b);
  });
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${pts[i].x + h},${pts[i].y + tan[i] * h},${pts[i + 1].x - h},${pts[i + 1].y - tan[i + 1] * h},${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
}

export default function DiscountChart({ history, now }: { history: PriceRecord[]; now: number }) {
  const [period, setPeriod] = useState<PeriodKey>('1y');
  const [active, setActive] = useState<Point | null>(null);
  const [width, setWidth] = useState(600);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 실제 너비로 그려야 글자·점이 늘어나지 않는다
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const all = useMemo<Point[]>(
    () => history
      .map((r) => ({ t: new Date(r.checked_at).getTime(), price: r.price, discount: r.discount_percent || 0 }))
      .sort((a, b) => a.t - b.t),
    [history],
  );

  const conf = PERIODS.find((p) => p.key === period)!;
  const points = conf.days ? all.filter((p) => p.t >= now - conf.days * DAY) : all;

  // 할인 횟수는 할인이 시작된 지점만 센다 (할인 중 기록이 이어지면 1회)
  const starts = points.filter((p, i) => p.discount > 0 && (i === 0 || points[i - 1].discount === 0));
  const maxDiscount = Math.max(0, ...points.map((p) => p.discount));
  const lowest = points.length ? Math.min(...points.map((p) => p.price)) : 0;
  const regular = points.length ? Math.max(...points.map((p) => p.price)) : 0;
  const lastStart = starts[starts.length - 1];

  const summary = !points.length
    ? `${conf.summary} 가격 기록 없음`
    : starts.length === 0
      ? `${conf.summary} 할인 없음 · ${period === 'all' ? '역대 ' : ''}최저 ${won(lowest)}`
      : [
          `${conf.summary} 할인 ${starts.length}회`,
          `최대 ${maxDiscount}%`,
          `${period === 'all' ? '역대 ' : ''}최저 ${won(lowest)}`,
          `마지막 할인 ${kst(lastStart.t).m}월 ${kst(lastStart.t).d}일`,
        ].join(' · ');

  // 좌표
  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const t0 = points[0]?.t ?? 0;
  const t1 = points[points.length - 1]?.t ?? 1;
  const span = Math.max(t1 - t0, 1);
  const yPad = Math.max((regular - lowest) * 0.12, regular * 0.04, 1);
  const yMin = lowest - yPad;
  const yMax = regular + yPad;
  const x = (t: number) => PAD.left + ((t - t0) / span) * innerW;
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * innerH;

  const xy = points.map((p) => ({ x: x(p.t), y: y(p.price) }));
  const line = monotonePath(xy);
  const area = line && `${line}L${xy[xy.length - 1].x},${PAD.top + innerH}L${xy[0].x},${PAD.top + innerH}Z`;
  const dots = points.filter((p) => p.discount > 0);
  // 빨간 점은 최저가 지점 하나만 (가장 최근의 최저가), 마우스·터치로 고른 지점은 포인트 색 점
  const lowestPoint = [...points].reverse().find((p) => p.price === lowest) || null;

  // 가로축 날짜 3~4개 ("25.11"). 기간이 짧아 같은 달만 나오면 "11.3"처럼 일까지
  const ticks = (() => {
    const count = width < 420 ? 3 : 4;
    const ts = Array.from({ length: count }, (_, i) => t0 + (span * i) / (count - 1));
    const ym = (t: number) => { const k = kst(t); return `${String(k.y).slice(2)}.${String(k.m).padStart(2, '0')}`; };
    const md = (t: number) => { const k = kst(t); return `${k.m}.${k.d}`; };
    const fmt = new Set(ts.map(ym)).size === ts.length ? ym : md;
    const seen = new Set<string>();
    return ts.map((t) => ({ t, label: fmt(t) })).filter((tk) => !seen.has(tk.label) && !!seen.add(tk.label));
  })();

  // 마우스·탭 위치에서 가장 가까운 할인 점 (가로 28px 안)
  const pick = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || !dots.length) return null;
    const px = clientX - rect.left;
    let best: Point | null = null;
    let bestD = 28;
    for (const p of dots) {
      const d = Math.abs(x(p.t) - px);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  };

  const tipLeft = active ? Math.min(Math.max(x(active.t), 70), width - 70) : 0;
  const tipAbove = active ? y(active.price) > PAD.top + 56 : true;

  return (
    <div className="dchart">
      <div className="dchart-head">
        <p className="dchart-summary">{summary}</p>
        <div className="dchart-periods" role="group" aria-label="기간 선택">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={period === p.key}
              className={period === p.key ? 'is-on' : ''}
              onClick={() => { setPeriod(p.key); setActive(null); }}
              style={{ minHeight: 40 }}
            >{p.label}</button>
          ))}
        </div>
      </div>

      <div ref={wrapRef} className="dchart-plot">
        {points.length < 2 ? (
          <div className="dchart-empty">이 기간엔 가격 변동이 없어요</div>
        ) : (
          <>
            <svg
              width={width}
              height={HEIGHT}
              role="img"
              aria-label={summary}
              onPointerMove={(e) => { if (e.pointerType === 'mouse') setActive(pick(e.clientX)); }}
              onPointerLeave={(e) => { if (e.pointerType === 'mouse') setActive(null); }}
              onPointerDown={(e) => { if (e.pointerType !== 'mouse') setActive(pick(e.clientX)); }}
            >
              {/* 세로축: 정가·최저가만 */}
              {[regular, lowest].filter((v, i, arr) => arr.indexOf(v) === i).map((v) => (
                <g key={v}>
                  <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} className="dchart-grid" />
                  <text x={PAD.left - 8} y={y(v)} className="dchart-ylabel" textAnchor="end" dominantBaseline="middle">{won(v)}</text>
                </g>
              ))}
              {ticks.map((tk, i) => (
                <text
                  key={tk.label}
                  x={x(tk.t)}
                  y={HEIGHT - 8}
                  className="dchart-xlabel"
                  textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'}
                >{tk.label}</text>
              ))}
              <path d={area} className="dchart-area" />
              <path d={line} className="dchart-line" />
              {active && active !== lowestPoint && <circle cx={x(active.t)} cy={y(active.price)} r={5} className="dchart-dot-active" />}
              {lowestPoint && <circle cx={x(lowestPoint.t)} cy={y(lowestPoint.price)} r={active === lowestPoint ? 6 : 4.5} className="dchart-dot" />}
            </svg>

            {active && (
              <div
                className="dchart-tip"
                style={{
                  left: tipLeft,
                  top: tipAbove ? y(active.price) - 10 : y(active.price) + 10,
                  transform: `translate(-50%, ${tipAbove ? '-100%' : '0'})`,
                }}
              >
                <div className="dchart-tip-date">{formatDate(active.t)}</div>
                <div><strong>{won(active.price)}</strong> <span className="dchart-tip-off">-{active.discount}%</span></div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
