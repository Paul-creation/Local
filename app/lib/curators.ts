// 인스타 큐레이터(curators)·소개 게시물(curator_posts) 조회 — 읽기만 (쓰기는 service role, 당분간 SQL로 직접 입력)
// 표가 아직 없거나 조회가 실패하면 빈 결과 = 섹션 숨김 / 계정 페이지는 404
import { cache } from 'react';
import { supabase } from './supabase';
import { selectGames } from './visibleGames';
import { getCardGames } from './gameIndex';
import { gameName } from './gameName';
import type { Cover } from './homeMain';
import type { PostRow } from './curatorView';

export type Curator = { id: string; handle: string; display_name: string; instagram_url: string; avatar_url: string | null; bio: string | null };
export type CuratorPost = PostRow;

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

// bio 칸이 아직 없는 DB(마이그레이션 전)면 그 칸 없이 다시 조회
export async function getCurator(handle: string): Promise<Curator | null> {
  const q = (cols: string) => supabase.from('curators').select(cols).eq('handle', handle).maybeSingle();
  const first = await q('id, handle, display_name, instagram_url, avatar_url, bio');
  if (!first.error) return first.data as unknown as Curator | null;
  const second = await q('id, handle, display_name, instagram_url, avatar_url');
  return second.error || !second.data ? null : ({ ...(second.data as unknown as Curator), bio: null });
}

// post_title 칸이 아직 없는 DB(마이그레이션 전)면 그 칸 없이 다시 조회
export async function getCuratorPosts(curatorId: string): Promise<CuratorPost[]> {
  const q = (cols: string) => supabase.from('curator_posts').select(cols).eq('curator_id', curatorId).order('posted_at', { ascending: false }).order('id');
  const first = await q('id, game_id, post_url, post_type, post_title, posted_at');
  if (!first.error && first.data) return first.data as unknown as CuratorPost[];
  const second = await q('id, game_id, post_url, post_type, posted_at');
  return second.error || !second.data ? [] : (second.data as unknown as CuratorPost[]);
}

// 프로필 페이지 한 번에 — 계정·게시물·카드 게임 (페이지와 메타데이터가 같은 요청 안에서 한 번만 조회)
export const getCuratorProfile = cache(async (handle: string) => {
  const curator = await getCurator(handle);
  if (!curator) return null;
  const posts = await getCuratorPosts(curator.id);
  const ids = [...new Set(posts.map((p) => p.game_id))];
  const games = await getCardGames(ids).catch(() => []);
  return { curator, posts, games };
});

// 공유 미리보기용 — 보이는 게임 수만 (카드 조회보다 가볍게)
export async function getCuratorGameCount(curatorId: string): Promise<number | null> {
  const posts = await getCuratorPosts(curatorId);
  const ids = [...new Set(posts.map((p) => p.game_id))];
  if (!ids.length) return 0;
  const { data, error } = await selectGames('id').in('id', ids);
  return error || !data ? null : data.length;
}

// 메인 "인스타에서 봤던 그 게임" — 동의받은 계정(show_on_home)만. 연결 게임(숨긴 게임·메인 노출 제외 게임 제외)이 1개 이상인 계정이 HOME_CURATORS_MIN개 이상일 때만 돌려주고, 아니면 null = 섹션 없음
// 계정마다 카드 하나: 소개한 게임 수(같은 게임은 한 번)·게시물 수(보이는 게임에 연결된 게시물)·최근 게시물 순 게임 표지 5장·최근 게임 이름 3개. 출시 예정 게임도 포함
// 계정 순서는 소개한 게임 수 많은 순 (같으면 handle 순)
export const HOME_CURATORS_MIN = 2;
export const HOME_CURATOR_COVERS = 5;
export const HOME_CURATOR_RECENT = 3;
export type HomeCuratorCard = { handle: string; displayName: string; gameCount: number; postCount: number; covers: Cover[]; recent: string[] };
export type HomeCurators = { cards: HomeCuratorCard[] };

export async function getHomeCurators(): Promise<HomeCurators | null> {
  const { data: curators, error: cErr } = await supabase.from('curators').select('id, handle, display_name').eq('show_on_home', true);
  if (cErr || !curators?.length) return null;

  const { data: posts, error } = await supabase
    .from('curator_posts')
    .select('curator_id, game_id, posted_at')
    .in('curator_id', curators.map((c) => c.id))
    .order('posted_at', { ascending: false })
    .order('id');
  if (error || !posts?.length) return null;
  const gameIds = [...new Set(posts.map((p) => p.game_id as string))];
  const { data: games, error: gErr } = await selectGames('id, name, display_name, cover_vertical_url, steam_appid, card_image_url, cover_image_url').eq('home_excluded', false).in('id', gameIds);
  if (gErr || !games) return null;
  type GameRow = { id: string; name: string; display_name: string | null; cover_vertical_url: string | null; steam_appid: string | null; card_image_url: string | null; cover_image_url: string | null };
  const byGame = new Map((games as unknown as GameRow[]).map((g) => [g.id, g]));

  const cards: HomeCuratorCard[] = [];
  for (const c of curators) {
    const mine = posts.filter((p) => p.curator_id === c.id && byGame.has(p.game_id as string)); // 최근 게시물이 앞
    const distinct = [...new Set(mine.map((p) => p.game_id as string))].map((id) => byGame.get(id)!);
    if (!distinct.length) continue;
    cards.push({
      handle: c.handle as string,
      displayName: c.display_name as string,
      gameCount: distinct.length,
      postCount: mine.length,
      covers: distinct.slice(0, HOME_CURATOR_COVERS).map((g) => ({ vertical: g.cover_vertical_url, appid: g.steam_appid, wide: g.card_image_url || g.cover_image_url })),
      recent: distinct.slice(0, HOME_CURATOR_RECENT).map((g) => gameName(g)),
    });
  }
  cards.sort((a, b) => b.gameCount - a.gameCount || a.handle.localeCompare(b.handle));
  return cards.length >= HOME_CURATORS_MIN ? { cards } : null;
}
