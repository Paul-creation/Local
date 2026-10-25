import PartyLoader from '../../components/status/PartyLoader';

// 게임 상세를 불러오는 동안 보이는 화면 — 공용 로더 (300ms 안에 끝나면 보이지 않음)
export default function GameDetailLoading() {
  return (
    <main className="page detail-page">
      <PartyLoader />
    </main>
  );
}
