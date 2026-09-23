export default function PlayerChart({ data }: { data: { player_count: number; recorded_at: string }[] }) {
  const sorted = [...data]
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
    .slice(-30); // 최근 30일

  if (sorted.length < 2) return null;

  const max = Math.max(...sorted.map((d) => d.player_count));
  const width = 600;
  const height = 120;
  const pad = 16;

  const stepX = (width - pad * 2) / (sorted.length - 1);
  const points = sorted.map((d, i) => ({
    x: pad + i * stepX,
    y: height - pad - ((d.player_count / max) * (height - pad * 2)),
    count: d.player_count,
    date: new Date(d.recorded_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - pad} L ${points[0].x} ${height - pad} Z`;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" preserveAspectRatio="none">
        <path d={areaPath} fill="rgba(15,155,142,0.1)" />
        <path d={linePath} fill="none" stroke="var(--teal)" strokeWidth="2.5" />
        {[points[0], points[Math.floor(points.length / 2)], points[points.length - 1]].map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill="var(--bg-card)" stroke="var(--teal)" strokeWidth="2" />
        ))}
      </svg>
      <div className="chart-labels">
        {[points[0], points[Math.floor(points.length / 2)], points[points.length - 1]].map((p, i) => (
          <span className="chart-label" key={i}>
            {p.date}<br />
            <strong style={{ color: 'var(--teal)' }}>{p.count.toLocaleString('ko-KR')}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}