'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function BackToList() {
  const [href, setHref] = useState('/');
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('list_url');
      if (saved && saved.startsWith('/')) setHref(saved);
    } catch {}
  }, []);
  return <Link href={href} className="back-link">← 목록으로</Link>;
}
