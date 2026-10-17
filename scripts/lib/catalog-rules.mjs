// scripts/lib/catalog-rules.mjs
// 새 게임 수집 기준 판정 — bulk-import가 쓰는 순수 함수 (스팀·DB 호출 없음, 테스트 대상)
import { isNonGame } from './non-game.mjs';

export const MIN_YEAR = 2013;
export const MIN_REVIEWS = 1000;
export const OLD_GAME_MIN_REVIEWS = 10000; // 2013년 이전 출시라도 리뷰가 이만큼 쌓였으면 통과
export const MIN_POSITIVE = 0.65;
export const MIN_POSITIVE_APPIDS = 0.6; // --appids 목록은 손으로 고른 것이라 조금 낮게
export const POPULAR_MIN_CCU = 5000; // 스팀 공식 동접 차트의 현재 동접이 이 이상이면 긍정률·연도 조건 면제 (차트 100위가 약 2만)
export const EXCLUDE_GENRES = ['Sexual Content', 'Adult Only', 'Nudity', 'Video Production', 'Photo Editing', 'Accounting'];

// 스팀 공식 차트(ISteamChartsService/GetGamesByConcurrentPlayers) 응답 → Map<appid 문자열, 동접>
export function parseChart(json) {
  const ranks = json?.response?.ranks;
  if (!Array.isArray(ranks)) return new Map();
  return new Map(ranks.filter((r) => r?.appid && r.concurrent_in_game >= 0).map((r) => [String(r.appid), Number(r.concurrent_in_game)]));
}

// 한 게임이 기준에 맞는지. 맞으면 { ok: true, via }, 아니면 { ok: false, reason }
// - info: { type, year(모르면 NaN/null), genres(영어), reviews, positive(0~1), name·categories(영어, 있으면 도구류 규칙까지 적용) }
// - opts: { fromList(--appids 목록), force(목록 항목의 force), ccu(차트 동접, 없으면 0), legacy(true면 예전 기준만) }
// 리뷰 개수(1,000개 이상)·종류·장르 조건은 예외 없이 항상 적용 (force는 긍정률·연도만 면제)
export function judge(info, opts = {}) {
  const { fromList = false, force = false, ccu = 0, legacy = false } = opts;
  const { type, year, genres = [], reviews, positive, name, categories } = info;
  if (type !== 'game') return { ok: false, reason: `스팀 종류가 game이 아님 (${type})` };
  if (EXCLUDE_GENRES.some((e) => genres.includes(e)) || isNonGame(genres, { name, categories })) return { ok: false, reason: `제외 장르 (${genres.join(', ')})` };
  if (!reviews) return { ok: false, reason: '리뷰 정보 없음' };
  if (reviews < MIN_REVIEWS) return { ok: false, reason: `리뷰 ${reviews.toLocaleString('ko-KR')}개 · 긍정 ${Math.round(positive * 100)}%` };

  const popular = !legacy && ccu >= POPULAR_MIN_CCU;
  if (!legacy && force) return { ok: true, via: '목록의 force 지정 (긍정률·연도 면제)' };
  if (popular) return { ok: true, via: `동접 ${ccu.toLocaleString('ko-KR')} (긍정률·연도 면제)` };

  const minPositive = fromList ? MIN_POSITIVE_APPIDS : MIN_POSITIVE;
  if (positive < minPositive) return { ok: false, reason: `리뷰 ${reviews.toLocaleString('ko-KR')}개 · 긍정 ${Math.round(positive * 100)}%` };

  const yearKnown = year != null && !Number.isNaN(year);
  if (!fromList && yearKnown && year < MIN_YEAR) {
    if (!legacy && reviews >= OLD_GAME_MIN_REVIEWS) return { ok: true, via: `${year}년 출시지만 리뷰 ${reviews.toLocaleString('ko-KR')}개 (연도 완화)` };
    return { ok: false, reason: `${year}년 출시` };
  }
  return { ok: true, via: fromList ? '기준 통과 (목록)' : '기준 통과' };
}
