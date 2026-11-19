'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import AuthMenu from '../AuthMenu';
import CompareCount from '../CompareCount';
import Wordmark from '../brand/Wordmark';
import { MENU, isCurrent } from './menuItems';

// 모바일(767px 이하) 헤더의 햄버거 버튼 + 오른쪽에서 슬라이드되는 전체 높이 드로어 (768px 이상에서는 CSS로 둘 다 숨김)
// 드로어는 body로 포털 — 헤더의 쌓임 맥락(z 50)에 갇히면 비교 트레이(z 800) 아래로 깔린다
// 닫힘: 바깥(어두운 막) 누르기·Esc·링크 누르기·× 버튼. 열린 동안 body 스크롤 잠금, Tab은 드로어 안에서만 돈다(focus trap), 닫으면 햄버거 버튼으로 포커스 복귀
// 닫혀 있을 때는 inert라 탭·스크린리더에서 빠진다
const FOCUSABLE = 'a[href],button:not([disabled])';
const noop = () => () => {};

export default function MobileNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const drawer = drawerRef.current;
    const btn = btnRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawer?.querySelector<HTMLElement>('.mnav-close')?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return; }
      if (e.key !== 'Tab' || !drawer) return;
      const items = Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      const active = document.activeElement;
      if (!drawer.contains(active)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    // 화면이 데스크톱 폭으로 넓어지면(가로 회전 등) 드로어가 안 보이니 잠금도 풀기
    const mq = window.matchMedia('(min-width: 768px)');
    const onMq = () => { if (mq.matches) setOpen(false); };
    document.addEventListener('keydown', onKey);
    mq.addEventListener('change', onMq);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      mq.removeEventListener('change', onMq);
      btn?.focus();
    };
  }, [open]);

  return (
    <>
      <button ref={btnRef} type="button" className="mnav-btn" aria-label="메뉴 열기" aria-haspopup="dialog" aria-expanded={open} aria-controls="mnav-drawer" onClick={() => setOpen(true)}>
        <span className="mnav-bar" /><span className="mnav-bar" /><span className="mnav-bar" />
      </button>
      {mounted && createPortal(
        <div className={`mnav${open ? ' is-open' : ''}`} inert={!open}>
          <div className="mnav-scrim" onClick={close} aria-hidden="true" />
          <div ref={drawerRef} id="mnav-drawer" className="mnav-drawer" role="dialog" aria-modal="true" aria-label="메뉴">
            <div className="mnav-top">
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- 메인 필터 상태를 주소에서 새로 읽게 a */}
              <a href="/" className="mnav-logo" aria-label="Select Screen 홈"><Wordmark /></a>
              <button type="button" className="mnav-close" aria-label="메뉴 닫기" onClick={close}>✕</button>
            </div>
            <nav className="mnav-list" aria-label="주요 메뉴">
              {MENU.map((m) => (
                <a key={m.href} href={m.href} className="mnav-link" aria-current={isCurrent(m.href, path) ? 'page' : undefined} onClick={close}>
                  <span>{m.label}{m.href === '/compare' && <CompareCount />}</span>
                  <span className="mnav-chev" aria-hidden="true">›</span>
                </a>
              ))}
            </nav>
            <div className="mnav-auth"><AuthMenu variant="drawer" /></div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
