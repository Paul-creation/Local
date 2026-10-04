import type { Metadata } from 'next';
import { isBoard } from '../../lib/communityBoards';
import { db, parseId } from '../../lib/community';
import WriteForm from '../../components/community/WriteForm';
import { selectGames } from '../../lib/visibleGames';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '글쓰기', robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function WritePage({ searchParams }: { searchParams: Promise<{ board?: string; game?: string; post?: string }> }) {
  const { board, game, post } = await searchParams;
  const postId = parseId(post || '');
  const [{ data: g }, { data: p }] = await Promise.all([
    // "이 게임으로 글쓰기"로 들어오면 관련 게임을 미리 채운다
    game && UUID.test(game) ? selectGames('id, name', undefined, db).eq('id', game).maybeSingle() : Promise.resolve({ data: null }),
    // 글 상세에서 글쓰기 → 그 글의 게시판을 기본 선택 (게시판 칸만 읽음)
    postId ? db.from('posts').select('board').eq('id', postId).eq('hidden', false).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const initialBoard = isBoard(board) ? board : isBoard(p?.board) ? p.board : g ? 'party' : 'free';
  return (
    <>
      <h1 className="cm-h1">글쓰기</h1>
      <WriteForm initialBoard={initialBoard} initialGame={g} />
    </>
  );
}
