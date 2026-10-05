// 관리자 전용 이벤트 테마 미리보기: /api/theme-preview?month=11 (기본 11월). 관리자 로그인(/admin) 쿠키가 없으면 404
// 메인은 5분 캐시라 쿠키를 읽을 수 없어서 미리보기만 따로 둔다. 관리자 쿠키는 /api 경로에만 실려서 주소도 /api 아래에 둔다 (쿠키 범위는 그대로)
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ADMIN_COOKIE, isAdminToken } from '../../lib/adminAuth';
import HomeEvent from '../../components/home/HomeEvent';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '테마 미리보기', robots: { index: false, follow: false } };

export default async function ThemePreview({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  if (!isAdminToken((await cookies()).get(ADMIN_COOKIE)?.value || '')) notFound();
  const m = Number((await searchParams).month);
  const month = m >= 1 && m <= 12 ? m : 11;
  return (
    <main className="page">
      <HomeEvent previewMonth={month} />
    </main>
  );
}
