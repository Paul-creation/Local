import HomePage from '../components/home/HomePage';
import type { Metadata } from 'next';
import { SITE_URL } from '../lib/site';

// 로그인한 사용자의 메인 — proxy.ts가 logged_in 쿠키가 있는 / 요청을 이 주소로 다시 써서(rewrite) 처음 HTML부터 히어로가 빠지게 한다. 주소창은 /로 그대로
// 직접 /home-member로 들어오면 proxy.ts가 /로 보낸다. 검색에는 올리지 않고(noindex) 대표 주소는 /, sitemap에도 없음
// revalidate는 app/page.tsx와 같은 값(86400)이어야 한다 — 바꾸면 둘 다. 게임 변경 때 무효화는 /api/admin/revalidate·community/report가 /와 함께 한다
export const revalidate = 86400;
export const metadata: Metadata = {
  alternates: { canonical: `${SITE_URL}/` },
  robots: { index: false, follow: true },
};

export default function HomeMember() {
  return <HomePage member />;
}
