// 상세·카드에 보여 줄 태그를 묶고 고르는 표시 로직 (DB 값은 그대로, 여기서만 처리)
// 상세: ① 수상·순위(특별 칩) ② 플레이 방식 ③ 장르 ④ 특징 / 카드: 특별 1 + 플레이 방식 1 + 장르 1 (최대 3, 넘치면 생략)
// 플레이 방식은 태그 나무에 없다(협동·대전은 필터 플래그가 담당) → games.category·has_online_coop·has_local_coop·has_pvp에서 만든다
import { translateTag } from './tagTranslate';
import { nameToTagId, tagName, type TagTree } from './tagTree';
import { sortGoty, gotyLabel } from './goty';

export type ChipKind = 'special' | 'play' | 'genre' | 'feature';
export type Chip = { text: string; kind: ChipKind; desc?: string };
export type ChipGroup = { label: string; chips: Chip[] };

type GameLike = {
  category?: string | null;
  has_online_coop?: boolean | null;
  has_local_coop?: boolean | null;
  has_pvp?: boolean | null;
  tag_ids?: number[] | null;
  tags?: string[] | null;
  goty_awards?: unknown;
};

// 플레이 방식 칩 — 더 구체적인 쪽만: 온라인·로컬 협동이 있으면 그냥 "협동"은 뺀다
export function playChips(game: GameLike): Chip[] {
  const cat = game.category || '';
  const online = game.has_online_coop === true;
  const local = game.has_local_coop === true;
  const pvp = game.has_pvp === true || cat === '대전' || cat === '협동·대전';
  const coop = cat === '협동' || cat === '협동·대전';
  const chips: Chip[] = [];
  if (online) chips.push({ text: '온라인 협동', kind: 'play', desc: '인터넷으로 친구와 함께 플레이하는 협동 모드가 있어요' });
  if (local) chips.push({ text: '로컬 협동', kind: 'play', desc: '한 화면이나 한 컴퓨터에서 같이 플레이하는 협동 모드가 있어요' });
  if (coop && !online && !local) chips.push({ text: '협동', kind: 'play', desc: '친구와 함께 플레이하는 협동 모드가 있어요' });
  if (pvp) chips.push({ text: '대전', kind: 'play', desc: '플레이어끼리 겨루는 대전 모드가 있어요' });
  if (!chips.length && cat === '혼자') chips.push({ text: '혼자 플레이', kind: 'play', desc: '혼자서 즐기는 게임이에요' });
  return chips;
}

// 같은 뜻으로 겹치는 태그(플레이 방식 칩이 대신함)
const PLAY_DUP = new Set(['협동', '온라인 협동', '로컬 협동', '온라인 대전', '대전', 'PvP', '멀티플레이어', '혼자 플레이', '싱글 플레이어']);

function rootGroup(tree: TagTree, id: number) {
  let cur = tree.nodes.get(id);
  while (cur?.parent != null) cur = tree.nodes.get(cur.parent);
  return cur?.group ?? null;
}

// 태그 나무 태그 → 장르 / 특징 (게임에 붙은 순서 = 투표 순위순 그대로). 위 칸과 이름이 겹치면 더 구체적인 쪽만
export function treeChips(tree: TagTree | null, game: GameLike): { genre: Chip[]; feature: Chip[] } {
  const genre: Chip[] = [];
  const feature: Chip[] = [];
  const entries: { id: number | null; name: string }[] = [];
  if (game.tag_ids?.length && tree) {
    for (const id of game.tag_ids) { const name = tagName(tree, id); if (name) entries.push({ id, name }); }
  } else {
    for (const raw of game.tags || []) {
      const name = translateTag(raw);
      entries.push({ id: tree ? nameToTagId(tree, name) : null, name });
    }
  }
  const present = new Set(entries.map((e) => e.id).filter((v): v is number => v != null));
  const covered = new Set<number>();
  if (tree) {
    for (const e of entries) {
      if (e.id == null) continue;
      for (let p = tree.nodes.get(e.id)?.parent ?? null; p != null; p = tree.nodes.get(p)?.parent ?? null) {
        if (present.has(p) && e.name.includes(tagName(tree, p))) covered.add(p);
      }
    }
  }
  const seen = new Set<string>();
  for (const e of entries) {
    if (PLAY_DUP.has(e.name) || (e.id != null && covered.has(e.id)) || seen.has(e.name)) continue;
    seen.add(e.name);
    const isGenre = tree && e.id != null && rootGroup(tree, e.id) === 'g:genre';
    (isGenre ? genre : feature).push({ text: e.name, kind: isGenre ? 'genre' : 'feature' });
  }
  return { genre, feature };
}

// 특별 칩 — TOP 10, 올해의 게임(수상·후보). 상세는 전부, 카드는 대표 1개
function specialChips(game: GameLike, isTop10: boolean): Chip[] {
  const chips: Chip[] = [];
  if (isTop10) chips.push({ text: 'TOP 10', kind: 'special', desc: '지금 뜨는 게임 순위 TOP 10에 올라 있어요' });
  for (const a of sortGoty(game.goty_awards)) {
    chips.push({ text: gotyLabel(a), kind: 'special', desc: `The Game Awards ${a.year} 올해의 게임 ${a.result === 'winner' ? '수상' : '후보'}` });
  }
  return chips;
}

export function detailChipGroups(tree: TagTree | null, game: GameLike, isTop10: boolean): ChipGroup[] {
  const { genre, feature } = treeChips(tree, game);
  return [
    { label: '수상·순위', chips: specialChips(game, isTop10) },
    { label: '플레이 방식', chips: playChips(game) },
    { label: '장르', chips: genre },
    { label: '특징', chips: feature },
  ].filter((g) => g.chips.length > 0);
}

// 카드: 특별 칩(수상 우선, 없으면 TOP 10, 후보는 그다음) 1 + 플레이 방식 1 + 장르 1
export function cardChips(tree: TagTree | null, game: GameLike, isTop10: boolean): Chip[] {
  const awards = sortGoty(game.goty_awards);
  const special = awards[0]?.result === 'winner' ? specialChips(game, false)[0]
    : isTop10 ? specialChips(game, true)[0]
    : specialChips(game, false)[0];
  return [special, playChips(game)[0], treeChips(tree, game).genre[0]].filter((c): c is Chip => !!c);
}
