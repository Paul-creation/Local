'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BOARD_KEYS, BOARDS } from '../../lib/communityBoards';
import WriteLink from './WriteLink';

// 게시판 탭(전체·게시판별) + 오른쪽 글쓰기 — 지금 보는 게시판 탭은 --ink 배경 + 어두운 글씨 (괄호 없음)
export default function CommunityTabs() {
  const path = usePathname();
  const cur = (href: string) => (href === '/community' ? path === '/community' : path === href || path.startsWith(`${href}/`));
  return (
    <nav className="cm-tabs" aria-label="게시판">
      <Link href="/community" aria-current={cur('/community') ? 'page' : undefined}>전체</Link>
      {BOARD_KEYS.map((b) => (
        <Link key={b} href={`/community/${b}`} aria-current={cur(`/community/${b}`) ? 'page' : undefined}>{BOARDS[b].label}</Link>
      ))}
      <WriteLink />
    </nav>
  );
}
