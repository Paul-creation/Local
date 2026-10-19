// 인스타 큐레이터(curators)·소개 게시물(curator_posts) 조회 — 읽기만 (쓰기는 service role, 당분간 SQL로 직접 입력)
// 표가 아직 없거나 조회가 실패하면 빈 결과 = 섹션 숨김 / 계정 페이지는 404
import { supabase } from './supabase';
import { selectGames } from './visibleGames';
import { gameName } from './gameName';

export type Curator = { id: string; handle: string; display_name: string; instagram_url: string; avatar_url: string | null };
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
  const { data, error } = await supabase.from('curators').select('id, handle, display_name, instagram_url, avatar_url').eq('handle', handle).maybeSingle();
  if (!error) return data as Curator | null;
  // avatar_url 열이 아직 없으면(마이그레이션 전) 열 없이 다시 조회
  const { data: legacy, error: err2 } = await supabase.from('curators').select('id, handle, display_name, instagram_url').eq('handle', handle).maybeSingle();
  return err2 || !legacy ? null : ({ ...legacy, avatar_url: null } as Curator);
}

export async function getCuratorPosts(curatorId: string): Promise<CuratorPost[]> {
  const { data, error } = await supabase
    .from('curator_posts')
    .select('id, game_id, post_url, post_type, posted_at')
    .eq('curator_id', curatorId)
    .order('posted_at', { ascending: false });
  return error || !data ? [] : (data as CuratorPost[]);
}

// 메인 "인스타에서 봤던 그 게임" — 동의받은 계정(show_on_home)만. 연결 게임(숨긴 게임 제외)이 1개 이상인 계정이 HOME_CURATORS_MIN개 이상일 때만 돌려주고, 아니면 빈 배열 = 섹션 없음
export const HOME_CURATORS_MIN = 2;
export const HOME_CURATOR_NAMES = 3;
export type HomeCurator = { handle: string; displayName: string; avatarUrl: string | null; gameCount: number; recentNames: string[] };

export async function getHomeCurators(): Promise<HomeCurator[]> {
  let res = await supabase.from('curators').select('id, handle, display_name, avatar_url').eq('show_on_home', true);
  // avatar_url 열이 아직 없으면(마이그레이션 전) 열 없이 다시 조회
  if (res.error) res = (await supabase.from('curators').select('id, handle, display_name').eq('show_on_home', true)) as typeof res;
  if (res.error || !res.data?.length) return [];
  const curators = res.data as unknown as { id: string; handle: string; display_name: string; avatar_url?: string | null }[];

  const { data: posts, error } = await supabase
    .from('curator_posts')
    .select('curator_id, game_id, posted_at')
    .in('curator_id', curators.map((c) => c.id))
    .order('posted_at', { ascending: false });
  if (error || !posts?.length) return [];
  const gameIds = [...new Set(posts.map((p) => p.game_id as string))];
  const { data: games, error: gErr } = await selectGames('id, name, display_name').in('id', gameIds);
  if (gErr || !games) return [];
  const nameById = new Map((games as unknown as { id: string; name: string | null; display_name: string | null }[]).map((g) => [g.id, gameName(g)]));

  const out: HomeCurator[] = [];
  for (const c of curators) {
    // 최신 소개순, 같은 게임은 한 번만 (숨긴 게임은 nameById에 없어 빠진다)
    const ids = [...new Set(posts.filter((p) => p.curator_id === c.id).map((p) => p.game_id as string))].filter((id) => nameById.has(id));
    if (!ids.length) continue;
    out.push({ handle: c.handle, displayName: c.display_name, avatarUrl: c.avatar_url || null, gameCount: ids.length, recentNames: ids.slice(0, HOME_CURATOR_NAMES).map((id) => nameById.get(id)!) });
  }
  return out.length >= HOME_CURATORS_MIN ? out : [];
}
