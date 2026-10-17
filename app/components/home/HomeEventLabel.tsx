// 메인 헤드라인 위 작은 이벤트 라벨 — 서버 컴포넌트 (한국 시간 기준 날짜로 고름, lib/event). "10월의 테마 제목 →" 한 줄, 링크는 새로 불러와 필터 상태를 주소에서 읽게 a
import { getCurrentEvent, eventHref } from '../../lib/event';

export default function HomeEventLabel() {
  const event = getCurrentEvent(new Date());
  return (
    <p className="hero-label">
      <b>{event.label}</b>
      <a href={eventHref(event)}>{event.title} →</a>
    </p>
  );
}
