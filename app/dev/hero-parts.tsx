// 메인 상단 시안용 공용 조각 (임시) — 서버 컴포넌트, 동작 없는 정적 목업. 이벤트 문구는 실제 getCurrentEvent 값
import './hero.css';
import { getCurrentEvent, eventHref } from '../lib/event';

export const HEADLINE = '금요일 밤, 친구들이랑 뭐 하지?';

export function getHeroEvent() {
  const e = getCurrentEvent(new Date());
  return { label: e.label, title: e.title, href: eventHref(e) };
}

export function Seg({ on = 3 }: { on?: number }) {
  return (
    <div className="hx-seg" role="group" aria-label="몇 명이서 할까요?">
      {[2, 3, 4, 5].map((n) => <button key={n} type="button" aria-pressed={n === on}>{n === 5 ? '5인 이상' : `${n}인`}</button>)}
    </div>
  );
}

export function PcChip() {
  return <button type="button" className="chip" aria-pressed="false">내 PC로 돌아가는 게임만</button>;
}

export function Note({ children }: { children: string }) {
  return <p className="hx-note">시안 — {children}</p>;
}
