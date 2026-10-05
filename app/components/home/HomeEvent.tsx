// 담당: Paul(메인 배너·디자인)
// 메인 상단 이벤트 배너 — 서버 컴포넌트 (한국 시간 기준 날짜로 고름, lib/event)
// 이벤트 색의 아주 어두운 배경 카드 + 작은 라벨 + 제목 + 설명 + "보러 가기 →" (색은 globals.css .home-event[data-tone])
// 스트리머 기획전(kind: 'streamer')은 "보러 가기" 대신 아래에 게임 카드 한 줄 (lib/streamerTheme). 게임이 6개 미만이면 fallback 이벤트
import Link from 'next/link';
import { getCurrentEvent, eventHref } from '../../lib/event';
import { getStreamerTheme, THEME_MIN, type StreamerTheme } from '../../lib/streamerTheme';
import GameImage from '../GameImage';
import StreamerBadge from './StreamerBadge';

export default async function HomeEvent({ previewMonth }: { previewMonth?: number }) {
  let event = getCurrentEvent(new Date(), previewMonth);
  let theme: StreamerTheme | null = null;
  if (event.kind === 'streamer') {
    theme = await getStreamerTheme().catch(() => null);
    if (theme && theme.games.length >= THEME_MIN) event = { ...event, description: '스트리머가 직접 플레이한 협동 게임 모음' };
    else if (event.fallback) { event = { ...event.fallback, label: event.label }; theme = null; }
  }
  return (
    <>
      <section className={`home-event${theme ? ' has-cards' : ''}`} data-tone={event.tone} aria-labelledby="home-event-title">
        <div className="home-event-text">
          <p className="home-event-label">{event.label}</p>
          <h2 id="home-event-title" className="home-event-title">{event.title}</h2>
          <p className="home-event-desc">{event.description}</p>
        </div>
        {/* 새로 불러와야 필터 상태가 주소에서 다시 읽히므로 Link 대신 a */}
        {!theme && <a href={eventHref(event)} className="home-event-cta">보러 가기 →</a>}
      </section>
      {theme && (
        <ul className="sg-row event-cards" aria-label={event.title}>
          {theme.games.map((g) => (
            <li key={g.id} className="sg-item">
              <Link href={`/games/${g.id}#streamer-videos`} className="sg-card">
                <GameImage src={g.image} steamSize="header_292x136" fallbackWidth={480} alt="" loading="lazy" className="sg-img" />
                <span className="sg-name">{g.name}</span>
              </Link>
              <StreamerBadge names={g.streamers} max={2} suffix=" 플레이" />
              {g.videoId && <a href={`https://www.youtube.com/watch?v=${g.videoId}`} target="_blank" rel="noopener noreferrer" className="sg-video">플레이 영상 보기</a>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
