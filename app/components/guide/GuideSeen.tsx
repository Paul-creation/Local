'use client';

import { useEffect } from 'react';
import { markGuideSeen } from '../../lib/guideStrip';

// /guide를 열면 메인의 첫 방문 안내 띠를 다시 보이지 않게 기록 (화면에는 아무것도 그리지 않음)
export default function GuideSeen() {
  useEffect(() => { markGuideSeen(); }, []);
  return null;
}
