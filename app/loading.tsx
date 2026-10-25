import PartyLoader from './components/status/PartyLoader';

// 페이지를 불러오는 동안 보이는 화면 (상단 바는 그대로, 본문 자리에 로더)
export default function Loading() {
  return (
    <main className="page">
      <PartyLoader />
    </main>
  );
}
