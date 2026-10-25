import '../../mono-tokens.css';
import './party-loader.css';

// 공용 로딩 화면 "친구 모으는 중" — loading.tsx와 목록·찜목록·메인 필터 주소 첫 화면이 같이 쓴다. 움직임은 전부 CSS (party-loader.css)
export default function PartyLoader() {
  return (
    <div className="party-loader mn" role="status" aria-live="polite">
      <div className="party-dots" aria-hidden="true">
        <span className="party-dot" /><span className="party-dot" /><span className="party-dot" /><span className="party-dot" />
      </div>
      <p className="party-text">친구 모으는 중</p>
    </div>
  );
}
