'use client';

import { useEffect, useRef, useState } from 'react';
import { SITE_URL } from '../lib/site';

// 쿼리(보기·필터·정렬) 없이 정식 주소(SITE_URL + 경로)만 복사하고 1.6초 동안 "복사했어요"
export default function CopyLinkButton({ path }: { path: string }) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copy() {
    const url = `${SITE_URL}${path}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } finally { document.body.removeChild(ta); }
    }
    setDone(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDone(false), 1600);
  }

  return (
    <button type="button" className="btn btn-outline curator-btn" onClick={copy} aria-live="polite">
      {done ? '복사했어요' : '링크 복사'}
    </button>
  );
}
