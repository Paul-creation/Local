export default function DiscountChart({ data }: { data: { date: string; discount: number }[] }) {
  const width = 600;
  const height = 140;
  const padding = 20;
  const max = 100;
  const stepX = (width - padding * 2) / (data.length - 1);

  const points = data.map((d, i) => {
    const x = padding + i * stepX;
    const y = height - padding - (d.discount / max) * (height - padding * 2);
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" preserveAspectRatio="none">
        <path d={areaPath} className="chart-area" />
        <path d={linePath} className="chart-line" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="4"
            className={`chart-dot ${p.discount > 0 ? 'has-discount' : ''}`}
          />
        ))}
      </svg>
      <div className="chart-labels">
        {data.map((d, i) => (
          <span className="chart-label" key={i}>
            {d.date}<br />
            <strong className={d.discount > 0 ? 'has-discount' : ''}>
              {d.discount > 0 ? `-${d.discount}%` : '정가'}
            </strong>
          </span>
        ))}
      </div>
    </div>
  );
}