// 담당: Paul(메인 배너·디자인)
'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { HotItem, HotTab, RankChange } from '../../lib/hotChart';
import LowestPriceBadge from '../LowestPriceBadge';
import GameImage from '../GameImage';
import ReviewRating from '../ReviewRating';
import StreamerBadge from './StreamerBadge';

// 44396 → 4.4만
function formatCount(n: number) {
  if (n >= 1e4) return `${+(n / 1e4).toFixed(1)}만`;
  return n.toLocaleString('ko-KR');
}

// 순위 변동 — 상승 초록 "+N", 유지 "–", 하락 빨강 "-N", 처음 진입 "NEW" (글자만, 기호 없음)
function Change({ change }: { change: RankChange }) {
  if (!change) return null;
  if (change.type === 'new') return <span className="hc-change is-new">NEW</span>;
  if (change.type === 'same') return <span className="hc-change is-same" aria-label="순위 유지">–</span>;
  return (
    <span className={`hc-change is-${change.type}`} aria-label={`${change.n}계단 ${change.type === 'up' ? '상승' : '하락'}`}>
      {change.type === 'up' ? '+' : '-'}{change.n}
    </span>
  );
}

function Price({ item }: { item: HotItem }) {
  if (!item.price) return null;
  return (
    <span className="hc-price">
      {item.discount > 0 && <span className="hc-discount">-{item.discount}%</span>}
      <span className="hc-price-final">{item.price}</span>
      <LowestPriceBadge timing={item.lowest} />
    </span>
  );
}

// 1~3위 큰 카드 — 이미지 좌상단에 작은 순위 배지. 아래: 제목·인원·가격·평점 % 하나 (변동·소개·동접·N주째·스트리머·최저가 배지는 4~10위 줄이나 상세에서)
function BigCard({ item }: { item: HotItem }) {
  return (
    <Link href={`/games/${item.id}`} className="hc-card lift" aria-label={`${item.rank}위 ${item.name}`}>
      <span className="hc-card-image">
        <GameImage src={item.image} fallbackWidth={920} alt="" />
        <span className={`hc-rank-badge is-r${item.rank}`} aria-hidden="true">{item.rank}위</span>
      </span>
      <span className="hc-card-body">
        <span className="hc-card-name">{item.name}</span>
        <span className="hc-card-foot">
          <span className="hc-card-meta">{item.players}</span>
          <ReviewRating summary={item.reviewSummary} percent={item.reviewPercent} total={item.reviewTotal} showText={false} />
        </span>
        {item.price && (
          <span className="hc-price">
            {item.discount > 0 && <span className="hc-discount">-{item.discount}%</span>}
            <span className="hc-price-final">{item.price}</span>
          </span>
        )}
      </span>
    </Link>
  );
}

// 4~10위 한 줄 — 칸 너비 고정으로 줄마다 세로 정렬
function Row({ item }: { item: HotItem }) {
  return (
    <Link href={`/games/${item.id}`} className="hc-row">
      <span className="hc-row-rank">
        <span className="hc-row-rank-n">{item.rank}</span>
        <Change change={item.change} />
      </span>
      {item.thumb ? <GameImage src={item.thumb} steamSize="header_292x136" className="hc-row-thumb" loading="lazy" /> : <span className="hc-row-thumb" />}
      <span className="hc-row-main">
        <span className="hc-row-name">{item.name}</span>
        <span className="hc-row-sub">
          {item.players && <span>{item.players}</span>}
          {item.tags.map((t) => <span key={t} className="hc-tag">{t}</span>)}
          <StreamerBadge names={item.streamers} max={1} />
        </span>
      </span>
      <span className="hc-row-ccu">{item.currentPlayers ? <>{formatCount(item.currentPlayers)}<small>명</small></> : '-'}</span>
      <span className="hc-row-price"><Price item={item} /></span>
    </Link>
  );
}

// 탭: 친구랑 하기 좋은(기본) · 전체
const SHOWN_TABS = ['friends', 'all'];

export default function HotChart({ tabs: allTabs }: { tabs: HotTab[] }) {
  const tabs = allTabs.filter((t) => SHOWN_TABS.includes(t.key));
  const [key, setKey] = useState(tabs[0]?.key);
  const tab = tabs.find((t) => t.key === key) || tabs[0];
  // 4~10위 줄은 접어 두고 "더 보기"로 10위까지 펼친다 (모바일·데스크톱 같음, 접힘은 CSS .is-collapsed)
  const [open, setOpen] = useState(false);
  if (!tab) return null;

  return (
    <section className="hc home-block">
      <div className="hc-head">
        <h2 className="section-title">지금 뜨는 게임</h2>
        <div className="tabs" role="tablist" aria-label="지금 뜨는 게임 보기">
          {tabs.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={t.key === tab.key} className={`tab${t.key === tab.key ? ' is-active' : ''}`} onClick={() => setKey(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="hc-top">
        {/* 1위 게임 이미지를 크게 흐리게 깔아 깊이감 — 1위 카드와 같은 주소·폭이라 새로 받지 않음 */}
        {tab.items[0]?.image && (
          <span className="hc-glow" aria-hidden="true"><GameImage src={tab.items[0].image} fallbackWidth={920} alt="" /></span>
        )}
        <div className="hc-cards" role="tabpanel">
          {tab.items.slice(0, 3).map((item) => <BigCard key={item.id} item={item} />)}
        </div>
      </div>
      {tab.items.length > 3 && (
        <div className={`hc-rows${open ? '' : ' is-collapsed'}`} id="hc-rows">
          <div className="hc-row hc-row-head" aria-hidden="true">
            <span>순위</span><span /><span>게임</span><span className="hc-row-ccu">동접</span><span className="hc-row-price">가격</span>
          </div>
          {tab.items.slice(3, 10).map((item) => <Row key={item.id} item={item} />)}
        </div>
      )}
      {tab.items.length > 3 && (
        <button type="button" className="btn btn-outline hc-more" aria-expanded={open} aria-controls="hc-rows" onClick={() => setOpen((v) => !v)}>
          {open ? '접기' : '더 보기'}
        </button>
      )}
    </section>
  );
}
