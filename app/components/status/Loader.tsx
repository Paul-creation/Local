import '../../mono-tokens.css';
import './loader.css';

// 공용 로딩 화면 — loading.tsx와 목록·찜목록·메인 필터 주소 첫 화면이 같이 쓴다. 점 3개가 차례로 밝아진다 (움직임은 전부 CSS, loader.css)
export default function Loader() {
  return (
    <div className="loader mn" role="status" aria-live="polite">
      <div className="loader-dots" aria-hidden="true">
        <span className="loader-dot" /><span className="loader-dot" /><span className="loader-dot" />
      </div>
      <span className="sr-only">불러오는 중</span>
    </div>
  );
}
