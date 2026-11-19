import type { Metadata } from 'next';
import FeedbackForm from '../components/feedback/FeedbackForm';
import '../brand-tokens.css';
import '../mono-page.css';
import '../mono-static.css';

export const metadata: Metadata = {
  title: '의견 보내기',
  description: '버그, 잘못된 인원·게임 정보, 있었으면 하는 기능을 알려주세요.',
  alternates: { canonical: '/feedback' },
};

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ from?: string; kind?: string }> }) {
  const { from, kind } = await searchParams;
  return (
    <main className="page cm-page mn mn-inner">
      <div className="fb-wrap">
        <p className="sec-label">의견 보내기</p>
        <h1 className="fb-title">친구랑 할 게임 찾다가<br />불편했던 거 알려주세요</h1>
        <p className="fb-sub">세 명이서 직접 읽고 고쳐요. 로그인 없이 보내도 돼요.</p>
        <FeedbackForm from={from} initialKind={kind} />
      </div>
    </main>
  );
}
