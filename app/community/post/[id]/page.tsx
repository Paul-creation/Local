import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getIp } from '../../../lib/aiGuard';
import { BASE_OG } from '../../../lib/site';
import { BOARDS, boardTitle, timeAgo, type BoardKey } from '../../../lib/communityBoards';
import { db, ipHash, parseId, PUBLIC_POST, PUBLIC_COMMENT } from '../../../lib/community';
import BackLink from '../../../components/BackLink';
import PostActions from '../../../components/community/PostActions';
import Comments, { type Comment } from '../../../components/community/Comments';
import PostRelatedCard from '../../../components/community/PostRelatedCard';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };
type Post = {
  id: number; board: BoardKey; title: string; body: string; nickname: string; is_admin: boolean; game_id: string | null;
  like_count: number; comment_count: number; hidden: boolean; created_at: string; updated_at: string | null;
  games: { id: string; name: string } | null;
};

async function getPost(raw: string) {
  const id = parseId(raw);
  if (!id) return null;
  const { data } = await db.from('posts').select(PUBLIC_POST).eq('id', id).maybeSingle();
  return data as unknown as Post | null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost((await params).id);
  if (!post || post.hidden) return { title: '커뮤니티', robots: { index: false } };
  const description = post.body.replace(/\s+/g, ' ').slice(0, 100);
  const url = `/community/post/${post.id}`;
  return { title: post.title, description, alternates: { canonical: url }, openGraph: { ...BASE_OG, title: post.title, description, url } };
}

export default async function PostPage({ params }: Props) {
  const post = await getPost((await params).id);
  if (!post) notFound();

  if (post.hidden) {
    return (
      <div className="cm-card cm-hidden-note">
        <p>신고가 쌓여 숨겨진 글이에요. 운영자가 확인한 뒤 복구하거나 삭제해요.</p>
        <Link href={`/community/${post.board}`} className="cm-btn">목록으로</Link>
      </div>
    );
  }

  const [{ data: comments }, { data: liked }] = await Promise.all([
    db.from('post_comments').select(PUBLIC_COMMENT).eq('post_id', post.id).order('created_at', { ascending: true }).limit(500),
    db.from('post_likes').select('post_id').eq('post_id', post.id).eq('voter_hash', ipHash(getIp(await headers()))).maybeSingle(),
  ]);

  return (
    <>
      <BackLink fallbackHref={`/community/${post.board}`} label={`${BOARDS[post.board].label} 목록`} />
      <article className="cm-card cm-post">
        <Link href={`/community/${post.board}`} className="cm-board-chip">{boardTitle(post.board)}</Link>
        <h1 className="cm-post-title">{post.title}</h1>
        <div className="cm-row-meta">
          <span>{post.nickname}</span>
          {post.is_admin && <span className="cm-admin-badge">운영자</span>}
          <span>· {timeAgo(post.created_at)}</span>
          {post.updated_at && <span>· 수정됨</span>}
        </div>
        {post.games && (
          <Link href={`/games/${post.games.id}`} className="cm-game-link">관련 게임 · {post.games.name}</Link>
        )}
        {/* 본문은 글자 그대로 출력 (HTML로 해석하지 않음) */}
        <div className="cm-post-body">{post.body}</div>
        <PostActions post={{ id: post.id, title: post.title, body: post.body, board: post.board, likeCount: post.like_count }} initialLiked={!!liked} />
      </article>
      <PostRelatedCard postId={post.id} title={post.title} body={post.body} pickedGameId={post.game_id} />
      {/* 숨겨진 댓글은 내용을 내려보내지 않는다 */}
      <Comments postId={post.id} initial={((comments || []) as Comment[]).map((c) => (c.hidden ? { ...c, body: '', nickname: '', is_admin: false } : c))} />
    </>
  );
}
