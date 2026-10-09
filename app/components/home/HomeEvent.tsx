// 담당: Paul(메인 배너·디자인)
// 메인 상단 이벤트 배너 — 서버 컴포넌트 (한국 시간 기준 날짜로 고름, lib/event)
// 900px 미만에서는 제목 + → 한 줄 띠로 줄고 띠 전체가 링크 (globals.css)
// 이벤트 색의 아주 어두운 배경 카드 + 작은 라벨 + 제목 + 설명 + "보러 가기 →" (색은 globals.css .home-event[data-tone])
import { getCurrentEvent, eventHref } from '../../lib/event';

// previewMonth: 관리자 미리보기(/api/theme-preview?month=N)용 — 그 달의 기본 이벤트를 보여준다
export default function HomeEvent({ previewMonth }: { previewMonth?: number }) {
  const event = getCurrentEvent(new Date(), previewMonth);
  return (
    <section className="home-event" data-tone={event.tone} aria-labelledby="home-event-title">
      <div className="home-event-text">
        <p className="home-event-label">{event.label}</p>
        <h2 id="home-event-title" className="home-event-title">{event.title}</h2>
        <p className="home-event-desc">{event.description}</p>
      </div>
      {/* 새로 불러와야 필터 상태가 주소에서 다시 읽히므로 Link 대신 a */}
      <a href={eventHref(event)} className="home-event-cta"><span className="home-event-cta-text">보러 가기</span>→</a>
    </section>
  );
}
