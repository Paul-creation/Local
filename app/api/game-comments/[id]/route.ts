import { NextRequest, NextResponse } from 'next/server';
import { LIMITS } from '../../../lib/communityBoards';
import { db, fail, clean, parseId, verifyPassword, wrongPassword, checkLength, checkText } from '../../../lib/community';

type Ctx = { params: Promise<{ id: string }> };

async function authorize(id: number | null, password: unknown) {
  if (!id || typeof password !== 'string' || !password) return { res: fail('비밀번호를 입력해주세요.') };
  const { data: c } = await db.from('game_comments').select('id, password_hash, hidden').eq('id', id).maybeSingle();
  if (!c) return { res: fail('의견을 찾을 수 없어요.', 404) };
  if (!(await verifyPassword(password, c.password_hash))) return { res: await wrongPassword() };
  return { comment: c };
}

// 의견 수정 (비밀번호 확인)
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  const body = await req.json().catch(() => ({}));
  const { res, comment } = await authorize(id, body?.password);
  if (res) return res;
  if (comment.hidden) return fail('신고로 숨겨진 의견은 수정할 수 없어요.', 403);

  const text = clean(body.body);
  const problem = checkLength('의견', text, LIMITS.gameComment) || checkText(text);
  if (problem) return fail(problem);

  const { error } = await db.from('game_comments').update({ body: text }).eq('id', id);
  if (error) return fail('저장하지 못했어요.', 500);
  return NextResponse.json({ ok: true, body: text });
}

// 의견 삭제 (비밀번호 확인)
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  const body = await req.json().catch(() => ({}));
  const { res } = await authorize(id, body?.password);
  if (res) return res;

  const { error } = await db.from('game_comments').delete().eq('id', id);
  if (error) return fail('삭제하지 못했어요.', 500);
  return NextResponse.json({ ok: true });
}
