import Link from 'next/link';
import { BOARD_KEYS, BOARDS } from '../lib/communityBoards';
import WriteLink from '../components/community/WriteLink';
import '../mono-tokens.css';
import '../mono-page.css';
import './community-mono.css';

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="page cm-page mn mn-inner">
      <nav className="cm-tabs" aria-label="게시판">
        <Link href="/community">전체</Link>
        {BOARD_KEYS.map((b) => (
          <Link key={b} href={`/community/${b}`}>{BOARDS[b].label}</Link>
        ))}
        <WriteLink />
      </nav>
      {children}
      <footer className="cm-footer">
        <Link href="/community/policy">커뮤니티 운영정책</Link>
      </footer>
    </main>
  );
}
