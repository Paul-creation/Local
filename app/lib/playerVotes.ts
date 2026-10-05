// 추천 인원 투표 공통 값 (브라우저·서버 모두 import 가능)
export const PLAYER_CHOICES = [['1', '혼자'], ['2', '2명'], ['3', '3명'], ['4', '4명'], ['5-8', '5~8명'], ['9+', '9명 이상']] as const;
export type PlayerChoice = (typeof PLAYER_CHOICES)[number][0];
export const isPlayerChoice = (v: unknown): v is PlayerChoice => PLAYER_CHOICES.some(([k]) => k === v);
export const choiceLabel = (k: string) => PLAYER_CHOICES.find(([c]) => c === k)?.[1] ?? k;
// 결과는 이만큼 모인 뒤에만 보여 준다 (적은 표로 단정하지 않게)
export const MIN_VOTES_TO_SHOW = 20;
