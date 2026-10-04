// 담당: Paul(메인 배너·디자인)
// 메인 상단 이벤트 영역 — 서버 컴포넌트 (한국 시간 기준 날짜로 고름, lib/event)
import { getCurrentEvent, eventHref } from '../../lib/event';

export default function HomeEvent() {
  const event = getCurrentEvent();
  return (
    <section className="home-event">
      <div className="home-event-emoji" aria-hidden="true">{event.emoji}</div>
      <h1 className="home-event-title">{event.title}</h1>
      <p className="home-event-desc">{event.description}</p>
      {/* 새로 불러와야 필터 상태가 주소에서 다시 읽히므로 Link 대신 a */}
      <a href={eventHref(event)} className="home-event-cta">보러 가기 →</a>
    </section>
  );
}
