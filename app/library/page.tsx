import type { Metadata } from 'next';
import BackLink from '../components/BackLink';
import LibraryView from '../components/library/LibraryView';
import '../mono-tokens.css';
import '../mono-page.css';
import '../mono-lists.css';

// 내 보유 게임은 로그인한 브라우저에서만 보이는 화면이라 검색 결과에는 올리지 않음
export const metadata: Metadata = { title: '내 라이브러리', robots: { index: false } };

export default function LibraryPage() {
  return (
    <main className="page mn mn-inner">
      <BackLink fallbackHref="/" label="홈으로" />
      <LibraryView />
    </main>
  );
}
