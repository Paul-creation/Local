import PageSkeleton from './components/status/PageSkeleton';

// 페이지를 불러오는 동안 보이는 화면 (상단 바는 그대로, 본문 자리에 회색 막대)
export default function Loading() {
  return (
    <main className="page">
      <PageSkeleton />
    </main>
  );
}
