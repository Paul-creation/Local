import { NextResponse } from 'next/server';
import { selectHomeGames } from '../../../lib/visibleGames';
import { readAllPages } from '../../../lib/paged';
import { supabase } from '../../../lib/supabase';
import type { TasteRow } from '../../../lib/taste';

// 내 라이브러리 "취향 비슷한 게임"용 — 게임별 태그 번호·득표·확인된 활동만 (읽기 전용, 공개 정보). 보유 목록 같은 개인 정보는 받지 않고, 취향 계산은 브라우저가 한다
// 숨긴 게임(hidden)과 메인 노출 제외 게임(home_excluded)은 빠진다(selectHomeGames). 득표 0 이하 태그는 뺌, 태그·활동이 하나도 없는 게임은 줄 자체를 뺌
// 1시간마다 새로 만들고 그 사이에는 만들어 둔 응답을 그대로 준다 (/api/games/list와 같은 방식). 조회가 실패하면 예외를 던져서 직전 캐시를 계속 쓴다
export const dynamic = 'force-static';
export const revalidate = 3600;

export async function GET() {
  const [games, tags] = await Promise.all([
    readAllPages((from, to) => selectHomeGames('id, activities_confirmed').order('id').range(from, to)),
    readAllPages((from, to) => supabase.from('game_tags').select('game_id, tag_id, votes').gt('votes', 0).order('game_id').order('tag_id').range(from, to)),
  ]);
  if (games.error || !games.data) throw new Error(`게임 조회 실패: ${games.error?.message}`);
  if (tags.error || !tags.data) throw new Error(`태그 조회 실패: ${tags.error?.message}`);

  const tagsOf = new Map<string, [number, number][]>();
  for (const r of tags.data as { game_id: string; tag_id: number | string; votes: number }[]) {
    const list = tagsOf.get(r.game_id) ?? [];
    list.push([Number(r.tag_id), r.votes]);
    tagsOf.set(r.game_id, list);
  }
  const rows: TasteRow[] = [];
  for (const g of games.data as unknown as { id: string; activities_confirmed: string[] | null }[]) {
    const t = tagsOf.get(g.id) ?? [];
    const a = g.activities_confirmed ?? [];
    if (t.length || a.length) rows.push([g.id, t, a]);
  }
  return NextResponse.json(rows);
}
