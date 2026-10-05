'use client';

import { useState } from 'react';
import { SITE_URL } from '../lib/site';

// 공유 버튼 — 폰처럼 공유 창이 되는 곳은 공유 창(카톡 등)을 띄우고, 안 되는 PC는 링크 복사
export default function ShareButton({
  title,
  text,
  label = '공유하기',
  variant = 'pill',
}: {
  title?: string;
  text?: string;
  label?: string;
  variant?: 'pill' | 'text';
}) {
  const [copied, setCopied] = useState(false);

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const share = async () => {
    // 배포별 주소(…-abc123.vercel.app)에서 열어도 공유 링크는 항상 대표 주소로
    const url = SITE_URL + window.location.pathname + window.location.search;
    const data = { title: title || document.title, text, url };
    if (typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare(data))) {
      try {
        await navigator.share(data);
        return;
      } catch (e: any) {
        if (e?.name === 'AbortError') return; // 사용자가 공유 창을 닫음
      }
    }
    await copy(url);
  };

  if (variant === 'text') {
    return (
      <button type="button" onClick={share} className="share-text-btn" data-copied={copied || undefined}>
        {copied ? '링크 복사됨' : label}
      </button>
    );
  }

  return (
    <button type="button" onClick={share} className="btn btn-outline share-btn" data-copied={copied || undefined}>
      {copied ? '링크 복사됨' : label}
    </button>
  );
}
