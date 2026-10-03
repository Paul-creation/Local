import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '../../../lib/adminAuth';
import { db, fail, syncCommentCount } from '../../../lib/community';

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const TABLE = { post: 'posts', comment: 'post_comments', game_comment: 'game_comments' } as const;

async function target(req: NextRequest) {
  const { type, id } = await req.json().catch(() => ({}));
  if (!(type in TABLE) || !Number.isSafeInteger(id)) return null;
  return { type: type as keyof typeof TABLE, id: id as number };
}

// 신고로 숨겨진 글·댓글 목록 + 신고는 들어왔지만 아직 안 숨겨진 글
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const [posts, comments, reported, gameComments] = await Promise.all([
    db.from('posts').select('id, board, title, body, nickname, report_count, created_at').eq('hidden', true).order('created_at', { ascending: false }).limit(200),
    db.from('post_comments').select('id, post_id, body, nickname, report_count, created_at').eq('hidden', true).order('created_at', { ascending: false }).limit(200),
    db.from('posts').select('id, board, title, body, nickname, report_count, created_at').eq('hidden', false).gt('report_count', 0).order('report_count', { ascending: false }).limit(100),
    db.from('game_comments').select('id, game_id, body, nickname, report_count, created_at, games(name)').eq('hidden', true).order('created_at', { ascending: false }).limit(200),
  ]);
  return NextResponse.json({ posts: posts.data || [], comments: comments.data || [], reported: reported.data || [], gameComments: gameComments.data || [] });
}

// 복구: 숨김 해제 + 신고 수 초기화
export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const t = await target(req);
  if (!t) return fail('잘못된 요청이에요.');
  const { data, error } = await db.from(TABLE[t.type]).update({ hidden: false, report_count: 0 }).eq('id', t.id).select(t.type === 'comment' ? 'post_id' : 'id').maybeSingle();
  if (error) return fail(error.message, 500);
  if (t.type === 'comment' && data) await syncCommentCount((data as { post_id: number }).post_id);
  return NextResponse.json({ ok: true });
}

// 완전 삭제
export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const t = await target(req);
  if (!t) return fail('잘못된 요청이에요.');
  const { error } = await db.from(TABLE[t.type]).delete().eq('id', t.id);
  if (error) return fail(error.message, 500);
  return NextResponse.json({ ok: true });
}
