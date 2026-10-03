// 담당: 친구(검색·태그·비교)
// 비교에 게임을 담을 수 있는지 판단 (메인 + 비교, 비교 만들기 화면 공통)
// 싱글 게임끼리, 멀티 게임끼리만 비교 — 첫 번째로 담은 게임 기준
export const MAX_COMPARE = 3;

export function compareBlockReason(list: { id: string; max_players?: number | null }[], game: { id: string; max_players?: number | null }) {
  if (list.some((g) => g.id === game.id)) return '이미 담은 게임이에요';
  if (list.length >= MAX_COMPARE) return `최대 ${MAX_COMPARE}개까지 비교할 수 있어요`;
  if (list.length > 0) {
    const firstIsSolo = list[0].max_players === 1;
    if (firstIsSolo !== (game.max_players === 1)) {
      return firstIsSolo ? '싱글 게임끼리만 비교할 수 있어요' : '멀티 게임끼리만 비교할 수 있어요';
    }
  }
  return '';
}

// 메인에서 + 비교로 골라둔 게임을 비교 만들기 화면에 미리 채우려고 탭 안에 기억
export const COMPARE_PICK_KEY = 'compare_pick';

// 비교 만들기 화면에서 게임마다 가져오는 칸
export const BUILDER_FIELDS = 'id, name, card_image_url, cover_image_url, min_players, max_players';
