// 담당: Paul(메인 배너·디자인)
'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { HotItem, HotTab, RankChange } from '../../lib/hotChart';

// 44396 → 4.4만
function formatCount(n: number) {
  if (n >= 1e4) return `${+(n / 1e4).toFixed(1)}만`;
  return n.toLocaleString('ko-KR');
}

function Change({ change }: { change: RankChange }) {
  if (!change) return null;
  if (change.type === 'new') return <span className="hc-change is-new">NEW</span>;
  if (change.type === 'same') return <span className="hc-change is-same" aria-label="순위 유지">━</span>;
  return (
    <span className={`hc-change is-${change.type}`} aria-label={`${change.n}계단 ${change.type === 'up' ? '상승' : '하락'}`}>
      {change.type === 'up' ? '▲' : '▼'}{change.n}
    </span>
  );
}

function Price({ item }: { item: HotItem }) {
  if (!item.price) return null;
  return (
    <span className="hc-price">
      {item.discount > 0 && <span className="hc-discount">-{item.discount}%</span>}
      {item.price}
    </span>
  );
}

// 최근 7일 동접자 미니 선 그래프
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 120, h = 32;
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const d = points.map((p, i) => `${((i / (points.length - 1)) * w).toFixed(1)},${(h - 2 - ((p - min) / span) * (h - 4)).toFixed(1)}`).join(' ');
  return (
    <span className="hc-spark">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        <polyline points={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <span className="hc-spark-label">7일 동접</span>
    </span>
  );
}

// 1~3위 큰 카드 — 넷플릭스 Top 10처럼 왼쪽에 큰 외곽선 순위 숫자
function BigCard({ item }: { item: HotItem }) {
  return (
    <Link href={`/games/${item.id}`} className="hc-card">
      {item.image && <img src={item.image} alt="" className="hc-card-bg" />}
      <span className="hc-card-shade" />
      <span className="hc-rank-big" aria-label={`${item.rank}위`}>{item.rank}</span>
      <div className="hc-card-body">
        <div className="hc-card-top">
          <Change change={item.change} />
          {item.weeks > 0 && <span className="hc-weeks">{item.weeks}주째 순위권</span>}
        </div>
        <h3 className="hc-card-name">{item.name}</h3>
        {item.fun && <p className="hc-card-fun">{item.fun}</p>}
        <div className="hc-card-meta">
          {item.players && <span>{item.players}</span>}
          <Price item={item} />
        </div>
        <Sparkline points={item.spark} />
      </div>
    </Link>
  );
}

// 4~10위 한 줄 — 스팀 차트처럼
function Row({ item }: { item: HotItem }) {
  return (
    <Link href={`/games/${item.id}`} className="hc-row">
      <span className="hc-row-rank">
        {item.rank}
        <Change change={item.change} />
      </span>
      {item.thumb ? <img src={item.thumb} alt="" className="hc-row-thumb" loading="lazy" /> : <span className="hc-row-thumb" />}
      <span className="hc-row-main">
        <span className="hc-row-name">{item.name}</span>
        <span className="hc-row-sub">
          {item.players}
          {/* 좁은 화면에서는 오른쪽 동접 칸 대신 여기에 */}
          {item.currentPlayers ? <span className="hc-row-sub-ccu">{item.players ? ' · ' : ''}동접 {formatCount(item.currentPlayers)}</span> : null}
        </span>
      </span>
      <span className="hc-row-right">
        {item.currentPlayers ? <span className="hc-row-ccu">{formatCount(item.currentPlayers)}<small>명 접속 중</small></span> : null}
        <Price item={item} />
      </span>
    </Link>
  );
}

export default function HotChart({ tabs }: { tabs: HotTab[] }) {
  const [key, setKey] = useState(tabs[0]?.key);
  const tab = tabs.find((t) => t.key === key) || tabs[0];
  if (!tab) return null;

  return (
    <section className="hc">
      <div className="hc-head">
        <h2 className="section-title">🔥 지금 뜨는 게임</h2>
        <div className="hc-tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={t.key === tab.key} className={`hc-tab${t.key === tab.key ? ' is-active' : ''}`} onClick={() => setKey(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab.key === 'rising' && <p className="hc-note">7일 전보다 순위가 많이 오른 순서예요</p>}
      <div className="hc-cards" role="tabpanel">
        {tab.items.slice(0, 3).map((item) => <BigCard key={item.id} item={item} />)}
      </div>
      {tab.items.length > 3 && (
        <div className="hc-rows">
          {tab.items.slice(3, 10).map((item) => <Row key={item.id} item={item} />)}
        </div>
      )}
    </section>
  );
}
