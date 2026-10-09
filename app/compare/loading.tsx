import '../status-pages.css';

// 비교 페이지를 불러오는 동안 보이는 정지된 빈 틀 — 게임 상세 로딩 틀과 같은 방식(.dl-wait: 200ms 안에 끝나면 나타나지 않음)
// 움직임 없음(shimmer·pulse 금지). 상단 2px 진행 바는 NavProgress가 담당
export default function CompareLoading() {
  return (
    <main className="page cmp-page dl-wait" aria-busy="true">
      <p className="sr-only" role="status">불러오는 중이에요</p>
      <div className="dl-back" />
      <div className="dl-line dl-title" />
      <div className="dl-box dl-card-m" style={{ marginTop: 20 }} />
      <div className="dl-box dl-card-l" style={{ marginTop: 20 }} />
    </main>
  );
}
