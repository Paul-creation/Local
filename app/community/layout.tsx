import Link from 'next/link';
import { BOARD_KEYS, BOARDS } from '../lib/communityBoards';

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="page cm-page">
      <nav className="cm-tabs" aria-label="게시판">
        <Link href="/community">전체</Link>
        {BOARD_KEYS.map((b) => (
          <Link key={b} href={`/community/${b}`}>{BOARDS[b].emoji} {BOARDS[b].label}</Link>
        ))}
        <Link href="/community/write" className="cm-write-btn">✏️ 글쓰기</Link>
      </nav>
      {children}
      <footer className="cm-footer">
        <Link href="/community/policy">커뮤니티 운영정책</Link>
      </footer>
    </main>
  );
}
