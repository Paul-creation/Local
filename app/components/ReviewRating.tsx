import { reviewTone } from '../lib/review';

type Props = {
  summary: string | null;
  percent: number | null;
  total: number | null;
  extras?: string[]; // size="lg" 보조 줄 — "Metascore 82", "현재 1,234명"처럼 이미 글자로 만든 조각. 리뷰 수 뒤에 " · "로 이어 붙임
  size?: 'sm' | 'lg';
  showText?: boolean; // false면 평가 문구(매우 긍정적 등)는 빼고 퍼센트만 — 색은 문구 기준 그대로
  label?: string;     // 퍼센트 앞에 붙이는 출처 글자 ("스팀") — 문구를 뺀 자리에서 무슨 평가인지 알려 줌
};

// 스팀 평가 — "매우 긍정적 94%". 상세(lg)는 뒤에 보조 한 덩어리 "리뷰 N개 · Metascore N · 현재 N명 …"를 같은 기준선에 둔다
// 퍼센트가 없으면 sm은 아무것도 그리지 않고, lg는 보조 조각만 그린다
export default function ReviewRating({ summary, percent, total, extras = [], size = 'sm', showText = true, label }: Props) {
  const tone = reviewTone(summary);
  const main = percent ? (
    <span className={`rating-main is-${tone}`} title={total ? `Steam 리뷰 ${total.toLocaleString('ko-KR')}개` : undefined}>
      {summary && showText && <span className="rating-text">{summary}</span>}
      {label && <span className="rating-label">{label}</span>}
      <span className="rating-pct num">{percent}%</span>
    </span>
  ) : null;
  if (size === 'sm') return main ? <span className="rating is-sm">{main}</span> : null;

  const subs = [percent && total ? `리뷰 ${total.toLocaleString('ko-KR')}개` : '', ...extras].filter(Boolean);
  if (!main && subs.length === 0) return null;
  return (
    <span className="rating is-lg">
      {main}
      {subs.length > 0 && <span className="rating-sub num">{subs.join(' · ')}</span>}
    </span>
  );
}
