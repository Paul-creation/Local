import HomePage from '../components/home/HomePage';
import type { Metadata } from 'next';

// 로그인한 사용자의 메인 — proxy.ts가 logged_in 쿠키가 있는 / 요청을 이 주소로 다시 써서(rewrite) 처음 HTML부터 히어로가 빠지게 한다. 주소창은 /로 그대로
// 직접 /home-member로 들어와도 검색에는 올리지 않고 대표 주소는 /
export const revalidate = 86400;
export const metadata: Metadata = {
  alternates: { canonical: '/' },
  robots: { index: false, follow: true },
};

export default function HomeMember() {
  return <HomePage member />;
}
