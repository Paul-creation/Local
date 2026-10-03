import type { Metadata } from 'next';
import { isBoard } from '../../lib/communityBoards';
import { db } from '../../lib/community';
import WriteForm from '../../components/community/WriteForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '글쓰기', robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function WritePage({ searchParams }: { searchParams: Promise<{ board?: string; game?: string }> }) {
  const { board, game } = await searchParams;
  // "이 게임으로 글쓰기"로 들어오면 관련 게임을 미리 채운다
  const { data: g } = game && UUID.test(game)
    ? await db.from('games').select('id, name').eq('id', game).maybeSingle()
    : { data: null };
  return (
    <>
      <h1 className="cm-h1">글쓰기</h1>
      <WriteForm initialBoard={isBoard(board) ? board : (g ? 'party' : 'free')} initialGame={g} />
    </>
  );
}
