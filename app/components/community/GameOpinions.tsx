import { db, PUBLIC_GAME_COMMENT } from '../../lib/community';
import OpinionBox from './OpinionBox';

// 게임 상세 "의견 달기" — game_comments에서 숨김 아닌 의견만 (게시판 목록에는 안 나옴)
export default async function GameOpinions({ gameId }: { gameId: string }) {
  const { data } = await db.from('game_comments').select(PUBLIC_GAME_COMMENT)
    .eq('game_id', gameId).eq('hidden', false).order('created_at', { ascending: false }).limit(50);
  const initial = (data || []).map((c) => ({ id: c.id, body: c.body, nickname: c.nickname, is_admin: c.is_admin, created_at: c.created_at, hidden: false }));
  return <OpinionBox gameId={gameId} initial={initial} />;
}
