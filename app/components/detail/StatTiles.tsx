import type { ReactNode } from 'react';

// 상세 숫자 타일 — 값이 있는 것만 넘겨 받아 그린다. tone은 정보 종류(평가·접속자·분량·같이 하기·가격)별 강조색
export type Tone = 'review' | 'live' | 'time' | 'party' | 'price';
export type IconName = 'thumb' | 'clock' | 'pulse' | 'peak' | 'hourglass' | 'people' | 'gate' | 'lang' | 'tag' | 'low';
export type Tile = { key: string; tone: Tone; icon: IconName; label: string; value: ReactNode; sub?: ReactNode; valueClass?: string };

const PATHS: Record<IconName, ReactNode> = {
  thumb: <path d="M7 11v9H4v-9h3Zm3 9V10l4-6c1.5 0 2.4 1.2 2 2.6L15.6 9H20a1 1 0 0 1 1 1.2l-1.4 8A2 2 0 0 1 17.6 20H10Z" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  pulse: <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />,
  peak: <path d="M3 18l6-8 4 5 3-4 5 7H3Z" />,
  hourglass: <path d="M7 4h10M7 20h10M8 4c0 4 4 5 4 8s-4 4-4 8M16 4c0 4-4 5-4 8s4 4 4 8" />,
  people: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" /><circle cx="17" cy="9" r="2.4" /><path d="M17 14c2.5 0 4.5 2 4.5 5" /></>,
  gate: <path d="M5 20V8l7-4 7 4v12M9 20v-6h6v6" />,
  lang: <path d="M4 5h9M8.5 3v2M6 5c.5 4 3 7 6.5 8M12 5c-.5 4-3 7-7 9M14 20l4-9 4 9M15.5 17h5" />,
  tag: <path d="M3 12V4h8l10 10-8 8L3 12Zm5-4h.01" />,
  low: <path d="M4 7l6 6 4-4 6 6M20 15v-4M20 15h-4" />,
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg className="dx-tile-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

export default function StatTiles({ tiles }: { tiles: Tile[] }) {
  if (tiles.length === 0) return null;
  return (
    <ul className="dx-tiles" data-tour="stat-tiles" aria-label="핵심 수치">
      {tiles.map((t) => (
        <li key={t.key} className={`dx-tile tone-${t.tone}`}>
          <span className="dx-tile-label"><Icon name={t.icon} />{t.label}</span>
          <span className={`dx-tile-value${t.valueClass ? ` ${t.valueClass}` : ''}`}>{t.value}</span>
          {t.sub && <span className="dx-tile-sub">{t.sub}</span>}
        </li>
      ))}
    </ul>
  );
}
