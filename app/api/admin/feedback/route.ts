import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '../../../lib/adminAuth';
import { db, fail } from '../../../lib/community';

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

// 의견함 목록 (ip_hash는 내보내지 않음). 처리 안 된 것 먼저
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const { data, error } = await db.from('feedback')
    .select('id, kind, body, contact, page_url, resolved_at, created_at')
    .order('resolved_at', { ascending: false, nullsFirst: true })
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) return fail(error.message, 500);
  return NextResponse.json({ items: data || [] });
}

// 처리 완료 표시 / 되돌리기 (의견은 지우지 않고 시각만 남김)
export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const { id, resolved } = await req.json().catch(() => ({}));
  if (!Number.isSafeInteger(id)) return fail('잘못된 요청이에요.');
  const { error } = await db.from('feedback').update({ resolved_at: resolved === false ? null : new Date().toISOString() }).eq('id', id);
  if (error) return fail(error.message, 500);
  return NextResponse.json({ ok: true });
}
