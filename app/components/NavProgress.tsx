'use client';

import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// 페이지 이동 진행 바 — 헤더 바로 아래 2px. 사이트 안 링크를 누르면 시작하고, 새 페이지가 열리면(주소 변경) 끝까지 찬 뒤 사라진다
// 상태는 React가 아니라 DOM 클래스로만 바꾼다 (이동 중 다시 그리지 않음). 애니메이션은 전부 CSS(.nav-progress, 움직임 줄이기 설정이면 표시만)
const GIVE_UP_MS = 15000; // 이동이 끝나지 않아도 이때는 감춘다 (오류·같은 화면 등)

function Bar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const el = useRef<HTMLDivElement>(null);
  const active = useRef(false);
  const timers = useRef<number[]>([]);

  const clear = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };
  const hide = () => {
    clear();
    active.current = false;
    if (el.current) el.current.className = 'nav-progress';
  };
  const finish = () => {
    if (!active.current || !el.current) return;
    clear();
    active.current = false;
    el.current.className = 'nav-progress is-done';
    timers.current.push(window.setTimeout(hide, 500));
  };
  const start = () => {
    if (!el.current) return;
    clear();
    active.current = true;
    el.current.className = 'nav-progress'; // 처음 상태로 되돌린 뒤 다시 시작 (이동 중 또 눌렀을 때)
    void el.current.offsetWidth;
    el.current.className = 'nav-progress is-loading';
    timers.current.push(window.setTimeout(hide, GIVE_UP_MS));
  };

  // 주소가 바뀌면 이동 완료
  useEffect(() => { finish(); }, [pathname, search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return; // 같은 화면·#위치 이동
      start();
    };
    document.addEventListener('click', onClick);
    return () => { document.removeEventListener('click', onClick); clear(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className="nav-progress" aria-hidden="true" />;
}

export default function NavProgress() {
  return <Suspense fallback={null}><Bar /></Suspense>;
}
