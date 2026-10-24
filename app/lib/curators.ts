// 인스타 큐레이터(curators)·소개 게시물(curator_posts) 조회 — 읽기만 (쓰기는 service role, 당분간 SQL로 직접 입력)
// 표가 아직 없거나 조회가 실패하면 빈 결과 = 섹션 숨김 / 계정 페이지는 404
import { supabase } from './supabase';
import { selectGames } from './visibleGames';
import { getCardGames } from './gameIndex';
import { getCardExtras } from './cardExtras';
import type { CardExtras } from './cardInfo';
import type { CardGame } from './peopleRecs';
import { mixByCurator, latestPerGame } from './curatorMix';

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

// 메인 "인스타에서 봤던 그 게임" — 동의받은 계정(show_on_home)만. 연결 게임(숨긴 게임·메인 노출 제외 게임 제외)이 1개 이상인 계정이 HOME_CURATORS_MIN개 이상일 때만 돌려주고, 아니면 null = 섹션 없음
// 카드: 계정들의 소개 게시물 게임을 최신 게시물순으로, 같은 게임은 최신 게시물 하나만(출처 계정도 그 게시물 기준), 한 계정이 3장 연속 나오지 않게 섞어 최대 12장 (lib/curatorMix)
// 출시 예정 게임도 포함 (카드가 "출시 예정 · …"으로 표시). 칩의 숫자는 그 계정이 소개한 게임 수 전체(카드에 안 나온 게임 포함)
export const HOME_CURATORS_MIN = 2;
export type HomeCuratorChip = { handle: string; displayName: string; gameCount: number };
export type HomeCuratorCard = { game: CardGame; handle: string; displayName: string };
export type HomeCurators = { chips: HomeCuratorChip[]; cards: HomeCuratorCard[] };

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
  const { data: games, error: gErr } = await selectGames('id').eq('home_excluded', false).in('id', gameIds);
  if (gErr || !games) return null;
  const visible = new Set((games as unknown as { id: string }[]).map((g) => g.id));

  const byId = new Map(curators.map((c) => [c.id as string, c]));
  const shown = posts.filter((p) => visible.has(p.game_id as string) && byId.has(p.curator_id as string));
  const chips: HomeCuratorChip[] = curators
    .map((c) => ({ handle: c.handle as string, displayName: c.display_name as string, gameCount: new Set(shown.filter((p) => p.curator_id === c.id).map((p) => p.game_id as string)).size }))
    .filter((c) => c.gameCount > 0)
    .sort((a, b) => b.gameCount - a.gameCount || a.handle.localeCompare(b.handle));
  if (chips.length < HOME_CURATORS_MIN) return null;

  const picked = mixByCurator(latestPerGame(shown).map((p) => ({ curator: p.curator_id as string, gameId: p.game_id as string })));
  try {
    const [cards, extras] = await Promise.all([getCardGames(picked.map((p) => p.gameId)), getCardExtras(picked.map((p) => p.gameId)).catch(() => ({} as Record<string, CardExtras>))]);
    // 칩은 안 쓰는 카드라 태그 번호는 보내지 않는다 (인원별 추천과 같음)
    const gameById = new Map((cards as CardGame[]).map(({ tag_ids, ...g }) => { void tag_ids; return [g.id, { ...g, ...extras[g.id] } as CardGame] as const; }));
    const out: HomeCuratorCard[] = picked.filter((p) => gameById.has(p.gameId)).map((p) => {
      const c = byId.get(p.curator)!;
      return { game: gameById.get(p.gameId)!, handle: c.handle as string, displayName: c.display_name as string };
    });
    return out.length ? { chips, cards: out } : null;
  } catch {
    return null;
  }
}
