import { redirect } from 'next/navigation';

// /games?players=5 · /games?sale=1 같은 주소를 메인 검색 결과(필터 적용)로 보낸다
// players=N은 메인에서 N~N명 범위로 읽는다 (app/lib/rangeFilter)
export default async function GamesIndex({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = new URLSearchParams({ r: '1' });
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string' && ['q', 'cat', 'tags', 'p', 'players', 'price', 'solo', 'd', 'free', 'sale', 'cmp'].includes(k)) q.set(k, v);
  }
  redirect(`/?${q}`);
}
