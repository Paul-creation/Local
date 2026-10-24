'use client';

import { useEffect, useRef, useState } from 'react';

// 현재 주소(보기·필터 없이 계정 주소만)를 복사하고 1.6초 동안 "복사했어요"
export default function CopyLinkButton({ path }: { path: string }) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copy() {
    const url = `${window.location.origin}${path}`;
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
