import type { Metadata } from 'next';
import { supabase } from '../../lib/supabase';
import BackToList from '../../components/BackToList';
import CompareBuilder from '../../components/CompareBuilder';
import { BUILDER_FIELDS, MAX_COMPARE, compareBlockReason } from '../../lib/compareRule';
import { UUID } from '../../lib/postLinks';
import { selectGames } from '../../lib/visibleGames';

export const metadata: Metadata = { title: '게임 비교 만들기', robots: { index: false } };

type Pick = { id: string; name: string; min_players?: number | null; max_players?: number | null };

// /compare/new?games=id1,id2 — 게임을 칸에 미리 채운 "비교 만들기" 화면 (바로 결과로 가지 않고, 확인 후 비교하기)
// 싱글·멀티 섞인 조합은 비교 규칙(compareBlockReason)에 맞는 게임만 남긴다
export default async function NewComparePage({ searchParams }: { searchParams: Promise<{ games?: string }> }) {
  const { games } = await searchParams;
  const ids = [...new Set((games || '').split(',').filter((id) => UUID.test(id)))].slice(0, MAX_COMPARE);
  const [{ data: popular }, { data: rows }] = await Promise.all([
    selectGames(BUILDER_FIELDS).not('heat_rank', 'is', null).order('heat_rank', { ascending: true }).limit(8),
    ids.length ? selectGames(BUILDER_FIELDS).in('id', ids) : Promise.resolve({ data: [] as Pick[] }),
  ]);
  const initial: Pick[] = [];
  for (const id of ids) {
    const g = ((rows || []) as Pick[]).find((r) => r.id === id);
    if (g && !compareBlockReason(initial, g)) initial.push(g);
  }
  return (
    <main className="page">
      <BackToList />
      <CompareBuilder initial={initial} popular={popular || []} />
    </main>
  );
}
