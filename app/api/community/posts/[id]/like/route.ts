import { NextRequest, NextResponse } from 'next/server';
import { getIp } from '../../../../../lib/aiGuard';
import { db, fail, parseId, ipHash } from '../../../../../lib/community';

// 추천 (IP 해시 기준 1인 1회 — post_likes 기본키로 중복 차단)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return fail('잘못된 요청이에요.');
  const { data: post } = await db.from('posts').select('id, hidden').eq('id', id).maybeSingle();
  if (!post || post.hidden) return fail('글을 찾을 수 없어요.', 404);

  const { error } = await db.from('post_likes').insert({ post_id: id, voter_hash: ipHash(getIp(req.headers)) });
  if (error && error.code !== '23505') return fail('추천하지 못했어요.', 500);

  const { count } = await db.from('post_likes').select('post_id', { count: 'exact', head: true }).eq('post_id', id);
  await db.from('posts').update({ like_count: count ?? 0 }).eq('id', id);
  return NextResponse.json({ ok: true, already: error?.code === '23505', likeCount: count ?? 0 });
}
