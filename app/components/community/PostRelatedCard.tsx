import Link from 'next/link';
import { db } from '../../lib/community';
import { postHints, playersLink, compareLink, SALE_LINK, UUID } from '../../lib/postLinks';
import { selectGames } from '../../lib/visibleGames';

// 글 본문 아래 "이 글과 관련된 정보" — 저장된 관련 게임 + 글자에서 찾은 인원·비교·할인 링크. 보여줄 게 없으면 아무것도 안 그림
// related_game_ids는 따로 읽는다 (마이그레이션 전이라 칸이 없어도 글 화면은 그대로 뜨게)
export default async function PostRelatedCard({ postId, title, body, pickedGameId }: {
  postId: number; title: string; body: string; pickedGameId: string | null;
}) {
  const { data: row } = await db.from('posts').select('related_game_ids').eq('id', postId).maybeSingle();
  const ids = (((row as { related_game_ids?: string[] | null } | null)?.related_game_ids) || []).filter((id) => UUID.test(id));
  const { data: rows } = ids.length
    ? await selectGames('id, name', undefined, db).in('id', ids)
    : { data: [] as { id: string; name: string }[] };
  const games = ids.map((id) => (rows || []).find((g) => g.id === id)).filter(Boolean) as { id: string; name: string }[];

  const hints = postHints(`${title}\n${body}`);
  const shownGames = games.filter((g) => g.id !== pickedGameId); // 직접 고른 게임은 위에 이미 링크가 있음
  const canCompare = games.length >= 2 || (hints.vs && games.length >= 1);

  if (!shownGames.length && !hints.players.length && !canCompare && !hints.sale) return null;

  return (
    <aside className="cm-card cm-related" aria-label="이 글과 관련된 정보">
      <h2 className="cm-related-title">이 글과 관련된 정보</h2>
      <ul className="cm-related-list">
        {shownGames.map((g) => (
          <li key={g.id}><Link href={`/games/${g.id}`}>🎮 {g.name}</Link></li>
        ))}
        {hints.players.map((n) => (
          <li key={`p${n}`}><Link href={playersLink(n)}>👥 {n}명 이상 되는 게임 보기</Link></li>
        ))}
        {canCompare && (
          <li><Link href={compareLink(games.map((g) => g.id))}>⚖️ {games.length >= 2 ? `${games.map((g) => g.name).join(' vs ')} 비교 만들기` : `${games[0].name} 비교 만들기`}</Link></li>
        )}
        {hints.sale && <li><Link href={SALE_LINK}>💸 지금 할인 중인 게임 보기</Link></li>}
      </ul>
    </aside>
  );
}
