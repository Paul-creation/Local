'use client';

import { useLayoutEffect, useState } from 'react';
import Link from 'next/link';
import { GUIDE_STRIP } from '../../lib/guideCopy';
import { GUIDE_SEEN_KEY, GUIDE_RESERVE_STYLE_ID, markGuideSeen } from '../../lib/guideStrip';

// 메인 이벤트 배너 아래 "처음이세요? 1분 가이드 →" 한 줄 띠. 서버 HTML에는 빈 슬롯만 그리고, 마운트 뒤(첫 그림 전)에 닫은 적 없을 때만 채운다.
// 자리는 lib/guideStrip의 스크립트가 미리 잡아 둬서 채워질 때 아래 내용이 밀리지 않는다. 닫은 기록은 localStorage(try/catch)
export default function GuideStrip() {
  const [show, setShow] = useState(false);

  useLayoutEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(GUIDE_SEEN_KEY) === '1'; } catch { /* 못 읽으면 안 닫은 것으로 */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저 저장소(바깥)에서 한 번 읽어 오는 초기화
    setShow(!seen);
    document.getElementById(GUIDE_RESERVE_STYLE_ID)?.remove();
  }, []);

  return (
    <div className="guide-slot">
      {show && (
        <div className="guide-strip">
          <Link href={GUIDE_STRIP.href} className="guide-strip-link">{GUIDE_STRIP.text}</Link>
          <button type="button" className="guide-strip-close" aria-label={GUIDE_STRIP.closeLabel} onClick={() => { markGuideSeen(); setShow(false); }}>×</button>
        </div>
      )}
    </div>
  );
}
