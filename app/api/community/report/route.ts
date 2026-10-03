import { NextRequest, NextResponse, after } from 'next/server';
import { getIp } from '../../../lib/aiGuard';
import { REPORT_REASONS } from '../../../lib/communityBoards';
import { db, fail, ipHash, syncCommentCount, HIDE_AT_REPORTS } from '../../../lib/community';
import { notifyDiscord } from '../../../lib/notify';

// 신고 (글·댓글·게임 의견, IP 해시 기준 1인 1회 — post_reports 유니크 제약). 신고가 쌓이면 자동으로 숨김
const TABLE = { post: 'posts', comment: 'post_comments', game_comment: 'game_comments' } as const;
const LABEL = { post: '글', comment: '댓글', game_comment: '게임 의견' } as const;

export async function POST(req: NextRequest) {
  const { type, id, reason } = await req.json().catch(() => ({}));
  if (!(type in TABLE) || !Number.isSafeInteger(id) || id <= 0) return fail('잘못된 요청이에요.');
  const table = TABLE[type as keyof typeof TABLE];

  const { data: target } = await db.from(table).select(type === 'comment' ? 'id, post_id, body, report_count, hidden' : type === 'post' ? 'id, title, body, report_count, hidden' : 'id, body, report_count, hidden').eq('id', id).maybeSingle();
  const t = target as { report_count: number; hidden: boolean; post_id?: number; title?: string; body: string } | null;
  if (!t || t.hidden) return fail('이미 숨겨졌거나 없는 글이에요.', 404);

  const { error } = await db.from('post_reports').insert({
    target_type: type, target_id: id, reporter_hash: ipHash(getIp(req.headers)),
    reason: REPORT_REASONS.includes(reason) ? reason : null,
  });
  if (error?.code === '23505') return NextResponse.json({ ok: true, already: true });
  if (error) return fail('신고하지 못했어요.', 500);

  // 관리자가 복구하면 report_count를 0으로 돌리므로, 그 뒤로 새로 쌓인 신고만 센다
  const reportCount = (t.report_count || 0) + 1;
  const hidden = reportCount >= HIDE_AT_REPORTS;
  await db.from(table).update({ report_count: reportCount, hidden }).eq('id', id);
  if (hidden && type === 'comment' && t.post_id) await syncCommentCount(t.post_id);
  // 위에서 이미 숨김 상태면 거절하므로, 여기서 hidden이면 이번 신고로 막 숨겨진 것 → 관리자 알림 (응답을 보낸 뒤 실행 — 실패해도 신고는 그대로)
  if (hidden) {
    const label = LABEL[type as keyof typeof LABEL];
    after(() => notifyDiscord(`🚨 신고 ${HIDE_AT_REPORTS}번 자동 숨김 · ${label} #${id}`, t.title ? `${t.title} — ${t.body}` : t.body, 'hidden'));
  }
  return NextResponse.json({ ok: true, hidden });
}
