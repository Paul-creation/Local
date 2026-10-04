import { NextRequest, NextResponse } from 'next/server';
import { LIMITS } from '../../../../lib/communityBoards';
import { db, fail, clean, parseId, verifyPassword, wrongPassword, checkLength, checkText } from '../../../../lib/community';
import { findRelatedGames, isMissingRelatedColumn } from '../../../../lib/postLinks';

type Ctx = { params: Promise<{ id: string }> };

async function authorize(id: number | null, password: unknown) {
  if (!id || typeof password !== 'string' || !password) return { res: fail('비밀번호를 입력해주세요.') };
  const { data: post } = await db.from('posts').select('id, password_hash, hidden, game_id').eq('id', id).maybeSingle();
  if (!post) return { res: fail('글을 찾을 수 없어요.', 404) };
  if (!(await verifyPassword(password, post.password_hash))) return { res: await wrongPassword() };
  return { post };
}

// 글 수정 (비밀번호 확인)
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  const body = await req.json().catch(() => ({}));
  const { res, post } = await authorize(id, body?.password);
  if (res) return res;
  if (post.hidden) return fail('신고로 숨겨진 글은 수정할 수 없어요.', 403);

  const title = clean(body.title).replace(/\s+/g, ' ');
  const text = clean(body.body);
  const problem = checkLength('제목', title, LIMITS.title) || checkLength('본문', text, LIMITS.body) || checkText(`${title}\n${text}`);
  if (problem) return fail(problem);

  const changes = { title, body: text, updated_at: new Date().toISOString() };
  const related_game_ids = await findRelatedGames(title, text, post.game_id);
  let { error } = await db.from('posts').update({ ...changes, related_game_ids }).eq('id', id);
  if (isMissingRelatedColumn(error)) ({ error } = await db.from('posts').update(changes).eq('id', id));
  if (error) return fail('저장하지 못했어요.', 500);
  return NextResponse.json({ ok: true });
}

// 글 삭제 (비밀번호 확인) — 댓글·추천은 DB에서 함께 지워짐
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  const body = await req.json().catch(() => ({}));
  const { res } = await authorize(id, body?.password);
  if (res) return res;

  const { error } = await db.from('posts').delete().eq('id', id);
  if (error) return fail('삭제하지 못했어요.', 500);
  return NextResponse.json({ ok: true });
}
