import type { Metadata } from 'next';
import FeedbackForm from '../components/feedback/FeedbackForm';

export const metadata: Metadata = {
  title: '의견 보내기',
  description: '버그, 잘못된 인원·게임 정보, 있었으면 하는 기능을 알려주세요.',
  alternates: { canonical: '/feedback' },
};

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ from?: string; kind?: string }> }) {
  const { from, kind } = await searchParams;
  return (
    <main className="page cm-page">
      <h1 className="cm-h1">의견 보내기</h1>
      <p className="cm-sub">버그, 잘못된 인원·게임 정보, 있었으면 하는 기능 — 무엇이든 알려주세요. 로그인 없이 보낼 수 있어요.</p>
      <FeedbackForm from={from} initialKind={kind} />
    </main>
  );
}
