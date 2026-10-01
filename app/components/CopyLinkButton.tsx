'use client';

import { useState } from 'react';

// 지금 페이지 주소를 복사하는 버튼 (친구한테 카톡으로 보내기용)
export default function CopyLinkButton({ label = '🔗 링크 복사' }: { label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <button
      onClick={copy}
      style={{
        background: copied ? '#4a9e3a' : 'var(--bg-card)',
        color: copied ? '#fff' : 'var(--text)',
        border: '1px solid var(--border-light)',
        borderRadius: 100, padding: '8px 16px',
        fontSize: 14, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
      }}
    >
      {copied ? '✓ 복사됨' : label}
    </button>
  );
}
