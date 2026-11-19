import dynamic from 'next/dynamic';
import { TOUR_ENABLED } from '../../lib/tour';

// 투어 스위치(lib/tour TOUR_ENABLED) — 꺼져 있으면 아무것도 그리지 않는다. 켜져 있을 때만 TourRoot를 불러온다
const TourRoot = TOUR_ENABLED ? dynamic(() => import('./TourRoot')) : null;

export default function TourGate() {
  return TourRoot ? <TourRoot /> : null;
}
