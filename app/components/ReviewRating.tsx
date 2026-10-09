import { reviewTone } from '../lib/review';

type Props = {
  summary: string | null;
  percent: number | null;
  total: number | null;
  criticScore?: number | null; // 있으면 옆에 작게 "Metascore N" (size="lg"에서만)
  size?: 'sm' | 'lg';
};

// 스팀 평가 — "매우 긍정적 94%" (+ 상세는 리뷰 수·Metascore). 퍼센트가 없으면 아무것도 그리지 않는다
export default function ReviewRating({ summary, percent, total, criticScore, size = 'sm' }: Props) {
  if (!percent) return null;
  const tone = reviewTone(summary);
  return (
    <span className={`rating is-${size}`}>
      <span className={`rating-main is-${tone}`} title={total ? `Steam 리뷰 ${total.toLocaleString('ko-KR')}개` : undefined}>
        {summary && <span className="rating-text">{summary}</span>}
        <span className="rating-pct num">{percent}%</span>
      </span>
      {size === 'lg' && total ? <span className="rating-sub">리뷰 <span className="num">{total.toLocaleString('ko-KR')}</span>개</span> : null}
      {size === 'lg' && criticScore ? <span className="rating-sub">Metascore <span className="num">{Number(criticScore)}</span></span> : null}
    </span>
  );
}
