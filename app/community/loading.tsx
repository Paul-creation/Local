import '../brand-tokens.css';
import '../components/status/skeleton.css';

// 커뮤니티를 불러오는 동안 — 탭 줄은 layout.tsx가 이미 그리므로 그 아래 제목 줄 + 글 목록 6줄 (글자 없음)
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="불러오는 중">
      <div className="sk-box sk-head" />
      <div className="sk-list">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="sk-box sk-row" />)}
      </div>
    </div>
  );
}
