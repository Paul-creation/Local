import { NextRequest, NextResponse, after } from 'next/server';
import { getIp } from '../../lib/aiGuard';
import { FEEDBACK_KINDS, FEEDBACK_LIMITS, isFeedbackKind } from '../../lib/feedback';
import { db, fail, clean, ipHash, checkLength, countLinks, since24h, MAX_LINKS } from '../../lib/community';
import { notifyDiscord } from '../../lib/notify';

const DAILY_FEEDBACK_PER_IP = 5;

// 의견함 — 로그인 없이 유형 + 본문 + 선택 연락처. 브라우저는 표에 직접 못 쓰고 여기(service role)로만
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return fail('잘못된 요청이에요.');

  const kind = body.kind;
  const text = clean(body.body);
  const contact = clean(body.contact);
  // 어느 페이지에서 보냈는지 — 사이트 안 경로만 저장
  const pageUrl = typeof body.pageUrl === 'string' && /^\/[^\s]*$/.test(body.pageUrl) ? body.pageUrl.slice(0, 300) : null;
  if (!isFeedbackKind(kind)) return fail('의견 유형을 골라주세요.');
  const problem =
    checkLength('내용', text, FEEDBACK_LIMITS.body) ||
    ([...contact].length > FEEDBACK_LIMITS.contact ? `연락처는 ${FEEDBACK_LIMITS.contact}자까지 쓸 수 있어요.` : null) ||
    (countLinks(text) > MAX_LINKS ? `링크는 ${MAX_LINKS}개까지 넣을 수 있어요.` : null);
  if (problem) return fail(problem);

  const ip_hash = ipHash(getIp(req.headers));
  const { count } = await db.from('feedback').select('id', { count: 'exact', head: true }).eq('ip_hash', ip_hash).gte('created_at', since24h());
  if ((count ?? 0) >= DAILY_FEEDBACK_PER_IP) return fail('오늘은 의견을 충분히 보내주셨어요. 내일 다시 보내주세요.', 429);

  const { error } = await db.from('feedback').insert({ kind, body: text, contact: contact || null, page_url: pageUrl, ip_hash });
  if (error) return fail('보내지 못했어요. 잠시 후 다시 시도해주세요.', 500);

  after(() => notifyDiscord(`새 의견 · ${FEEDBACK_KINDS[kind]}`, text, 'feedback'));
  return NextResponse.json({ ok: true });
}
