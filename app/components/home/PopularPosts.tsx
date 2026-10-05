import Link from 'next/link';
import { BOARDS } from '../../lib/communityBoards';
import type { PostListItem } from '../../lib/community';

// 메인 "인기 게시물" — 최근 7일 추천+댓글 많은 글 5개, 모자라면 최근 글 (데이터는 page.tsx → lib/community)
// 한 카드 안의 줄: 게시판 라벨(배경 칸) + 제목 + "추천 N · 댓글 N"
export default function PopularPosts({ posts }: { posts: PostListItem[] }) {
  return (
    <section className="home-block">
      <div className="home-block-head">
        <h2 className="section-title">인기 게시물</h2>
        <Link href="/community" className="home-more">커뮤니티 가기 →</Link>
      </div>
      <ol className="cm-home-list">
        {posts.map((p) => (
          <li key={p.id}>
            <Link href={`/community/post/${p.id}`} className="cm-home-row">
              <span className="cm-home-board">{BOARDS[p.board].label}</span>
              <span className="cm-home-title">{p.title}</span>
              <span className="cm-home-stat">추천 {p.like_count} · 댓글 {p.comment_count}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
