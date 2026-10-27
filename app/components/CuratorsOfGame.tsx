import Link from 'next/link';
import OutboundLink from './OutboundLink';

type Item = { id: string; postUrl: string; handle: string; displayName: string };

// 상세 페이지 "이 게임을 소개한 계정" — 텍스트만(이미지·인스타 임베드 없음). 목록은 posted_at 최신순으로 받아 오고, 없으면 섹션 자체를 그리지 않는다
export default function CuratorsOfGame({ items, gameId }: { items: Item[]; gameId: string }) {
  if (!items.length) return null;
  return (
    <section className="curators-card" aria-labelledby="curators-title">
      <h3 id="curators-title" className="detail-card-title">이 게임을 소개한 계정</h3>
      <ul className="curator-list">
        {items.map((c) => (
          <li key={c.id} className="curator-row">
            <div className="curator-who">
              <span className="curator-platform">인스타그램</span>
              <Link href={`/c/${encodeURIComponent(c.handle)}`} className="curator-name">@{c.displayName}</Link>
            </div>
            <OutboundLink href={c.postUrl} curator={c.handle} gameId={gameId} className="btn compare-add curator-post">게시물 보기 ↗</OutboundLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
