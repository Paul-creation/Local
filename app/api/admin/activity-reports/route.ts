import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '../../../lib/adminAuth';
import { ACTIVITY_KEYS, activityLabel, isActivityKey } from '../../../lib/activities';
import { applyApproval, groupReports, isReportKind, type ReportKind } from '../../../lib/activityReports';
import { db, fail } from '../../../lib/community';
import { isUuid } from '../../../lib/uuid';

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

// 처리 안 된 활동 제보를 게임·활동·종류별로 묶어서 (voter_hash는 내보내지 않음). 서로 다른 제보자 3명 이상이 위
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const { data, error } = await db.from('game_activity_reports')
    .select('game_id, activity_key, kind, created_at')
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) return fail(error.message, 500);

  const groups = groupReports(data || []);
  const ids = [...new Set(groups.map((g) => g.gameId))];
  const { data: games } = ids.length
    ? await db.from('games').select('id, name, activities_confirmed, activities_unsure').in('id', ids)
    : { data: [] };
  type G = { id: string; name: string; activities_confirmed: string[] | null; activities_unsure: string[] | null };
  const byId = new Map(((games || []) as G[]).map((g) => [g.id, g]));
  const items = groups.map((g) => {
    const game = byId.get(g.gameId);
    const confirmed: string[] = game?.activities_confirmed || [];
    const unsure: string[] = game?.activities_unsure || [];
    return {
      ...g,
      name: game?.name ?? '(없는 게임)',
      label: activityLabel(g.key),
      now: confirmed.includes(g.key) ? 'confirmed' : unsure.includes(g.key) ? 'unsure' : 'none',
    };
  });
  return NextResponse.json({ items });
}

// 승인: games.activities_confirmed/unsure에 반영 + 그 묶음의 처리 안 된 제보에 시각 표시 / 무시: 표시만 (제보 기록은 지우지 않음)
export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const { gameId, key, kind, action } = await req.json().catch(() => ({}));
  if (typeof gameId !== 'string' || !isUuid(gameId) || !isActivityKey(key) || !isReportKind(kind) || (action !== 'approve' && action !== 'dismiss')) return fail('잘못된 요청이에요.');

  if (action === 'approve') {
    const { data: game } = await db.from('games').select('activities_confirmed, activities_unsure').eq('id', gameId).maybeSingle();
    if (!game) return fail('없는 게임이에요.', 404);
    const next = applyApproval(kind as ReportKind, key, game.activities_confirmed || [], game.activities_unsure || [], ACTIVITY_KEYS);
    const { error } = await db.from('games').update({ activities_confirmed: next.confirmed, activities_unsure: next.unsure }).eq('id', gameId);
    if (error) return fail(error.message, 500);
  }
  const { error } = await db.from('game_activity_reports')
    .update({ resolved_at: new Date().toISOString(), resolution: action === 'approve' ? 'approved' : 'dismissed' })
    .eq('game_id', gameId).eq('activity_key', key).eq('kind', kind).is('resolved_at', null);
  if (error) return fail(error.message, 500);
  return NextResponse.json({ ok: true });
}
