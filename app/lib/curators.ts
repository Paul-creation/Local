// 인스타 큐레이터(curators)·소개 게시물(curator_posts) 조회 — 읽기만 (쓰기는 service role, 당분간 SQL로 직접 입력)
// 표가 아직 없거나 조회가 실패하면 빈 결과 = 섹션 숨김 / 계정 페이지는 404
import { supabase } from './supabase';

export type Curator = { id: string; handle: string; display_name: string; instagram_url: string };
export type CuratorPost = { id: string; game_id: string; post_url: string; post_type: 'single' | 'collection'; posted_at: string };

// 게임을 소개한 계정 — 게시물 단위, posted_at 최신순
export async function getCuratorsOfGame(gameId: string) {
  const { data, error } = await supabase
    .from('curator_posts')
    .select('id, post_url, posted_at, curators(handle, display_name)')
    .eq('game_id', gameId)
    .order('posted_at', { ascending: false });
  if (error || !data) return [];
  return (data as unknown as { id: string; post_url: string; posted_at: string; curators: { handle: string; display_name: string } | null }[])
    .filter((r) => r.curators)
    .map((r) => ({ id: r.id, postUrl: r.post_url, handle: r.curators!.handle, displayName: r.curators!.display_name }));
}

export async function getCurator(handle: string): Promise<Curator | null> {
  const { data, error } = await supabase.from('curators').select('id, handle, display_name, instagram_url').eq('handle', handle).maybeSingle();
  return error ? null : (data as Curator | null);
}

export async function getCuratorPosts(curatorId: string): Promise<CuratorPost[]> {
  const { data, error } = await supabase
    .from('curator_posts')
    .select('id, game_id, post_url, post_type, posted_at')
    .eq('curator_id', curatorId)
    .order('posted_at', { ascending: false });
  return error || !data ? [] : (data as CuratorPost[]);
}
