import type { Metadata } from 'next';
import Link from 'next/link';
import { BOARD_KEYS, BOARDS } from '../lib/communityBoards';
import { listPosts } from '../lib/community';
import PostList from '../components/community/PostList';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '커뮤니티', description: '같이 게임할 사람 찾기, 뭐 할지 물어보기, 자유 게시판', alternates: { canonical: '/community' } };

export default async function CommunityHome() {
  const [all, ...boards] = await Promise.all([listPosts(null), ...BOARD_KEYS.map((b) => listPosts(b))]);
  return (
    <>
      <h1 className="cm-h1">커뮤니티</h1>
      <p className="cm-sub">로그인 없이 닉네임과 비밀번호만으로 글을 쓸 수 있어요.</p>
      <div className="cm-board-cards">
        {BOARD_KEYS.map((b, i) => (
          <Link key={b} href={`/community/${b}`} className="cm-board-card">
            <strong>{BOARDS[b].label}</strong>
            <span>{BOARDS[b].desc}</span>
            <span className="cm-board-card-count">글 {boards[i].total.toLocaleString('ko-KR')}개</span>
          </Link>
        ))}
      </div>
      <h2 className="cm-h2">최근 글</h2>
      <PostList posts={all.posts} showBoard empty="아직 글이 없어요. 첫 글을 써주세요!" />
    </>
  );
}
