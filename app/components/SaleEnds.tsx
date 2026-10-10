'use client';

// 할인 종료 시각 — 가격이 나오는 모든 곳(카드·행·찜·상세)이 같이 쓴다. 카드는 할인 줄 오른쪽에 " · 10/14 02:00까지"(자리가 모자라면 다음 줄로), 행·상세는 할인 줄 아래
// "오늘/내일"은 보는 시점 기준이라 브라우저에서 계산한다 (5분 캐시된 서버 화면에는 시각을 박지 않음).
// 상세는 서버 화면에서 한 줄 높이만 비워 두어 채워질 때 밀리지 않게 하고, 카드는 같은 줄에 붙으므로 비워 둘 것이 없다
import { useEffect, useState } from 'react';
import { saleEndsLabel, saleEndsDetail, saleEndsShort } from '../lib/saleEnds';

export default function SaleEnds({ endsAt, variant = 'card' }: { endsAt?: string | null; variant?: 'card' | 'row' | 'short' | 'detail' }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); }, []);
  if (!endsAt) return null;
  const fmt = variant === 'detail' ? saleEndsDetail : variant === 'short' ? saleEndsShort : saleEndsLabel;
  if (now == null) return variant !== 'detail' ? null : Number.isFinite(new Date(endsAt).getTime()) && new Date(endsAt).getTime() > Date.now() ? <span className={`sale-ends is-${variant}`} aria-hidden="true" /> : null;
  const label = fmt(endsAt, now);
  if (!label) return null;
  return <span className={`sale-ends is-${variant}${label.soon ? ' is-soon' : ''}`}>{variant === 'card' ? '· ' : ''}{label.text}</span>;
}
