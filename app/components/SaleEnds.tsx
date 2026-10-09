'use client';

// 할인 종료 시각 한 줄 — 가격이 나오는 모든 곳(카드·행·찜·상세)이 같이 쓴다. 할인 줄 바로 아래에 둔다
// "오늘/내일"은 보는 시점 기준이라 브라우저에서 계산한다 (5분 캐시된 서버 화면에는 시각을 박지 않음).
// 서버 화면에서는 아직 안 지난 종료일이면 한 줄 높이만 비워 두어, 채워질 때 카드가 밀리지 않게 한다
import { useEffect, useState } from 'react';
import { saleEndsLabel, saleEndsDetail } from '../lib/saleEnds';

export default function SaleEnds({ endsAt, variant = 'card' }: { endsAt?: string | null; variant?: 'card' | 'detail' }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); }, []);
  if (!endsAt) return null;
  const fmt = variant === 'detail' ? saleEndsDetail : saleEndsLabel;
  if (now == null) return Number.isFinite(new Date(endsAt).getTime()) && new Date(endsAt).getTime() > Date.now() ? <span className={`sale-ends is-${variant}`} aria-hidden="true" /> : null;
  const label = fmt(endsAt, now);
  if (!label) return null;
  return <span className={`sale-ends is-${variant}${label.soon ? ' is-soon' : ''}`}>{label.text}</span>;
}
