'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { safeBackPath } from '../lib/backPath';
import { isInSiteNav, pickFallback } from '../lib/backLink';
import { clientNavCount } from '../lib/navCount';

// 하위 페이지 공통 뒤로 링크 — 서버 HTML은 "← {label}"(fallbackHref로 가는 일반 링크, JS 없이도 동작)
// 마운트 뒤에 사이트 안 이동이라고 판정되면 "← 뒤로"로 바꾸고 history.back(), 아니면(검색·북마크·새 탭) fallbackHref로 이동
// preferList: 목록 주소(sessionStorage list_url)가 있으면 fallback으로 우선 쓴다 (게임 상세·비교)
export default function BackLink({ fallbackHref, label, preferList = false }: { fallbackHref: string; label: string; preferList?: boolean }) {
  const [state, setState] = useState({ href: fallbackHref, inSite: false });
  useEffect(() => {
    let saved: string | null = null;
    try { saved = safeBackPath(sessionStorage.getItem('list_url')); } catch {}
    const inSite = isInSiteNav({ clientNavs: clientNavCount(), referrer: document.referrer, origin: window.location.origin, historyLength: window.history.length });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저에서만 알 수 있는 값(history·referrer·sessionStorage)을 마운트 뒤 한 번 읽는 것
    setState({ href: pickFallback(fallbackHref, saved, preferList), inSite });
  }, [fallbackHref, preferList]);

  return (
    <Link
      href={state.href}
      className="back-link"
      onClick={state.inSite ? (e) => { e.preventDefault(); window.history.back(); } : undefined}
    >
      ← {state.inSite ? '뒤로' : label}
    </Link>
  );
}
