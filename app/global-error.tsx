'use client'; // 에러 화면은 클라이언트 컴포넌트여야 함

import 'pretendard/dist/web/static/pretendard.css';
import './globals.css';
import './status-pages.css';
import StatusSearch from './components/status/StatusSearch';

// 최상위 레이아웃까지 오류가 났을 때 — layout을 대신하므로 html·body를 직접 그림
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="ko">
      <body>
        <main className="page status-page">
          <div className="status-card">
            <p className="status-code">잠시 문제가 생겼어요</p>
            <h1 className="status-title">사이트를 불러오지 못했어요</h1>
            <p className="status-desc">일시적인 오류일 수 있어요. 잠시 뒤 다시 시도해주세요.</p>
            <div className="status-actions">
              <button type="button" className="status-btn is-primary" onClick={() => retry()}>다시 시도</button>
              <a href="/" className="status-btn">메인으로</a>
            </div>
            <StatusSearch />
            {error.digest && <p className="status-digest">오류 코드: {error.digest}</p>}
          </div>
        </main>
      </body>
    </html>
  );
}
