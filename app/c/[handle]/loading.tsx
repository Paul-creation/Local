import '../../brand-tokens.css';
import '../../mono-page.css';
import '../../components/status/skeleton.css';

// 큐레이터 페이지를 불러오는 동안 — 프로필 줄 + 카드 3열 2줄 (글자 없음)
export default function Loading() {
  return (
    <main className="page mn mn-inner" role="status" aria-busy="true" aria-label="불러오는 중">
      <div className="sk-profile">
        <div className="sk-box sk-avatar" />
        <div className="sk-lines">
          <div className="sk-box sk-line w40" />
          <div className="sk-box sk-line w25" />
          <div className="sk-box sk-line" />
        </div>
      </div>
      <div className="sk-grid">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="sk-box sk-card" />)}
      </div>
    </main>
  );
}
