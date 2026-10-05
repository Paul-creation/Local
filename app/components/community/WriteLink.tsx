'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isBoard } from '../../lib/communityBoards';

// 상단 탭의 글쓰기 — 게시판 안에서 누르면 그 게시판, 글 상세에서 누르면 그 글의 게시판이 기본 선택되게
// (글 상세 주소에는 게시판이 없어서 글 번호를 넘기고, 글쓰기 페이지가 서버에서 게시판을 찾는다)
export default function WriteLink() {
  const [, , seg, id] = usePathname().split('/');
  const href = isBoard(seg) ? `/community/write?board=${seg}`
    : seg === 'post' && /^\d+$/.test(id || '') ? `/community/write?post=${id}`
    : '/community/write';
  return <Link href={href} className="cm-write-btn">글쓰기</Link>;
}
