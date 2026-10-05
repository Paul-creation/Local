import Link from 'next/link';
import { db, PUBLIC_POST_LIST, type PostListItem } from '../../lib/community';
import { BOARDS, timeAgo } from '../../lib/communityBoards';
import { UUID } from '../../lib/postLinks';

// 게임 상세 "관련 게시물" — 직접 고른 게임(game_id) 또는 자동 매칭(related_game_ids)된 최근 글 3개, 숨김 글 제외. 없으면 안 그림
export default async function RelatedPosts({ gameId }: { gameId: string }) {
  if (!UUID.test(gameId)) return null;
  const base = () => db.from('posts').select(PUBLIC_POST_LIST).eq('hidden', false).order('created_at', { ascending: false }).limit(3);
  const matched = await base().or(`game_id.eq.${gameId},related_game_ids.cs.{${gameId}}`);
  const { data } = matched.error ? await base().eq('game_id', gameId) : matched; // related_game_ids 칸이 아직 없을 때
  const posts = (data || []) as unknown as PostListItem[];
  if (!posts.length) return null;

  return (
    <section className="detail-card">
      <h3 className="detail-card-title">관련 게시물</h3>
      <ul className="cm-list">
        {posts.map((p) => (
          <li key={p.id}>
            <Link href={`/community/post/${p.id}`} className="cm-row">
              <span className="cm-row-title">
                <span className="cm-board-chip">{BOARDS[p.board].label}</span>
                {p.title}
                {p.comment_count > 0 && <span className="cm-row-count">[{p.comment_count}]</span>}
              </span>
              <span className="cm-row-meta">{p.nickname} · {timeAgo(p.created_at)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
