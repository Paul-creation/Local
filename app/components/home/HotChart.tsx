// 담당: Paul(메인 배너·디자인)
'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { HotItem, HotTab, RankChange } from '../../lib/hotChart';
import LowestPriceBadge from '../LowestPriceBadge';
import GameImage from '../GameImage';

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

// 최근 7일 동접자 미니 선 그래프 (기록 3일 이상인 게임만 데이터가 옴)
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 64, h = 22;
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const d = points.map((p, i) => `${((i / (points.length - 1)) * w).toFixed(1)},${(h - 2 - ((p - min) / span) * (h - 4)).toFixed(1)}`).join(' ');
  return (
    <span className="hc-spark" title="최근 7일 동접자">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        <polyline points={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <span className="hc-spark-label">7일</span>
    </span>
  );
}

const metaText = (item: HotItem) =>
  [item.players, item.currentPlayers ? `동접 ${formatCount(item.currentPlayers)}` : ''].filter(Boolean).join(' · ');

// 1~3위 큰 카드 — 왼쪽 위 큰 순위 숫자(장식)를 이미지가 일부 가리게 겹침. 아래: 제목·한 줄 소개·"인원 · 동접"·가격
function BigCard({ item }: { item: HotItem }) {
  return (
    <Link href={`/games/${item.id}`} className="hc-card lift" aria-label={`${item.rank}위 ${item.name}`}>
      <span className="hc-rank-big" aria-hidden="true">{item.rank}</span>
      <span className="hc-card-image">
        <GameImage src={item.image} fallbackWidth={920} alt="" />
        <span className="hc-card-badges">
          <Change change={item.change} />
          {item.weeks >= 2 && <span className="hc-weeks">{item.weeks}주째 순위권</span>}
        </span>
      </span>
      <span className="hc-card-body">
        <span className="hc-card-name">{item.name}</span>
        {item.fun && <span className="hc-card-fun">{item.fun}</span>}
        <span className="hc-card-foot">
          <span className="hc-card-meta">{metaText(item)}</span>
          <Sparkline points={item.spark} />
        </span>
        <Price item={item} />
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
        <div className="hc-rows">
          <div className="hc-row hc-row-head" aria-hidden="true">
            <span>순위</span><span /><span>게임</span><span className="hc-row-ccu">동접</span><span className="hc-row-price">가격</span>
          </div>
          {tab.items.slice(3, 10).map((item) => <Row key={item.id} item={item} />)}
        </div>
      )}
    </section>
  );
}
