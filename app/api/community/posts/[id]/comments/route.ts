import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '../../../../../lib/adminAuth';
import { getIp } from '../../../../../lib/aiGuard';
import { LIMITS } from '../../../../../lib/communityBoards';
import {
  db, fail, clean, parseId, ipHash, hashPassword, checkLength, checkText, checkAuthor, since24h,
  syncCommentCount, DAILY_COMMENTS_PER_IP, PUBLIC_COMMENT,
} from '../../../../../lib/community';

// 댓글 쓰기
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const postId = parseId((await params).id);
  const body = await req.json().catch(() => null);
  if (!postId || !body || typeof body !== 'object') return fail('잘못된 요청이에요.');

  const text = clean(body.body);
  const nickname = clean(body.nickname).replace(/\s+/g, ' ');
  const asAdmin = isAdmin(req); // 관리자 로그인 상태면 운영자 닉네임 허용 + "운영자" 배지
  const problem = checkLength('댓글', text, LIMITS.comment) || checkAuthor(nickname, body.password, asAdmin) || checkText(text);
  if (problem) return fail(problem);

  const ip_hash = ipHash(getIp(req.headers));
  const [{ data: post }, { count }] = await Promise.all([
    db.from('posts').select('id, hidden').eq('id', postId).maybeSingle(),
    db.from('post_comments').select('id', { count: 'exact', head: true }).eq('ip_hash', ip_hash).gte('created_at', since24h()),
  ]);
  if (!post || post.hidden) return fail('글을 찾을 수 없어요.', 404);
  if ((count ?? 0) >= DAILY_COMMENTS_PER_IP) return fail('오늘은 댓글을 충분히 썼어요. 내일 다시 써주세요.', 429);

  const { data, error } = await db.from('post_comments').insert({
    post_id: postId, body: text, nickname, password_hash: await hashPassword(body.password), ip_hash, is_admin: asAdmin,
  }).select(PUBLIC_COMMENT).single();
  if (error || !data) return fail('저장하지 못했어요. 잠시 후 다시 시도해주세요.', 500);
  await syncCommentCount(postId);
  return NextResponse.json({ comment: data });
}
