import './status-pages.css';

// 페이지를 불러오는 동안 보이는 화면 (상단 바는 그대로, 본문 자리에 회색 막대)
export default function Loading() {
  return (
    <main className="page status-loading" aria-busy="true">
      <p className="sr-only" role="status">불러오는 중이에요</p>
      <div className="skel skel-title" />
      <div className="skel-grid">
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="skel skel-card" />)}
      </div>
    </main>
  );
}
