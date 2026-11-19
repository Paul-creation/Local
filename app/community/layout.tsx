import Link from 'next/link';
import CommunityTabs from '../components/community/CommunityTabs';
import '../brand-tokens.css';
import '../mono-page.css';
import './community-mono.css';
import '../mono-static.css';

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="page cm-page mn mn-inner">
      <CommunityTabs />
      {children}
      <footer className="cm-footer">
        <Link href="/community/policy">커뮤니티 운영정책</Link>
      </footer>
    </main>
  );
}
