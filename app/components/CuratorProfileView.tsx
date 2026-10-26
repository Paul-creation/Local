import Image from 'next/image';
import BackLink from './BackLink';
import CuratorBody from './CuratorBody';
import CopyLinkButton from './CopyLinkButton';
import type { getCuratorProfile } from '../lib/curators';
import { groupByPost, groupByGame, dateLabel } from '../lib/curatorView';
import { getPriceInfo } from '../lib/price';
import { gameName } from '../lib/gameName';

type Profile = NonNullable<Awaited<ReturnType<typeof getCuratorProfile>>>;

// 계정 프로필 본문 — 공개 페이지(/c/[handle])와 관리자 비공개 미리보기(/c-preview/[handle])가 같이 쓴다. 공개 여부는 부르는 쪽(getCuratorProfile)이 정한다
export default function CuratorProfileView({ profile }: { profile: Profile }) {
  const { curator, posts, games } = profile;

  // 숨긴 게임은 카드 조회에서 빠진다 → 보이는 게임만 묶는다
  const byId = Object.fromEntries(games.map((g) => [g.id, g]));
  const visible = new Map(games.map((g) => [g.id, gameName(g)]));
  const sections = groupByPost(posts, visible).map((s) => ({ ...s, dateText: dateLabel(s.postedAt) }));
  const entries = groupByGame(posts, visible);
  const saleCount = games.filter((g) => (getPriceInfo(g)?.discount ?? 0) > 0).length;
  const stats = [
    { label: '소개한 게임', n: entries.length },
    { label: '게시물', n: sections.length },
    { label: '지금 할인 중', n: saleCount },
  ].filter((s) => s.n > 0);

  return (
    <main className="page mn mn-inner">
      <BackLink fallbackHref="/" label="홈으로" />
      <header className="curator-profile">
        {curator.avatar_url && <Image src={curator.avatar_url} alt="" width={128} height={128} className="curator-avatar" />}
        <div className="curator-profile-body">
          <h1 className="curator-profile-name">{curator.display_name}</h1>
          <p className="curator-profile-handle">@{curator.handle}</p>
          {curator.bio?.trim() && <p className="curator-profile-bio">{curator.bio.trim()}</p>}
          {stats.length > 0 && (
            <p className="curator-profile-stats">
              {stats.map((s, i) => (
                <span key={s.label}>{i > 0 && ' · '}{s.label} <b>{s.n}</b></span>
              ))}
            </p>
          )}
          <div className="curator-profile-actions">
            <a href={curator.instagram_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary curator-btn curator-btn-ig">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" /></svg>
              인스타그램에서 보기 ↗
            </a>
            <CopyLinkButton path={`/c/${encodeURIComponent(curator.handle)}`} />
          </div>
        </div>
      </header>
      <p className="curator-note">가격·할인·스팀 평가는 매일 갱신돼요.</p>
      {entries.length === 0 ? <p className="tl-note">아직 연결된 게임이 없어요.</p> : <CuratorBody games={byId} sections={sections} entries={entries} />}
    </main>
  );
}
