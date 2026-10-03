import Link from 'next/link';
import { getGamePosts } from '../../lib/community';
import PostList from './PostList';

// 게임 상세: 이 게임이 태그된 최근 글 3개 + "이 게임으로 글쓰기". 글이 없으면 버튼만
export default async function GamePosts({ gameId }: { gameId: string }) {
  const posts = await getGamePosts(gameId).catch(() => []);
  return (
    <section className="detail-section-v2">
      <h3>커뮤니티</h3>
      {posts.length > 0 && <PostList posts={posts} showBoard />}
      <Link href={`/community/write?game=${gameId}`} className="cm-btn cm-btn-primary" style={{ marginTop: posts.length ? 12 : 0 }}>
        ✏️ 이 게임으로 글쓰기
      </Link>
    </section>
  );
}
