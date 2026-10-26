import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CuratorProfileView from '../../components/CuratorProfileView';
import { getCuratorProfile } from '../../lib/curators';
import { withSubjectJosa } from '../../lib/josa';
import { BASE_OG } from '../../lib/site';
import '../../mono-tokens.css';
import '../../mono-page.css';
import './curator-mono.css';

// 동의(consent_status=granted)한 계정만 보인다 — 아니면 getCuratorProfile이 null이라 404. 미리보기는 /c-preview/[handle] (proxy.ts가 관리자의 ?preview=1을 넘겨줌)
export const revalidate = 300;

const titleOf = (displayName: string) => `@${withSubjectJosa(displayName)} 소개한 게임`;

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const profile = await getCuratorProfile(decodeURIComponent(handle));
  if (!profile) notFound();
  const { curator, games } = profile;
  const title = titleOf(curator.display_name);
  const intro = `@${withSubjectJosa(curator.display_name)} 인스타그램에서 소개한 게임${games.length ? ` ${games.length}개` : ''}의 현재 가격·할인·인원을 한눈에 볼 수 있어요.`;
  const bio = (curator.bio || '').replace(/\s+/g, ' ').trim();
  const description = bio ? `${bio} ${intro}` : intro;
  const url = `/c/${encodeURIComponent(curator.handle)}`;
  const image = `/api/og/curator/${encodeURIComponent(curator.handle)}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { ...BASE_OG, title, description, url, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

export default async function CuratorPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const profile = await getCuratorProfile(decodeURIComponent(handle));
  if (!profile) notFound();
  return <CuratorProfileView profile={profile} />;
}
