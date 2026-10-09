// 메인 추천 카드(인원별·찜 기반)에 덧붙일 칸을 게임 id들로 한 번에 읽는다 — 서버(getPeopleRecs)와 브라우저(WishlistRecs) 모두 쓴다
// 게임 목록(gameIndex)에는 평가·한국어 지원·태그 이름이 없어서 카드 몇 장 몫만 따로 읽는다. 못 읽으면 빈 객체 → 그 줄들이 숨는다
import { supabase } from './supabase';
import { translateTag } from './tagTranslate';
import { TAG_LIMIT, isNoKorean, type CardExtras } from './cardInfo';

export async function getCardExtras(ids: string[]): Promise<Record<string, CardExtras>> {
  if (!ids.length) return {};
  const { data, error } = await supabase.from('games').select('id, tags, review_summary, review_positive_percent, review_total, korean_support').in('id', ids);
  if (error || !data) return {};
  return Object.fromEntries(data.map((g) => [g.id as string, {
    top_tags: ((g.tags as string[] | null) || []).slice(0, TAG_LIMIT).map((t) => translateTag(t)),
    review_percent: (g.review_positive_percent as number | null) ?? null,
    review_summary: (g.review_summary as string | null) ?? null,
    review_total: (g.review_total as number | null) ?? null,
    no_korean: isNoKorean(g.korean_support as string | null),
  } satisfies CardExtras]));
}
