import Link from 'next/link';
import { BOARDS } from '../../lib/communityBoards';
import type { PostListItem } from '../../lib/community';

// 메인 "인기 게시물" — 최근 7일 추천+댓글 많은 글 5개, 모자라면 최근 글 (데이터는 page.tsx → lib/community)
export default function PopularPosts({ posts }: { posts: PostListItem[] }) {
  return (
    <>
      <div className="section-label cm-home-label">
        <span>💬 인기 게시물</span>
        <Link href="/community" className="cm-more">커뮤니티 가기 →</Link>
      </div>
      <ol className="cm-home-list">
        {posts.map((p, i) => (
          <li key={p.id}>
            <Link href={`/community/post/${p.id}`} className="cm-home-row">
              <span className="cm-home-rank">{i + 1}</span>
              <span className="cm-board-chip">{BOARDS[p.board].emoji} {BOARDS[p.board].label}</span>
              <span className="cm-home-title">{p.title}</span>
              <span className="cm-home-stat">👍 {p.like_count} · 💬 {p.comment_count}</span>
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
