// 의견함 공통 값 (브라우저·서버 모두에서 import 가능 — 비밀 값 넣지 말 것). DB check 제약과 같은 값
export const FEEDBACK_KINDS = {
  bug: '버그',
  info: '인원·정보 오류',
  feature: '기능 제안',
  etc: '기타',
} as const;

export type FeedbackKind = keyof typeof FEEDBACK_KINDS;
export const isFeedbackKind = (v: unknown): v is FeedbackKind => typeof v === 'string' && v in FEEDBACK_KINDS;
export const FEEDBACK_LIMITS = { body: [2, 1000], contact: 100 } as const;
