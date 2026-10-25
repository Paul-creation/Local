// 메인 "인스타에서 봤던 그 게임" — 큐레이터별 카드. 그 계정이 소개한 게임 표지 5장을 부채꼴(-10~10도)로 겹치고, 아래에 @이름 / 게임 N개 · 게시물 N / 최근 게임 3개
// 데이터는 서버(page.tsx → getHomeCurators)가 고름: 동의 계정 2개 미만이면 null이라 섹션 자체를 그리지 않는다. 카드를 누르면 /c/[handle]
import Link from 'next/link';
import PosterImage from './PosterImage';
import type { HomeCurators } from '../../../lib/curators';

// 장수별 회전 각도 — 항상 -10~10도 사이에서 고르게
const angles = (n: number) => (n === 1 ? [0] : Array.from({ length: n }, (_, i) => -10 + (20 * i) / (n - 1)));

export default function Curators({ data }: { data: HomeCurators | null }) {
  if (!data) return null;
  return (
    <section className="mn-sec" aria-labelledby="mn-curators-title">
      <div className="mn-sec-head"><h2 id="mn-curators-title">인스타에서 봤던 그 게임</h2></div>
      <ul className="mn-curators">
        {data.cards.map((c) => {
          const rot = angles(c.covers.length);
          return (
            <li key={c.handle}>
              <Link href={`/c/${encodeURIComponent(c.handle)}`} className="mn-curator">
                <span className="mn-fan" aria-hidden="true">
                  {c.covers.map((cover, i) => (
                    <span key={i} className="mn-fan-cover" style={{ '--r': `${rot[i]}deg`, '--i': i, '--n': c.covers.length } as React.CSSProperties}><PosterImage cover={cover} /></span>
                  ))}
                </span>
                <span className="mn-curator-name">@{c.displayName}</span>
                <span className="mn-curator-count">게임 {c.gameCount}개 · 게시물 {c.postCount}</span>
                <span className="mn-curator-recent">{c.recent.join(' · ')}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
