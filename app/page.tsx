import HomePage from './components/home/HomePage';
import type { Metadata } from 'next';
import { BASE_OG, SITE_TITLE, SITE_META_DESCRIPTION } from './lib/site';

// 하루에 한 번 새로 만든 결과를 모두에게 보여준다 (ISR 쓰기 횟수 절약). 인기 글·가격은 최대 하루 늦게 반영 — 신작 추가·출시와 신고 숨김은 /api/
export const revalidate = 86400;
export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { ...BASE_OG, title: SITE_TITLE, description: SITE_META_DESCRIPTION, url: '/' },
};

export default function Home() {
  return <HomePage />;
}
