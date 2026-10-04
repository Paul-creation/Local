'use client'; // 에러 화면은 클라이언트 컴포넌트여야 함

import { useEffect } from 'react';
import StatusSearch from './components/status/StatusSearch';
import './status-pages.css';

// 페이지를 그리다 오류가 났을 때 (상단 바·푸터는 그대로 보임)
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="page status-page">
      <div className="status-card">
        <p className="status-code">잠시 문제가 생겼어요</p>
        <h1 className="status-title">페이지를 불러오지 못했어요</h1>
        <p className="status-desc">일시적인 오류일 수 있어요. 다시 시도하거나 메인에서 다시 찾아보세요.</p>
        <div className="status-actions">
          <button type="button" className="status-btn is-primary" onClick={() => retry()}>다시 시도</button>
          <a href="/" className="status-btn">메인으로</a>
        </div>
        <StatusSearch />
        {error.digest && <p className="status-digest">오류 코드: {error.digest}</p>}
      </div>
    </main>
  );
}
