// 메인 리디자인 아이콘 — inline stroke SVG (색은 currentColor, 장식이라 스크린 리더에서는 숨김)
const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

export const SearchIcon = () => (
  <svg {...base}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const SparkIcon = () => (
  <svg {...base}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></svg>
);
export const PlayIcon = () => (
  <svg {...base} width={22} height={22}><path d="M8 5.5v13l11-6.5z" /></svg>
);
export const ArrowIcon = () => (
  <svg {...base} width={16} height={16}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const LikeIcon = () => (
  <svg {...base} width={14} height={14}><path d="M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.3 20H7" /></svg>
);
export const CommentIcon = () => (
  <svg {...base} width={14} height={14}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
);
export const ArrowLeftIcon = () => (
  <svg {...base} width={16} height={16}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
);
export const ArrowRightIcon = ArrowIcon;
