import '../../status-pages.css';

// 불러오는 동안 본문 자리를 채우는 회색 막대 (loading.tsx, 메인 Suspense fallback)
// 화면 높이 이상을 차지해서, 내용이 들어올 때 아래 푸터가 밀려 보이지 않게 함
export default function PageSkeleton() {
  return (
    <div className="status-loading" aria-busy="true">
      <p className="sr-only" role="status">불러오는 중이에요</p>
      <div className="skel skel-title" />
      <div className="skel-grid">
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="skel skel-card" />)}
      </div>
    </div>
  );
}
