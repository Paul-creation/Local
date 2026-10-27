'use client';

import { useRouter } from 'next/navigation';
import { TOUR_KEY, serializeState } from '../../lib/tour';

// 사용 가이드 맨 위 "튜토리얼 다시 보기" — 저장된 상태를 처음으로 되돌리고 홈으로 가면 TourRoot가 이어서 시작한다
export default function TourRestartButton() {
  const router = useRouter();
  const restart = () => {
    try { window.localStorage.setItem(TOUR_KEY, serializeState({ status: 'running', step: 0 })); } catch { return; }
    router.push('/');
  };
  return <button type="button" className="btn btn-outline tour-restart" onClick={restart}>튜토리얼 다시 보기</button>;
}
