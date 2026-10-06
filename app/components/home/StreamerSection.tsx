'use client';

import Link from 'next/link';
import type { StreamerTheme } from '../../lib/streamerTheme';
import GameImage from '../GameImage';
import StreamerBadge from './StreamerBadge';
import { usePeople } from './PeopleContext';

// 메인 "스트리머들이 밤새운 협동 게임" — 선정은 lib/streamerTheme (6개 미만이면 theme이 null → 통째로 숨김)
// 카드를 누르면 일반 게임 카드처럼 상세 페이지 맨 위로, "플레이 영상 보기"는 가장 최근 영상(YouTube)
// 인원 선택(PeopleContext)에 따라 참여 스트리머 수 = N(5인 이상은 5명 이상)인 게임만 보여주고 제목을 바꾼다 — 그런 게임이 4개 미만이면 거르지 않고 원래대로
// 필터한 목록은 4칸 격자에 맞게 4의 배수(4·8·12개)로 자른다. 내 PC 토글은 여기에 적용하지 않는다
const FILTER_MIN = 4;
const FILTER_MAX = 12;
export default function StreamerSection({ theme }: { theme: StreamerTheme | null }) {
  const { n } = usePeople();
  if (!theme?.games.length) return null;
  const matched = theme.pool.filter((g) => (n >= 5 ? g.streamers.length >= 5 : g.streamers.length === n));
  const filtered = matched.length >= FILTER_MIN;
  const games = filtered ? matched.slice(0, Math.floor(Math.min(matched.length, FILTER_MAX) / 4) * 4) : theme.games;
  const title = filtered ? `스트리머 ${n >= 5 ? '5명 이상이' : `${n}명이`} 밤새운 게임` : '스트리머들이 밤새운 협동 게임';
  return (
    <section className="home-block" aria-labelledby="streamer-games-title">
      <div className="home-block-head">
        <div>
          <h2 id="streamer-games-title" className="section-title">{title}</h2>
          <p className="section-sub">스트리머가 직접 플레이한 협동 게임 모음</p>
        </div>
      </div>
      <ul className="sg-grid">
        {games.map((g) => (
          <li key={g.id} className="sg-item">
            <Link href={`/games/${g.id}`} className="sg-card">
              <GameImage src={g.image} steamSize="header_292x136" fallbackWidth={480} alt="" loading="lazy" className="sg-img" />
              <span className="sg-body">
                <span className="sg-name">{g.name}</span>
                <StreamerBadge names={g.streamers} max={2} />
              </span>
            </Link>
            {g.videoId && <a href={`https://www.youtube.com/watch?v=${g.videoId}`} target="_blank" rel="noopener noreferrer" className="sg-video">플레이 영상 보기</a>}
          </li>
        ))}
      </ul>
    </section>
  );
}
