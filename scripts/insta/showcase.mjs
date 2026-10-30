// scripts/insta/showcase.mjs
// --showcase: 인디 게임 추천 형식. 게임마다 영상 장(트레일러 + 검은 패널) + 시그니처 장(데이터 상세)
import { createClient } from '@supabase/supabase-js';
import { buyTimingLine, SAME_AS_LOWEST } from '../../app/lib/buyTiming.ts';
import { loadCopy } from './detailed.mjs';

const DAY = 86400000;
export const SHORT_RECORD_DAYS = 120; // 가격 기록이 이보다 짧으면 "아직 할인 기록이 적어요"

// "지금 사도 될까?" 판정. history = price_history 행, price = 스팀 현재가(원), lowest = games.lowest_price
export function buyVerdict(history, { price, discount, lowest, now = Date.now() }) {
  const rows = history.filter((r) => r.price >= 100 && r.checked_at);
  const first = rows.length ? Math.min(...rows.map((r) => new Date(r.checked_at).getTime())) : now;
  const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;
  const nowText = `현재 ${won(price)}${discount ? ` (-${discount}%)` : ''}`;
  if (rows.length < 2 || (now - first) / DAY < SHORT_RECORD_DAYS) return { head: '아직 할인 기록이 적어요', sub: lowest ? `${nowText} · ${Math.round(price) <= Math.round(lowest) ? '지금이 기록상 최저가예요' : `기록상 최저 ${won(lowest)}`}` : nowText, kind: 'short' };
  if (lowest && Math.round(price) <= Math.round(lowest)) return { head: '지금이 역대 최저가 → 지금 사세요', sub: nowText, kind: 'now' };
  const line = buyTimingLine(history, { currentPrice: price, currentDiscount: discount, lowestPrice: lowest ?? null, now });
  return { head: `할인 땐 ${won(lowest)}까지 내려가요 → 기다려도 OK`, sub: [nowText, line && line !== SAME_AS_LOWEST ? line : null].filter(Boolean).join(' · '), kind: 'wait' };
}

// ttb_normally(초) → 시간 단위. 비정상 값(1000시간 초과)은 null
export const playHours = (sec) => (sec > 0 && sec <= 1000 * 3600 ? Math.max(1, Math.round(sec / 3600)) : null);

export { loadCopy };
export const VIDEO_SECONDS = 15;
export const START_RATIO = 0.2; // copy.clipStart가 없으면 영상 길이의 20% 지점에서 시작

// 영상 장: 표지 + 게임마다(영상 장, 시그니처 장) + 팔로우 카드. 인스타 한도 20장
export function expandShowcase(base, copy) {
  const games = copy.games ?? [];
  if (!games.length) throw new Error('--showcase: copy/<id>.json의 games가 비어 있어요');
  const cover = base.find((s) => s.type === 'roundup-cover');
  if (!cover) throw new Error('--showcase: posts json에 roundup-cover 슬라이드가 필요해요');
  const follow = base.find((s) => s.type === 'follow-card') ?? { type: 'follow-card', title: '친구랑 할 게임, 고민되면' };
  const fill = (v) => String(v).replace('{N}', games.length);
  const out = [
    { ...cover, game: games[0].appid, shot: copy.coverShot ?? 1, title1: fill(cover.title1), title2: fill(cover.title2) },
    ...games.flatMap((g) => [{ type: 'showcase-video', game: g.appid, g }, { type: 'showcase-sig', game: g.appid, g, accent: cover.accent }]),
    { ...follow, game: follow.game ?? games[0].appid },
  ];
  if (out.length > 20) throw new Error(`--showcase: ${out.length}장이라 인스타 한도(20장)를 넘어요`);
  return out;
}

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const SHOWCASE_FIELDS = 'id, lowest_price, current_players, recent_review_label, recent_review_pct, entry_barrier, entry_barrier_reason, has_ending, ttb_normally, price_history(price, discount_percent, checked_at)';

// 시그니처 장·영상 장에 쓰는 DB 값 (읽기만). 비슷한 게임 = game_similar 점수순에서 숨김·병합·1인 전용 제외 후 상위 2개
export async function showcaseData(game) {
  const { data, error } = await db().from('games').select(SHOWCASE_FIELDS).eq('id', game.id).single();
  if (error) throw new Error(`게임 조회 실패(${game.id}): ${error.message}`);
  const { data: sim, error: e2 } = await db().from('game_similar').select('score, similar:similar_id(name, display_name, max_players, hidden, merged_into)').eq('game_id', game.id).order('score', { ascending: false }).limit(18);
  if (e2) throw new Error(`비슷한 게임 조회 실패: ${e2.message}`);
  const similar = (sim ?? []).map((r) => r.similar).filter((g) => g && !g.hidden && !g.merged_into && g.max_players >= 2).slice(0, 2).map((g) => g.display_name || g.name);
  return { ...data, similar };
}

// 영상 장 정보 줄: PC(Steam) / N~N인 / 한국어 지원 / ₩가격(-N%)
export function infoLine(game, { korean, price, discount }) {
  const people = game.min_players === game.max_players ? `${game.max_players}인` : `${game.min_players}~${game.max_players}인`;
  return ['PC(Steam)', people, korean ? '한국어 지원' : '한국어 미지원', `₩${Math.round(price).toLocaleString('ko-KR')}${discount ? ` (-${discount}%)` : ''}`].join(' / ');
}

// 시그니처 장 행. 값이 없는 행은 만들지 않고 missing에 남긴다
export function sigRows(d, g, { verdict, game }) {
  const rows = [], missing = [];
  rows.push({ key: 'verdict', label: '지금 사도 될까?', value: verdict.head, sub: verdict.sub });
  const players = [d.current_players != null && `지금 ${d.current_players.toLocaleString('ko-KR')}명 플레이 중`, d.recent_review_label && d.recent_review_pct != null && `최근 평가 ${d.recent_review_label} ${d.recent_review_pct}%`].filter(Boolean);
  if (players.length) rows.push({ label: '플레이 현황', value: players.join(' · ') }); else missing.push('플레이 현황');
  const reason = g.barrierReason ?? d.entry_barrier_reason;
  if (d.entry_barrier && reason) rows.push({ label: '진입 장벽', value: `${d.entry_barrier} — ${reason}`, fit: true }); else missing.push('진입 장벽');
  if (g.chips?.length) rows.push({ label: g.chipsLabel ?? '이런 걸 해요', chips: g.chips }); else missing.push('칩');
  const hours = playHours(d.ttb_normally);
  const ending = d.has_ending === true ? '엔딩 있음' : d.has_ending === false ? '엔딩 없음' : null;
  const endText = [ending, hours && `약 ${hours}시간`].filter(Boolean).join(' · ');
  if (endText) rows.push({ label: '엔딩 · 플레이타임', value: endText }); else missing.push('엔딩·플레이타임');
  if (d.similar.length) rows.push({ label: '비슷한 게임', value: d.similar.join(' · ') }); else missing.push('비슷한 게임');
  if (g.oneliner) rows.push({ label: '한 줄 평', value: `"${g.oneliner}"`, small: true }); else missing.push('한 줄 평');
  return { rows, missing };
}
