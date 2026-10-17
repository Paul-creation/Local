import { NextRequest, NextResponse } from 'next/server';
import { getIp } from '../../lib/aiGuard';
import { isActivityKey } from '../../lib/activities';
import { isReportKind, reportable } from '../../lib/activityReports';
import { db, fail, ipHash, since24h } from '../../lib/community';
import { isUuid } from '../../lib/uuid';
import { selectGames } from '../../lib/visibleGames';

const DAILY_REPORTS_PER_IP = 20;

// 활동 제보 — 로그인 없이 게임 + 활동 키 + 종류(빠진/틀린). 브라우저는 표에 직접 못 쓰고 여기(service role)로만
export async function POST(req: NextRequest) {
  const { gameId, key, kind } = await req.json().catch(() => ({}));
  if (typeof gameId !== 'string' || !isUuid(gameId) || !isActivityKey(key) || !isReportKind(kind)) return fail('잘못된 요청이에요.');

  const voter = ipHash(getIp(req.headers));
  const [{ data: game }, { count }] = await Promise.all([
    selectGames('id, activities_confirmed, activities_unsure', undefined, db).eq('id', gameId).maybeSingle(),
    db.from('game_activity_reports').select('id', { count: 'exact', head: true }).eq('voter_hash', voter).gte('created_at', since24h()),
  ]);
  if (!game) return fail('없는 게임이에요.', 404);
  if (!reportable(kind, key, game.activities_confirmed || [], game.activities_unsure || [])) return fail('이미 반영된 활동이에요.');
  if ((count ?? 0) >= DAILY_REPORTS_PER_IP) return fail('오늘은 제보를 충분히 보내주셨어요. 내일 다시 보내주세요.', 429);

  const { error } = await db.from('game_activity_reports').insert({ game_id: gameId, activity_key: key, kind, voter_hash: voter });
  // 같은 사람이 같은 제보를 또 보냄 → 조용히 무시 (중복 방지 인덱스)
  if (error && error.code !== '23505') return fail('보내지 못했어요. 잠시 후 다시 시도해주세요.', 500);
  return NextResponse.json({ ok: true });
}
