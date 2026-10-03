import { redirect } from 'next/navigation';
import { playersBucket } from '../lib/players';

// /games?players=5 · /games?sale=1 같은 주소를 메인 검색 결과(필터 적용)로 보낸다
export default async function GamesIndex({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = new URLSearchParams({ r: '1' });
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string' && ['q', 'cat', 'tags', 'p', 'd', 'free', 'sale', 'cmp'].includes(k)) q.set(k, v);
  }
  const p = playersBucket(Number(sp.players));
  if (p && !q.has('p')) q.set('p', p);
  redirect(`/?${q}`);
}
