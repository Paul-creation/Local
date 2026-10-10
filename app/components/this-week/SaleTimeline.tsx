'use client';

// 이번 주 할인 마감 세로 타임라인 — 날짜 마디(오늘/내일/요일) 아래에 그날 끝나는 게임을 작은 카드로
// "오늘/내일"과 이미 끝난 할인은 브라우저 시각 기준으로 다시 계산한다 (페이지는 5분 캐시라 서버가 정한 목록에 지난 것이 남을 수 있음)
// 끝난 카드는 숨기고, 비게 된 날짜 마디도 숨긴다. 전부 비면 빈 상태 문구
import { useEffect, useState } from 'react';
import Link from 'next/link';
import GameImage from '../GameImage';
import { groupByDay, endTimeText } from '../../lib/saleTimeline';
import type { TimelineGame } from '../../lib/saleTimelineData';

const FOLD = 6; // 날짜 마디마다 처음 6장만, 나머지는 "N개 더 보기" (오늘 마디는 처음부터 전부)
const won = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`;

export default function SaleTimeline({ items, serverNow }: { items: TimelineGame[]; serverNow: number }) {
  // 첫 화면은 서버가 계산한 시각 그대로(화면 준비 때 어긋나지 않게), 뜬 뒤 브라우저 시각으로 갱신하고 1분마다 다시 확인
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 60_000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, []);
  const [opened, setOpened] = useState<number[]>([]);
  const groups = groupByDay(items, now);

  if (groups.length === 0) {
    return <p className="tl-empty">이번 주에 끝나는 할인 정보가 아직 없어요.</p>;
  }
  return (
    <ol className="tl">
      {groups.map((g) => {
        const open = g.today || opened.includes(g.dayKey);
        const shown = open ? g.items : g.items.slice(0, FOLD);
        const hidden = g.items.length - shown.length;
        return (
        <li key={g.dayKey} className={`tl-day${g.today ? ' is-today' : ''}`}>
          <h2 className="tl-heading">{g.heading}</h2>
          <ul className="tl-cards">
            {shown.map((game) => {
              const soon = new Date(game.endsAt).getTime() - now <= 24 * 3600_000;
              return (
                <li key={game.id}>
                  <Link href={`/games/${game.id}`} className="tl-card lift">
                    <span className="tl-thumb">
                      <GameImage src={game.image} alt="" loading="lazy" steamSize="header_292x136" fallbackWidth={320} />
                    </span>
                    <span className="tl-body">
                      <span className="tl-name">{game.name}</span>
                      <span className="tl-meta">
                        {game.players && <span className="result-players">{game.players}</span>}
                        <span className={`sale-ends${soon ? ' is-soon' : ''}`}>{endTimeText(game.endsAt)}</span>
                      </span>
                      <span className="tl-price">
                        <span className="discount-badge">-{game.discount}%</span>
                        {game.original != null && <span className="price-original">{won(game.original)}</span>}
                        <span className="price-final">{won(game.final)}</span>
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {hidden > 0 && (
            <button type="button" className="btn btn-outline tl-more" onClick={() => setOpened((v) => [...v, g.dayKey])}>
              {hidden}개 더 보기
            </button>
          )}
        </li>
        );
      })}
    </ol>
  );
}
