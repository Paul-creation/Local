'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isBoard } from '../../lib/communityBoards';

// 상단 탭의 글쓰기 — 게시판 안에서 누르면 그 게시판이 기본 선택되게
export default function WriteLink() {
  const board = usePathname().split('/')[2];
  return (
    <Link href={isBoard(board) ? `/community/write?board=${board}` : '/community/write'} className="cm-write-btn">✏️ 글쓰기</Link>
  );
}
