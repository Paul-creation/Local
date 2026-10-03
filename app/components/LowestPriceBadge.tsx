import type { LowestTiming } from '../lib/price';

// 🔥 역대 최저가 / 💰 최저가 근접 배지 — 계산은 lib/price의 getLowestTiming
// overlay: 카드 이미지 위 오른쪽 아래, inline: 가격 옆
export default function LowestPriceBadge({ timing, overlay = false }: { timing: LowestTiming; overlay?: boolean }) {
  if (!timing) return null;
  return (
    <span className={`timing-badge ${timing}${overlay ? ' is-overlay' : ''}`}>
      {timing === 'best' ? '🔥 역대 최저가' : '💰 최저가 근접'}
    </span>
  );
}
