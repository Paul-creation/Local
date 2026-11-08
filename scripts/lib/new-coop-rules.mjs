// scripts/lib/new-coop-rules.mjs
// 주간 스팀 협동 신작 후보 판정 — find-new-coop-games가 쓰는 순수 함수 (스팀·DB 호출 없음, 테스트 대상)
import { EXCLUDE_GENRES } from './catalog-rules.mjs';
import { isNonGame } from './non-game.mjs';

export const WINDOW_DAYS = 14; // 출시작: 최근 이 기간 안에 출시
export const MIN_REVIEWS = 50; // 출시작: 리뷰 이만큼 이상
export const UPCOMING_TOP_RANK = 30; // 출시 예정작: 스팀 "인기 출시 예정" 순위가 이 안 (팔로워 수는 로그인 없이 못 받아 순위로 대신함)
export const UPCOMING_WITHIN_DAYS = 60; // 출시 예정작: 출시일이 이 기간 안 (출시일을 모르면 탈락)
export const WEEKLY_MAX_RELEASED = 20; // 주 상한: 출시작 (리뷰 많은 순)
export const WEEKLY_MAX_UPCOMING = 10; //          출시 예정작 (출시일 가까운 순)
export const SEXUAL_DESCRIPTOR_IDS = [1, 3, 4]; // ContentNotice와 같은 기준 (일부 노출·성인 전용·빈번한 노출)

// GetItems의 supported_player_categoryids → 스팀 카테고리 이름 (협동·온라인 협동 중 하나는 필수, 멀티·PvP만 있는 게임은 제외)
export const COOP_CATEGORY_IDS = { 9: 'Co-op', 38: 'Online Co-op' };

export function coopCategories(item) {
  const ids = item?.categories?.supported_player_categoryids || [];
  return ids.filter((id) => COOP_CATEGORY_IDS[id]).map((id) => COOP_CATEGORY_IDS[id]);
}

// GetItems store_item → 정리된 후보. 출시일(steam_release_date)이 없으면 releaseTs null
export function normalizeItem(it) {
  const s = it?.reviews?.summary_filtered;
  return {
    appid: String(it.appid ?? it.id),
    name: it.name || '',
    success: it.success === 1,
    type: it.type, // 0 = game
    comingSoon: it.is_coming_soon === true || it.release?.is_coming_soon === true,
    releaseTs: it.release?.steam_release_date ?? null,
    categories: coopCategories(it),
    reviews: s?.review_count || 0,
    positive: s?.percent_positive ?? null,
    isFree: it.is_free === true,
  };
}

// 1차 판정(GetItems 값만): 'released' | 'upcoming' 후보면 { kind }, 아니면 { drop, reason }
// rank: 출시 예정 인기 순위(1부터, 목록에 없으면 null). nowTs: 초 단위
export function firstPass(c, { nowTs, rank = null, windowDays = WINDOW_DAYS } = {}) {
  if (!c.success) return { drop: true, reason: '스팀 상점 정보 없음' };
  if (c.type !== 0) return { drop: true, reason: '종류가 game이 아님 (DLC·사운드트랙·소프트웨어 등)' };
  if (!c.categories.length) return { drop: true, reason: '협동·온라인 협동 카테고리 없음' };
  if (c.comingSoon) {
    if (rank == null) return { drop: true, reason: '출시 예정 · 인기 순위 목록 밖' };
    if (rank > UPCOMING_TOP_RANK) return { drop: true, reason: `출시 예정 · 인기 순위 ${rank}위 (기준 ${UPCOMING_TOP_RANK}위 안)` };
    if (c.releaseTs == null) return { drop: true, reason: '출시 예정 · 출시일 모름' };
    const left = (c.releaseTs - nowTs) / 86400;
    if (left > UPCOMING_WITHIN_DAYS) return { drop: true, reason: `출시 예정 · 출시까지 ${Math.ceil(left)}일 (기준 ${UPCOMING_WITHIN_DAYS}일 안)` };
    return { kind: 'upcoming' };
  }
  if (c.releaseTs == null) return { drop: true, reason: '출시일 모름' };
  const ageDays = (nowTs - c.releaseTs) / 86400;
  if (ageDays > windowDays) return { drop: true, reason: `${Math.floor(ageDays)}일 전 출시 (기준 ${windowDays}일 안)` };
  if (ageDays < 0) return { drop: true, reason: '출시일이 아직 안 됨' };
  return { kind: 'released' };
}

// 출시작 품질: 리뷰 수
export function releasedQuality(c) {
  if (c.reviews >= MIN_REVIEWS) return { ok: true, why: `리뷰 ${c.reviews.toLocaleString('ko-KR')}개` };
  return { ok: false, why: `리뷰 ${c.reviews}개` };
}

// appdetails(영어) 기준 2차 판정: 성인 표시·제외 장르·도구류
export function secondPass(data) {
  const ids = (data?.content_descriptors?.ids || []).map(Number);
  if (ids.some((id) => SEXUAL_DESCRIPTOR_IDS.includes(id))) return { ok: false, reason: `성인 콘텐츠 표시 (${ids.filter((i) => SEXUAL_DESCRIPTOR_IDS.includes(i)).join(',')})` };
  const genres = (data?.genres || []).map((g) => g.description);
  const categories = (data?.categories || []).map((c) => c.description);
  if (data?.type !== 'game') return { ok: false, reason: `스팀 종류가 game이 아님 (${data?.type})` };
  if (EXCLUDE_GENRES.some((e) => genres.includes(e)) || isNonGame(genres, { name: data?.name, categories })) return { ok: false, reason: `제외 장르 (${genres.join(', ')})` };
  return { ok: true };
}

// 상한으로 자르기: 출시작은 리뷰 많은 순 max.released개, 출시 예정작은 출시일 가까운 순 max.upcoming개 (서로 자리를 빌리지 않음)
export function rankPassed(list, { released = WEEKLY_MAX_RELEASED, upcoming = WEEKLY_MAX_UPCOMING } = {}) {
  const rel = list.filter((x) => x.kind !== 'upcoming').sort((a, b) => b.reviews - a.reviews).slice(0, released);
  const up = list.filter((x) => x.kind === 'upcoming').sort((a, b) => a.releaseTs - b.releaseTs).slice(0, upcoming);
  return [...rel, ...up];
}
