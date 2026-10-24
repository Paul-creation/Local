import type { Metadata } from 'next';

export const metadata: Metadata = { title: '게시물 연결 · 관리자', robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
