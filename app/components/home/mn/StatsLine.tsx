import type { HomeStats } from '../../../lib/homeMain';

// "N인 추천 게임" 머리 위 작은 현황 한 줄 — "1,672개 게임 비교 중 · 오늘 181개 할인 · 36개 출시 예정" (숫자는 실제 데이터, Inter 900 --brand-ink / 나머지 --ink-muted). 읽지 못한 값은 그 칸만 뺀다
const nf = new Intl.NumberFormat('ko-KR');
const PARTS: { key: keyof HomeStats; before?: string; after: string }[] = [
  { key: 'games', after: '개 게임 비교 중' },
  { key: 'sale', before: '오늘 ', after: '개 할인' },
  { key: 'soon', after: '개 출시 예정' },
];

export default function StatsLine({ stats }: { stats: HomeStats }) {
  const shown = PARTS.filter((p) => stats[p.key] != null);
  if (!shown.length) return null;
  return (
    <p className="mn-stat-line">
      {shown.map((p, i) => (
        <span key={p.key}>
          {i > 0 && <span className="mn-stat-dot" aria-hidden="true"> · </span>}
          {p.before}<b>{nf.format(stats[p.key]!)}</b>{p.after}
        </span>
      ))}
    </p>
  );
}
