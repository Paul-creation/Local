export default function DiscountChart({ data }: { data: { date: string; discount: number }[] }) {
  return (
    <div className="chart-wrap">
      <div className="chart-bars">
        {data.map((d, i) => (
          <div className="chart-bar-col" key={i}>
            <span className={`chart-bar-value ${d.discount > 0 ? 'has-discount' : ''}`}>
              {d.discount > 0 ? `-${d.discount}%` : '정가'}
            </span>
            <div
              className={`chart-bar ${d.discount > 0 ? 'has-discount' : ''}`}
              style={{ height: `${Math.max(d.discount, 6)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="chart-labels">
        {data.map((d, i) => (
          <span className="chart-label" key={i}>{d.date}</span>
        ))}
      </div>
    </div>
  );
}