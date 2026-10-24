// 계정 프로필 페이지의 순수 계산 — 게시물별 묶기, 날짜 글자, 게임 전체 보기의 필터·정렬 (화면·테스트 공용)
export type PostRow = { id: string; game_id: string; post_url: string; post_type: 'single' | 'collection'; post_title?: string | null; posted_at: string };
export type PostSection = { key: string; url: string; postedAt: string; title: string; gameIds: string[] };
export type GameEntry = { gameId: string; postedAt: string; posts: { id: string; url: string }[] };

// 같은 post_url끼리 한 섹션 (최신 posted_at 순). 보이는 게임이 없는 게시물은 뺀다
// 제목: post_title → 게임 1개면 게임 이름 → "게임 N개 모음"
export function groupByPost(posts: PostRow[], visible: Map<string, string>): PostSection[] {
  const map = new Map<string, PostSection>();
  for (const p of posts) {
    if (!visible.has(p.game_id)) continue;
    const cur = map.get(p.post_url);
    const title = p.post_title?.trim() || '';
    if (!cur) {
      map.set(p.post_url, { key: p.post_url, url: p.post_url, postedAt: p.posted_at, title, gameIds: [p.game_id] });
      continue;
    }
    if (p.posted_at > cur.postedAt) cur.postedAt = p.posted_at;
    if (!cur.title && title) cur.title = title;
    if (!cur.gameIds.includes(p.game_id)) cur.gameIds.push(p.game_id);
  }
  return [...map.values()]
    .map((s) => ({ ...s, title: s.title || (s.gameIds.length === 1 ? visible.get(s.gameIds[0])! : `게임 ${s.gameIds.length}개 모음`) }))
    .sort((a, b) => (a.postedAt < b.postedAt ? 1 : a.postedAt > b.postedAt ? -1 : 0));
}

// 게임별로 묶기 — 순서는 게임의 가장 최신 posted_at 기준 (posts는 최신순으로 들어온다)
export function groupByGame(posts: PostRow[], visible: Map<string, string>): GameEntry[] {
  const map = new Map<string, GameEntry>();
  for (const p of posts) {
    if (!visible.has(p.game_id)) continue;
    const cur = map.get(p.game_id);
    if (!cur) map.set(p.game_id, { gameId: p.game_id, postedAt: p.posted_at, posts: [{ id: p.id, url: p.post_url }] });
    else {
      cur.posts.push({ id: p.id, url: p.post_url });
      if (p.posted_at > cur.postedAt) cur.postedAt = p.posted_at;
    }
  }
  return [...map.values()].sort((a, b) => (a.postedAt < b.postedAt ? 1 : a.postedAt > b.postedAt ? -1 : 0));
}

// "10월 4일" (한국 시간). 올해가 아니면 "2025년 10월 4일"
export function dateLabel(iso: string, now: Date = new Date()) {
  const f = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', ...opts }).format(new Date(iso));
  const year = (d: Date) => new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(d);
  const md = f({ month: 'long', day: 'numeric' });
  return year(new Date(iso)) === year(now) ? md : `${f({ year: 'numeric' })} ${md}`;
}

export type GameFilter = 'sale' | 'multi' | 'soon';
export type GameSort = 'recent' | 'discount' | 'review';
// 게임 전체 보기 — 필터는 겹쳐 쓰면 모두 만족하는 게임만, 정렬은 안정(같으면 최근 소개순 유지)
type Facts = { discount: number; multi: boolean; soon: boolean; reviewPercent: number; reviewTotal: number };
export function filterSortEntries<T extends GameEntry>(entries: T[], facts: (e: T) => Facts, filters: GameFilter[], sort: GameSort): T[] {
  const ok = (e: T) => {
    const f = facts(e);
    return (!filters.includes('sale') || f.discount > 0) && (!filters.includes('multi') || f.multi) && (!filters.includes('soon') || f.soon);
  };
  const out = entries.filter(ok);
  if (sort === 'discount') return [...out].sort((a, b) => facts(b).discount - facts(a).discount);
  if (sort === 'review') return [...out].sort((a, b) => facts(b).reviewPercent - facts(a).reviewPercent || facts(b).reviewTotal - facts(a).reviewTotal);
  return out;
}
