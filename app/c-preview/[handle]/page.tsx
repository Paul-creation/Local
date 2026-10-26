import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import CuratorProfileView from '../../components/CuratorProfileView';
import { getCuratorProfile } from '../../lib/curators';
import { ADMIN_COOKIE, isAdminToken } from '../../lib/adminAuth';
import '../../mono-tokens.css';
import '../../mono-page.css';
import '../../c/[handle]/curator-mono.css';

// 동의 전 계정의 비공개 미리보기 — 동의 요청에 붙일 스크린샷용. 사용자는 /c/[handle]?preview=1로 들어오고 proxy.ts가 여기로 보낸다
// 관리자 쿠키가 없으면 404 (주소를 직접 열어도 마찬가지). 검색 제외·사이트맵에 없음. 화면에는 미리보기 표시를 넣지 않는다(스크린샷에 그대로 찍힘)
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: '미리보기', robots: { index: false, follow: false, nocache: true } };

export default async function CuratorPreviewPage({ params }: { params: Promise<{ handle: string }> }) {
  if (!isAdminToken((await cookies()).get(ADMIN_COOKIE)?.value || '')) notFound();
  const { handle } = await params;
  const profile = await getCuratorProfile(decodeURIComponent(handle), true);
  if (!profile) notFound();
  return <CuratorProfileView profile={profile} />;
}
