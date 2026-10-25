import Link from 'next/link';
import { BOARDS } from '../../lib/communityBoards';
import type { PostListItem } from '../../lib/community';
import { CommentIcon, LikeIcon } from './mn/icons';

// 메인 "인기 게시물" — 최근 7일 추천+댓글 많은 글 5개, 모자라면 최근 글 (데이터는 page.tsx → lib/community)
// 모노 + 흰색 네온 스타일(.mn-posts, mn.css). 한 줄: 게시판 라벨 + 제목 + 추천·댓글 수(아이콘은 stroke SVG)
export default function PopularPosts({ posts }: { posts: PostListItem[] }) {
  return (
    <section className="mn-sec" aria-labelledby="mn-posts-title">
      <div className="mn-sec-head">
        <h2 id="mn-posts-title">인기 게시물</h2>
        <Link href="/community" className="mn-more">커뮤니티 가기</Link>
      </div>
      <ol className="mn-posts">
        {posts.map((p) => (
          <li key={p.id}>
            <Link href={`/community/post/${p.id}`} className="mn-post">
              <span className="mn-post-board">{BOARDS[p.board].label}</span>
              <span className="mn-post-title">{p.title}</span>
              <span className="mn-post-stat">
                <span aria-label={`추천 ${p.like_count}`}><LikeIcon />{p.like_count}</span>
                <span aria-label={`댓글 ${p.comment_count}`}><CommentIcon />{p.comment_count}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
