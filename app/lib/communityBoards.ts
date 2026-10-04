// 커뮤니티 게시판 공통 값 (브라우저·서버 모두에서 import 가능 — 비밀 값 넣지 말 것)
import { formatDate } from './date';


export const BOARDS = {
  party: { emoji: '🎮', label: '같이 할 사람', desc: '같이 게임할 친구를 찾아요' },
  ask: { emoji: '🤔', label: '뭐 하지?', desc: '어떤 게임 할지 물어봐요' },
  free: { emoji: '💬', label: '자유', desc: '게임 이야기 아무거나' },
} as const;

export type BoardKey = keyof typeof BOARDS;
export const BOARD_KEYS = Object.keys(BOARDS) as BoardKey[];
export const isBoard = (v: unknown): v is BoardKey => typeof v === 'string' && v in BOARDS;
export const boardTitle = (b: BoardKey) => `${BOARDS[b].emoji} ${BOARDS[b].label}`;

// DB 제약(check constraint)과 같은 값
export const LIMITS = {
  title: [2, 80],
  body: [2, 3000],
  comment: [1, 1000],
  gameComment: [1, 200],
  nickname: [2, 12],
  password: [4, 64],
} as const;

export const REPORT_REASONS = ['욕설·비방', '광고·도배', '개인정보 노출', '기타'] as const;

export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}일 전`;
  return formatDate(iso);
}
