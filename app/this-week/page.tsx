import type { Metadata } from 'next';
import BackLink from '../components/BackLink';
import SaleTimeline from '../components/this-week/SaleTimeline';
import { getSaleTimeline } from '../lib/saleTimelineData';

export const revalidate = 300;

export const metadata: Metadata = {
  title: '이번 주 할인 마감',
  description: '앞으로 7일 안에 할인이 끝나는 게임을 날짜별로 모아 봤어요.',
  alternates: { canonical: '/this-week' },
};

export default async function ThisWeekPage() {
  const { items, now } = await getSaleTimeline().catch(() => ({ items: [], now: 0 }));
  return (
    <main className="page">
      <BackLink fallbackHref="/" label="홈으로" />
      <h1 className="section-title tl-title">이번 주 할인 마감</h1>
      <p className="tl-note">앞으로 7일 안에 할인이 끝나는 게임이에요. 종료일이 확인된 할인만 보여줘요.</p>
      <SaleTimeline items={items} serverNow={now || 0} />
    </main>
  );
}
