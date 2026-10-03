// 디스코드 관리자 알림 — 서버 전용 (웹후크 주소가 브라우저 번들에 들어가면 누구나 채널에 글을 쓸 수 있음)
// DISCORD_WEBHOOK_URL이 없으면 조용히 건너뛰고, 실패해도 본 처리에는 영향을 주지 않는다.
import 'server-only';
import { SITE_URL } from './site';

// 본문은 앞 50자만, 줄바꿈은 한 칸으로 (IP 해시·연락처 같은 개인정보는 넣지 않는다)
export const preview = (s: string, n = 50) => {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  return [...t].length > n ? [...t].slice(0, n).join('') + '…' : t;
};

export async function notifyDiscord(kind: string, body: string, adminTab: 'reports' | 'hidden' | 'feedback') {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // allowed_mentions: 사용자가 쓴 @everyone 같은 글자로 멘션이 울리지 않게
      body: JSON.stringify({
        content: `**${kind}**\n> ${preview(body) || '(내용 없음)'}\n관리자 페이지: ${SITE_URL}/admin?tab=${adminTab}`,
        allowed_mentions: { parse: [] },
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // 알림 실패는 무시
  }
}
