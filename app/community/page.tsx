import type { Metadata } from 'next';
import Link from 'next/link';
import { BOARD_KEYS, BOARDS } from '../lib/communityBoards';
import { listPosts } from '../lib/community';
import PostList from '../components/community/PostList';
import SectionHead from '../components/brand/SectionHead';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '커뮤니티', description: '같이 게임할 사람 찾기, 뭐 할지 물어보기, 자유 게시판', alternates: { canonical: '/community' } };

export default async function CommunityHome() {
  const [all, ...boards] = await Promise.all([listPosts(null), ...BOARD_KEYS.map((b) => listPosts(b))]);
  return (
    <>
      <SectionHead id="cm-title" label="로그인 없이 닉네임과 비밀번호로 써요" title="커뮤니티" />
      <div className="cm-board-cards">
        {BOARD_KEYS.map((b, i) => (
          <Link key={b} href={`/community/${b}`} className="cm-board-card">
            <strong>{BOARDS[b].label}</strong>
            <span>{BOARDS[b].desc}</span>
            <span className="cm-board-card-count">글 {boards[i].total.toLocaleString('ko-KR')}개</span>
          </Link>
        ))}
      </div>
      <SectionHead id="cm-recent" label="최근 글" />
      <PostList posts={all.posts} showBoard empty="아직 글이 없어요. 첫 글을 써주세요!" />
    </>
  );
}
