import type { MetadataRoute } from 'next';
import { supabase } from './lib/supabase';
import { SITE_URL } from './lib/site';
import { BOARD_KEYS } from './lib/communityBoards';

export const revalidate = 86400; // 하루에 한 번 새로 만들기

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data: games } = await supabase.from('games').select('id, created_at');
  return [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    ...['', ...BOARD_KEYS.map((b) => `/${b}`)].map((p) => ({ url: `${SITE_URL}/community${p}`, changeFrequency: 'daily' as const, priority: 0.6 })),
    ...(games || []).map((g) => ({
      url: `${SITE_URL}/games/${g.id}`,
      lastModified: g.created_at ? new Date(g.created_at) : undefined,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
