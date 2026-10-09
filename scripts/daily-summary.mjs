// scripts/daily-summary.mjs
// 디스코드 일일 요약: 지난 24시간 새 글·댓글·게임 의견·의견함·신고 수 + 지금 숨김 중인 항목 수
// + 오늘 가격을 못 받은 게임 수 (3일 연속 실패한 게임은 이름까지) + 스트리머 영상 새로 연결된 수 + 분류 안 된 새 스팀 태그 수 (있을 때만)
// DISCORD_WEBHOOK_URL이 없으면 화면에만 출력. 개인정보(IP 해시·연락처·본문)는 보내지 않고 숫자만 보낸다
// 사용: node --env-file=.env.local scripts/daily-summary.mjs
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { readPurge } from './lib/privacy-purge.mjs';
import { readPriceCheck } from './lib/price-check.mjs';
import { readStreamerVideos } from './lib/streamer-videos.mjs';

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
// 개인정보 정리 결과 (purge-ip-hash·purge-old-records가 오늘 남긴 수, 개인정보 없이 숫자만)
const purge = readPurge();
const purgeLine = purge
  ? `🧹 개인정보 정리: IP 해시 ${purge.ipCleared ?? '-'}개 비움 · 신고 ${purge.reportsDeleted ?? '-'}개 · 의견함 ${purge.feedbackDeleted ?? '-'}개 삭제${purge.ipFailed || purge.recordsFailed ? ' ⚠️ 일부 실패 (Actions 로그 확인)' : ''}`
  : '🧹 개인정보 정리: 오늘 기록 없음 (purge 단계가 안 돌았거나 실패)';
// 가격 수집 결과 (fix-missing-prices·backfill-price-history-other가 오늘 남긴 수)
const price = readPriceCheck();
const priceParts = [['스팀', price?.steam], ['스팀 외', price?.other]]
  .filter(([, v]) => v)
  .map(([label, v]) => `${label} ${v.failed}/${v.checked}${v.unprocessed ? ` · 요청 제한 미처리 ${v.unprocessed}` : ''}`);
let priceLine = priceParts.length
  ? `💸 가격을 못 받은 게임: ${(price.steam?.failed ?? 0) + (price.other?.failed ?? 0)}개 (${priceParts.join(' · ')})`
  : '💸 가격 수집: 오늘 기록 없음 (가격 단계가 안 돌았거나 실패)';
// 3일 연속 실패 = 처음 실패한 날의 실행부터 오늘 실행까지 계속 못 받는 중 (매일 1번 실행 기준, 숨긴 게임·가격 유형 있는 게임 제외)
const streakSince = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000).toISOString();
const streakQuery = () => db.from('games').select('name, price_check_note, price_check_failed_since')
  .lte('price_check_failed_since', streakSince).is('price_type', null).order('price_check_failed_since');
let streak = await streakQuery().eq('hidden', false);
if (streak.error) streak = await streakQuery(); // hidden 칸이 아직 없을 때
if (streak.error) {
  priceLine += '\n   (연속 실패 확인 불가 — 마이그레이션 20261010090000_price_check_status.sql 실행 필요)';
} else if (streak.data.length) {
  const MAX = 15;
  const names = streak.data.slice(0, MAX).map((g) => `${g.name} (${g.price_check_note ?? '이유 모름'})`);
  priceLine += `\n   ⚠️ 3일 연속 실패 ${streak.data.length}개: ${names.join(', ')}${streak.data.length > MAX ? ` 외 ${streak.data.length - MAX}개` : ''}`;
}
// 분류 안 된 새 스팀 태그 (link-new-game-tags가 기록, tree·제외·합치기 파일에 넣으면 빠짐) — 있을 때만 한 줄
let tagLine = '';
const unclassified = await db.from('tag_unclassified').select('steam_tag_id, en, ko, game_count').order('game_count', { ascending: false });
if (!unclassified.error) {
  const readIds = (path, pick) => {
    try { return JSON.parse(fs.readFileSync(path, 'utf8'))[pick[0]].map(pick[1]); } catch { return []; }
  };
  const known = new Set([
    ...readIds('data/tags/tree.json', ['nodes', (n) => n.steam_tag_id]),
    ...readIds('data/tags/excluded.json', ['tags', (t) => t.id]),
    ...readIds('data/tags/merged.json', ['merges', (m) => m.from.id]),
  ]);
  const left = unclassified.data.filter((t) => !known.has(Number(t.steam_tag_id)));
  if (left.length) {
    const names = left.slice(0, 10).map((t) => `${t.ko || t.en} ${t.game_count}개`);
    tagLine = `\n🏷️ 분류 안 된 새 태그 ${left.length}개: ${names.join(', ')}${left.length > 10 ? ` 외 ${left.length - 10}개` : ''} (data/tags/tree.json에 넣거나 제외)`;
  }
}
// 스트리머 영상 수집 결과 (fetch-streamer-videos --apply가 오늘 남긴 수)
const streamer = readStreamerVideos();
const streamerLine = streamer
  ? `스트리머 영상 새로 연결 ${streamer.linked}개 (연결 안 된 새 영상 ${streamer.unlinked}개 · YouTube ${streamer.units}유닛)`
  : '스트리머 영상: 오늘 기록 없음 (수집 단계가 안 돌았거나 표가 아직 없음)';
const message = `${content}\n${purgeLine}\n${priceLine}\n${streamerLine}${tagLine}`;
console.log(message);

const url = process.env.DISCORD_WEBHOOK_URL;
if (!url) {
  console.log('DISCORD_WEBHOOK_URL 없음 → 디스코드 전송 건너뜀');
} else {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message, allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(10000),
    });
    console.log(res.ok ? '디스코드 전송 완료' : `디스코드 전송 실패 (${res.status}) — 요약은 위에 출력됨`);
  } catch (e) {
    console.log(`디스코드 전송 실패 (${e.message}) — 요약은 위에 출력됨`);
  }
}
