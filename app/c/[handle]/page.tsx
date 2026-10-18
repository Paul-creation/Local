import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import BackLink from '../../components/BackLink';
import CuratorGames from '../../components/CuratorGames';
import { getCurator, getCuratorPosts } from '../../lib/curators';
import { withSubjectJosa } from '../../lib/josa';
import { getCardGames } from '../../lib/gameIndex';
import { BASE_OG } from '../../lib/site';

export const revalidate = 300;

const titleOf = (displayName: string) => `@${withSubjectJosa(displayName)} 소개한 게임`;

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const curator = await getCurator(decodeURIComponent(handle));
  if (!curator) notFound();
  const title = titleOf(curator.display_name);
  const description = `@${withSubjectJosa(curator.display_name)} 인스타그램에서 소개한 게임의 현재 가격·할인·인원을 한눈에 볼 수 있어요.`;
  const url = `/c/${encodeURIComponent(curator.handle)}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { ...BASE_OG, title, description, url },
    twitter: { card: 'summary', title, description },
  };
}

export default async function CuratorPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const curator = await getCurator(decodeURIComponent(handle));
  if (!curator) notFound();

  // 게임별로 묶고(한 게임에 게시물이 여러 개면 링크만 여러 줄), 순서는 게임의 가장 최신 posted_at 기준. 숨긴 게임은 카드 조회에서 빠진다
  const posts = await getCuratorPosts(curator.id);
  const byGame = new Map<string, { id: string; url: string; collection: boolean }[]>();
  for (const p of posts) byGame.set(p.game_id, [...(byGame.get(p.game_id) || []), { id: p.id, url: p.post_url, collection: p.post_type === 'collection' }]);
  const games = await getCardGames([...byGame.keys()]).catch(() => []);
  const entries = games.map((game) => ({ game, posts: byGame.get(game.id) || [] }));

  return (
    <main className="page">
      <BackLink fallbackHref="/" label="홈으로" />
      <h1 className="section-title">{titleOf(curator.display_name)}</h1>
      <p className="tl-note">
        <a href={curator.instagram_url} target="_blank" rel="noopener noreferrer" className="curator-link">인스타그램 계정 보기 ↗</a>
      </p>
      {entries.length === 0 ? <p className="tl-note">아직 연결된 게임이 없어요.</p> : <CuratorGames entries={entries} />}
    </main>
  );
}
