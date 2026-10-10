import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BOARDS, boardTitle, isBoard } from '../../lib/communityBoards';
import { listPosts, PAGE_SIZE } from '../../lib/community';
import BackLink from '../../components/BackLink';
import PostList from '../../components/community/PostList';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ board: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { board } = await params;
  if (!isBoard(board)) return { title: '게시판을 찾을 수 없어요' };
  return { title: `${BOARDS[board].label} 게시판`, description: BOARDS[board].desc, alternates: { canonical: `/community/${board}` } };
}

export default async function BoardPage({ params, searchParams }: Props) {
  const { board } = await params;
  if (!isBoard(board)) notFound();
  const page = Math.min(500, Math.max(1, Number((await searchParams).page) || 1));
  const { posts, total } = await listPosts(board, page);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <BackLink fallbackHref="/community" label="커뮤니티로" />
      <div className="cm-head-row">
        <div>
          <h1 className="cm-h1">{boardTitle(board)}</h1>
          <p className="cm-sub">{BOARDS[board].desc}</p>
        </div>
        <Link href={`/community/write?board=${board}`} className="cm-btn cm-btn-primary">글쓰기</Link>
      </div>
      <PostList posts={posts} empty="아직 글이 없어요. 첫 글을 써주세요!" />
      {pages > 1 && (
        <nav className="cm-pager" aria-label="페이지">
          {page > 1 && <Link href={`/community/${board}?page=${page - 1}`}>← 이전</Link>}
          <span>{page} / {pages}</span>
          {page < pages && <Link href={`/community/${board}?page=${page + 1}`}>다음 →</Link>}
        </nav>
      )}
    </>
  );
}
