import type { Metadata } from 'next';
import StatusSearch from './components/status/StatusSearch';
import './status-pages.css';

export const metadata: Metadata = { title: '페이지를 찾을 수 없어요' };

// 없는 주소·notFound() 공통 404 화면
export default function NotFound() {
  return (
    <main className="page status-page">
      <div className="status-card">
        <p className="status-code">404</p>
        <h1 className="status-title">찾는 페이지가 없어요</h1>
        <p className="status-desc">주소가 바뀌었거나 삭제된 페이지일 수 있어요. 게임 이름으로 다시 찾아보세요.</p>
        <StatusSearch />
        <div className="status-actions">
          <a href="/" className="status-btn">메인으로</a>
          <a href="/?r=1" className="status-btn">전체 게임 보기</a>
        </div>
      </div>
    </main>
  );
}
