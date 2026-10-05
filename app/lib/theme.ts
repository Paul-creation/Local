// 라이트/다크 테마 — 다크가 기본, 사용자가 고른 값만 localStorage에 남긴다
// 첫 HTML이 그려지기 전에 THEME_SCRIPT가 html[data-theme]를 정해서 깜빡임이 없게 함 (app/layout.tsx)
export const THEME_KEY = 'theme';
export type Theme = 'dark' | 'light';

export const THEME_SCRIPT = `(function(){try{if(localStorage.getItem('${THEME_KEY}')==='light')document.documentElement.setAttribute('data-theme','light')}catch(e){}})();`;
