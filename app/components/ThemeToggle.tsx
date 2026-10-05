'use client';

import { useEffect, useState } from 'react';
import { THEME_KEY, type Theme } from '../lib/theme';

// 헤더의 라이트/다크 바꾸기 버튼 — 글자로만 표시 (지금 테마가 아니라 바꿀 테마 이름)
export default function ThemeToggle() {
  // 서버 HTML은 다크 기준. 그리기 직후 실제 테마(첫 HTML 스크립트가 정한 값)로 맞춘다
  const [theme, setTheme] = useState<Theme>('dark');
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 바깥(html 속성)에서 한 번 읽어 오는 초기화
    setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    if (next === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem(THEME_KEY, next); } catch {}
    setTheme(next);
  };

  const label = theme === 'dark' ? '라이트' : '다크';
  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={`${label} 모드로 바꾸기`}>
      {label}
    </button>
  );
}
