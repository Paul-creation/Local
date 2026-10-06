import '../../status-pages.css';

// 게임 상세를 불러오는 동안 보이는 정지된 빈 틀 — 실제 상세와 같은 클래스·같은 칸 구성(히어로, 제목, 가격 박스, 본문 카드)
// 움직임 없음(shimmer·pulse 금지). 200ms 안에 끝나면 아예 나타나지 않는다 (.dl-wait, status-pages.css)
export default function GameDetailLoading() {
  return (
    <main className="page detail-page dl-wait" aria-busy="true">
      <p className="sr-only" role="status">불러오는 중이에요</p>
      <div className="dl-back" />
      <div className="dh">
        <div className="dh-media">
          <div className="dh-info">
            <div className="dl-line dl-badges" />
            <div className="dl-line dl-title" />
          </div>
        </div>
      </div>
      <div className="detail-layout">
        <aside className="detail-price">
          <div className="dl-box dl-price" />
        </aside>
        <div className="detail-main">
          <div className="dl-box dl-card-s" />
          <div className="dl-box dl-card-m" />
          <div className="dl-box dl-card-l" />
        </div>
      </div>
    </main>
  );
}
