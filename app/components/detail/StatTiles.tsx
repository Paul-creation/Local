import type { ReactNode } from 'react';

// 상세 "한눈에 보기" 타일 — 값이 있는 것만 넘겨 받아 그린다 (3열). 라벨 13px · 값 20px/900 · 보조 13px
export type Tile = { key: string; label: string; value: ReactNode; sub?: ReactNode; valueClass?: string };

export default function StatTiles({ tiles }: { tiles: Tile[] }) {
  if (tiles.length === 0) return null;
  return (
    <ul className="gd-tiles" data-tour="stat-tiles" aria-label="핵심 수치">
      {tiles.map((t) => (
        <li key={t.key} className="gd-tile">
          <span className="gd-tile-label">{t.label}</span>
          <span className={`gd-tile-value${t.valueClass ? ` ${t.valueClass}` : ''}`}>{t.value}</span>
          {t.sub && <span className="gd-tile-sub">{t.sub}</span>}
        </li>
      ))}
    </ul>
  );
}
