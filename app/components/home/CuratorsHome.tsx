// 메인 "인스타에서 봤던 그 게임" — 서버 컴포넌트. 계정 카드 가로 나열(모바일은 가로 스크롤), 카드 전체가 /c/handle 링크
// 계정이 HOME_CURATORS_MIN개 미만이면 getHomeCurators가 빈 배열을 줘서 섹션 자체를 그리지 않는다
import Link from 'next/link';
import type { HomeCurator } from '../../lib/curators';

export default function CuratorsHome({ curators }: { curators: HomeCurator[] }) {
  if (!curators.length) return null;
  return (
    <section className="home-block curators-home" aria-labelledby="curators-home-title">
      <div className="home-block-head curators-home-head">
        <h2 id="curators-home-title" className="section-title">인스타에서 봤던 그 게임</h2>
        <p className="curators-home-sub">저장만 해두고 잊어버린 게임, 소개한 계정별로 모아뒀어요</p>
      </div>
      <ul className="curators-home-row">
        {curators.map((c) => (
          <li key={c.handle} className="curators-home-item">
            <Link href={`/c/${encodeURIComponent(c.handle)}`} className="curators-home-card">
              <span className="curators-home-top">
                {c.avatarUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img className="curators-home-avatar" src={c.avatarUrl} alt="" width={44} height={44} loading="lazy" />}
                <span className="curators-home-who">
                  <span className="curators-home-name">@{c.displayName}</span>
                  <span className="curators-home-count">게임 {c.gameCount}개</span>
                </span>
              </span>
              <span className="curators-home-games">{c.recentNames.join(' · ')}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
