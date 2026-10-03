// scripts/daily-summary.mjs
// 디스코드 일일 요약: 지난 24시간 새 글·댓글·게임 의견·의견함·신고 수 + 지금 숨김 중인 항목 수
// DISCORD_WEBHOOK_URL이 없으면 화면에만 출력. 개인정보(IP 해시·연락처·본문)는 보내지 않고 숫자만 보낸다
// 사용: node --env-file=.env.local scripts/daily-summary.mjs
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://game-info-hub.vercel.app').replace(/\/$/, '');
const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

async function count(table, apply) {
  const { count, error } = await apply(db.from(table).select('*', { count: 'exact', head: true }));
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}
const recent = (table) => count(table, (q) => q.gte('created_at', since));
const hiddenNow = (table) => count(table, (q) => q.eq('hidden', true));

const [posts, comments, gameComments, feedback, reports, hPosts, hComments, hGame] = await Promise.all([
  recent('posts'), recent('post_comments'), recent('game_comments'), recent('feedback'), recent('post_reports'),
  hiddenNow('posts'), hiddenNow('post_comments'), hiddenNow('game_comments'),
]);
const hidden = hPosts + hComments + hGame;
const total = posts + comments + gameComments + feedback + reports + hidden;

const content = total === 0
  ? '🌙 **일일 요약** · 조용한 하루 (새 글·댓글·의견·신고 없음, 숨김 항목 없음)'
  : [
      '📊 **일일 요약** (지난 24시간)',
      `새 글 ${posts} · 댓글 ${comments} · 게임 의견 ${gameComments} · 의견함 ${feedback} · 신고 ${reports}`,
      `지금 숨김 중: ${hidden}개 (글 ${hPosts} · 댓글 ${hComments} · 게임 의견 ${hGame})`,
      `관리자 페이지: ${SITE}/admin?tab=${feedback ? 'feedback' : reports ? 'reports' : 'hidden'}`,
    ].join('\n');
console.log(content);

const url = process.env.DISCORD_WEBHOOK_URL;
if (!url) {
  console.log('DISCORD_WEBHOOK_URL 없음 → 디스코드 전송 건너뜀');
} else {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(10000),
    });
    console.log(res.ok ? '디스코드 전송 완료' : `디스코드 전송 실패 (${res.status}) — 요약은 위에 출력됨`);
  } catch (e) {
    console.log(`디스코드 전송 실패 (${e.message}) — 요약은 위에 출력됨`);
  }
}
