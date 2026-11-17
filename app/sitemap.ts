import type { MetadataRoute } from 'next';
import { supabase } from './lib/supabase';
import { SITE_URL } from './lib/site';
import { BOARD_KEYS } from './lib/communityBoards';
import { selectGames } from './lib/visibleGames';
import { readAllPages } from './lib/paged';
import { LASTMOD_FIELDS, gameLastmod } from './lib/sitemapLastmod';

export const revalidate = 86400; // 하루에 한 번 새로 만들기

// 큐레이터 페이지(/c/…)와 미리보기는 넣지 않는다 — 동의(consent_status) 전 공개 금지, 동의 뒤에도 사이트맵 노출은 따로 정한다
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data: games } = await readAllPages((from, to) => selectGames(`id, ${LASTMOD_FIELDS}`)
    .order('checked_at', { referencedTable: 'price_history', ascending: false })
    .limit(1, { referencedTable: 'price_history' }) // 가격 기록은 게임마다 최신 1건만
    .order('id').range(from, to)); // 1,000개 넘는 게임도 모두
  return [
    { url: SITE_URL },
    { url: `${SITE_URL}/this-week` },
    ...['/guide', '/about', '/faq'].map((p) => ({ url: `${SITE_URL}${p}` })),
    ...['/privacy', '/terms'].map((p) => ({ url: `${SITE_URL}${p}` })),
    ...['', ...BOARD_KEYS.map((b) => `/${b}`)].map((p) => ({ url: `${SITE_URL}/community${p}` })),
    ...(games || []).map((g) => ({
      url: `${SITE_URL}/games/${g.id}`,
      lastModified: gameLastmod(g), // 실제로 내용이 바뀐 날 (lib/sitemapLastmod)
    })),
  ];
}
