import Link from 'next/link';
import { BOARDS, timeAgo } from '../../lib/communityBoards';
import type { PostListItem } from '../../lib/community';
import { gameName } from '../../lib/gameName';

// 게시글 목록 (서버 컴포넌트). showBoard: 여러 게시판 글이 섞여 있을 때 게시판 표시
export default function PostList({ posts, showBoard = false, empty = '아직 글이 없어요.' }: { posts: PostListItem[]; showBoard?: boolean; empty?: string }) {
  if (posts.length === 0) return <p className="cm-empty">{empty}</p>;
  const now = Date.now();
  return (
    <ul className="cm-list">
      {posts.map((p) => (
        <li key={p.id}>
          <Link href={`/community/post/${p.id}`} className="cm-row">
            <span className="cm-row-main">
              {showBoard && <span className="cm-board-chip">{BOARDS[p.board].label}</span>}
              <span className="cm-row-title">{p.title}</span>
              {p.games && <span className="cm-row-sub">{gameName(p.games)}</span>}
            </span>
            <span className="cm-row-meta">
              <span>{p.nickname}</span>
              {p.is_admin && <span className="cm-admin-badge">운영자</span>}
              <span>· {timeAgo(p.created_at, now)}</span>
              {p.like_count > 0 && <span>· 추천 {p.like_count}</span>}
              <span>· 댓글 {p.comment_count}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
