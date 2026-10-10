// 가이드 "영상으로 미리 보기"의 예시 게임 — 스트리머 영상이 연결된 게임 중 인기 순위(heat_rank)가 가장 높은 게임 하나
// 못 골라도(표 읽기 실패·영상 없음) 가이드는 그대로 뜨고 그 버튼만 숨는다. 호출하는 /guide 페이지가 revalidate 3600
import { supabase } from './supabase';
import { selectHomeGames } from './visibleGames';

export async function getExampleVideoGameId(): Promise<string | null> {
  try {
    const { data: rows, error } = await supabase
      .from('streamer_videos')
      .select('game_id')
      .order('published_at', { ascending: false })
      .limit(500);
    if (error || !rows?.length) return null;
    const ids = [...new Set((rows as { game_id: string }[]).map((r) => r.game_id).filter(Boolean))];
    const { data: games } = await selectHomeGames('id, heat_rank')
      .in('id', ids)
      .not('heat_rank', 'is', null)
      .order('heat_rank', { ascending: true })
      .limit(1);
    return ((games as { id: string }[] | null)?.[0]?.id) ?? null;
  } catch {
    return null;
  }
}
