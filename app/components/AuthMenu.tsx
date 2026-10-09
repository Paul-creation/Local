'use client';

import { useEffect, useRef, useState } from 'react';

// 헤더 오른쪽 로그인 영역 — 로그인 상태는 페이지 캐시(revalidate)를 깨지 않도록 클라이언트에서 /api/me로 가져온다.
// 헤더 링크가 전부 a(전체 새로고침)라 매 페이지마다 부르지 않게 결과를 sessionStorage에 잠깐(5분) 기억한다.
type Me = { id: string; persona_name: string | null; avatar_url: string | null };
type State = Me | null | undefined; // undefined: 아직 모름
const CACHE_KEY = 'auth_me';
const CACHE_MS = 5 * 60 * 1000;
const NOTICE: Record<string, string> = {
  failed: '스팀 로그인에 실패했어요. 다시 시도해주세요.',
  unavailable: '지금은 로그인을 쓸 수 없어요.',
};

const readCache = (): State => {
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
    return c && Date.now() - c.at < CACHE_MS ? (c.me as Me | null) : undefined;
  } catch { return undefined; }
};
const writeCache = (me: Me | null) => { try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), me })); } catch {} };
const clearCache = () => { try { sessionStorage.removeItem(CACHE_KEY); } catch {} };

export default function AuthMenu() {
  const [me, setMe] = useState<State>(undefined);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 로그인 실패로 돌아온 경우(?login=failed) 안내를 잠깐 보이고 주소에서 지운다
    const url = new URL(window.location.href);
    const flag = url.searchParams.get('login');
    if (flag && NOTICE[flag]) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 주소(바깥)에서 한 번 읽어 오는 초기화
      setNotice(NOTICE[flag]);
      url.searchParams.delete('login');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      clearCache();
      const t = setTimeout(() => setNotice(''), 6000);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    const cached = readCache();
    if (cached !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 바깥(sessionStorage)에서 한 번 읽어 오는 초기화
      setMe(cached);
      return;
    }
    let alive = true;
    fetch('/api/me', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (r) => (r.ok ? ((await r.json()) as Me) : null))
      .catch(() => null)
      .then((m) => { if (alive) { setMe(m); writeCache(m); } });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const logout = async () => {
    setOpen(false);
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch {}
    clearCache();
    setMe(null);
  };

  const noticeEl = notice ? <div className="auth-notice" role="status">{notice}</div> : null;

  if (me) {
    const name = me.persona_name || '스팀 사용자';
    return (
      <div className="auth-menu" ref={box}>
        <button type="button" className="auth-user" aria-haspopup="menu" aria-expanded={open} aria-label={`${name} 메뉴`} onClick={() => setOpen((v) => !v)}>
          {me.avatar_url && /* eslint-disable-next-line @next/next/no-img-element -- 스팀 이미지 서버 주소, 24px 아바타 */
            <img src={me.avatar_url} alt="" width={24} height={24} className="auth-avatar" referrerPolicy="no-referrer" />}
          <span className="auth-name">{name}</span>
        </button>
        {open && (
          <div className="auth-pop" role="menu">
            <button type="button" role="menuitem" className="auth-pop-item" onClick={logout}>로그아웃</button>
          </div>
        )}
        {noticeEl}
      </div>
    );
  }

  return (
    <div className="auth-menu">
      {/* 아직 모를 때도 같은 자리를 차지하게 숨겨서 그려 둔다 (로그인한 사람에게 버튼이 번쩍이지 않게) */}
      <a
        href="/api/auth/steam/login"
        className="auth-login"
        style={me === undefined ? { visibility: 'hidden' } : undefined}
        tabIndex={me === undefined ? -1 : undefined}
        onClick={(e) => {
          clearCache();
          e.currentTarget.href = `/api/auth/steam/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        }}
      >
        <span className="auth-login-long">Steam으로 </span>로그인
      </a>
      {noticeEl}
    </div>
  );
}
