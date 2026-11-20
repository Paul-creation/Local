import Image from 'next/image';
import BackLink from './BackLink';
import CuratorBody from './CuratorBody';
import CopyLinkButton from './CopyLinkButton';
import OutboundLink from './OutboundLink';
import type { getCuratorProfile } from '../lib/curators';
import { groupByPost, groupByGame } from '../lib/curatorView';
import { getPriceInfo } from '../lib/price';
import { gameName } from '../lib/gameName';
import '../brand-tokens.css';
import './home/mn/mn.css';

type Profile = NonNullable<Awaited<ReturnType<typeof getCuratorProfile>>>;

// 계정 프로필 본문 — 공개 페이지(/c/[handle])와 관리자 비공개 미리보기(/c-preview/[handle])가 같이 쓴다. 공개 여부는 부르는 쪽(getCuratorProfile)이 정한다
export default function CuratorProfileView({ profile }: { profile: Profile }) {
  const { curator, posts, games } = profile;

  // 숨긴 게임은 카드 조회에서 빠진다 → 보이는 게임만 묶는다
  const byId = Object.fromEntries(games.map((g) => [g.id, g]));
  const visible = new Map(games.map((g) => [g.id, gameName(g)]));
  const sections = groupByPost(posts, visible);
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
        {curator.avatar_url && <Image src={curator.avatar_url} alt="" width={112} height={112} className="curator-avatar" />}
        <div className="curator-profile-body">
          <p className="sec-label">인스타그램 큐레이터</p>
          <h1 className="curator-profile-name">{curator.display_name}</h1>
          <p className="curator-profile-handle">@{curator.handle}{curator.bio?.trim() ? <span className="curator-profile-bio"> · {curator.bio.trim()}</span> : null}</p>
          {stats.length > 0 && (
            <dl className="curator-profile-stats">
              {stats.map((s) => (
                <div key={s.label}><dd>{s.n}</dd><dt>{s.label}</dt></div>
              ))}
            </dl>
          )}
        </div>
        {curator.bio?.trim() && <p className="curator-bio-m">{curator.bio.trim()}</p>}
        <div className="curator-profile-actions">
          <OutboundLink href={curator.instagram_url} curator={curator.handle} className="btn btn-outline curator-btn curator-btn-ig">
            인스타그램에서 보기 ↗
          </OutboundLink>
          <CopyLinkButton path={`/c/${encodeURIComponent(curator.handle)}`} />
        </div>
      </header>
      {entries.length === 0 ? <p className="tl-note">아직 연결된 게임이 없어요.</p> : <CuratorBody curator={curator.handle} games={byId} sections={sections} />}
    </main>
  );
}
