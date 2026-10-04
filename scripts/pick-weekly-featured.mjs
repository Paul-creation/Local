// scripts/pick-weekly-featured.mjs
// 메인 "이번주의 게임"을 골라 featured_games에 저장 (한 주에 1개, week_start = 그 주 금요일, 한국 시간)
// 실행: node --env-file=.env.local scripts/pick-weekly-featured.mjs
// - 이번 주 기록이 이미 있으면(직접 지정한 경우 포함) 아무것도 안 함
// - 후보: 2인 이상, 큰 이미지(hero/card) 있음, 한 줄 소개 있음, 최근 8주 안에 뽑힌 적 없음
// - 순위: hot_rank_history 최근 7일 평균 순위 (순위권 밖인 날은 51위). 기록된 날이 3일 미만이면 오늘 heat_rank 순위로 대신
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const OUT_RANK = 51;
const MIN_DAYS = 3;
const EXCLUDE_WEEKS = 8;
const TODAY_POOL = 200; // 오늘 순위로 고를 때 볼 heat_rank 상위 개수

const DAY = 24 * 3600 * 1000;
const addDays = (date, days) => new Date(new Date(date + 'T00:00:00Z').getTime() + days * DAY).toISOString().slice(0, 10);
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date()); // YYYY-MM-DD
// 오늘 또는 그 이전 가장 가까운 금요일
const weekStart = addDays(today, -((new Date(today + 'T00:00:00Z').getUTCDay() - 5 + 7) % 7));

async function main() {
  const { data: existing, error: existErr } = await supabase.from('featured_games').select('game_id, picked_by').eq('week_start', weekStart).maybeSingle();
  if (existErr) throw new Error(`이번 주 기록 확인 실패: ${existErr.message}`);
  if (existing) return console.log(`이번 주(${weekStart}) 게임이 이미 있음 (${existing.picked_by}) → 건너뜀`);

  // 최근 7일 순위 기록
  const { data: hist, error: histErr } = await supabase
    .from('hot_rank_history')
    .select('game_id, rank, snapshot_date')
    .gte('snapshot_date', addDays(today, -6))
    .lte('snapshot_date', today)
    .limit(5000);
  if (histErr) throw new Error(`순위 기록을 못 불러옴: ${histErr.message}`);
  const days = new Set(hist.map((r) => r.snapshot_date));

  let ranked; // [{ id, score, reason }] 점수 낮을수록 위
  if (days.size >= MIN_DAYS) {
    const sum = new Map();
    const inDays = new Map();
    for (const r of hist) {
      sum.set(r.game_id, (sum.get(r.game_id) || 0) + r.rank);
      inDays.set(r.game_id, (inDays.get(r.game_id) || 0) + 1);
    }
    ranked = [...sum.keys()].map((id) => {
      const avg = (sum.get(id) + (days.size - inDays.get(id)) * OUT_RANK) / days.size;
      return { id, score: avg, reason: `지난 7일 평균 ${avg.toFixed(1).replace(/\.0$/, '')}위 (기록 ${days.size}일 중 ${inDays.get(id)}일 순위권)` };
    });
  } else {
    // 기록이 부족하면 오늘 "지금 뜨는 게임" 순위(heat_rank 순)로
    const { data: hot, error: hotErr } = await supabase
      .from('games').select('id').eq('hidden', false).not('heat_rank', 'is', null).order('heat_rank', { ascending: true }).limit(TODAY_POOL);
    if (hotErr) throw new Error(`오늘 순위를 못 불러옴: ${hotErr.message}`);
    ranked = hot.map((g, i) => ({ id: g.id, score: i + 1, reason: `오늘 인기 급상승 ${i + 1}위 (순위 기록 ${days.size}일뿐이라 오늘 순위 기준)` }));
    console.log(`순위 기록이 ${days.size}일뿐이라 오늘 순위로 고름`);
  }
  if (!ranked.length) return console.log('순위 정보가 없어서 고르지 않음');

  const [{ data: recent, error: recentErr }, { data: games, error: gamesErr }] = await Promise.all([
    supabase.from('featured_games').select('game_id').gte('week_start', addDays(weekStart, -7 * EXCLUDE_WEEKS)),
    supabase
      .from('games')
      .select('id, name').eq('hidden', false)
      .in('id', ranked.map((r) => r.id))
      .gte('max_players', 2)
      .not('fun_description', 'is', null)
      .neq('fun_description', '')
      .or('hero_image_url.not.is.null,card_image_url.not.is.null'),
  ]);
  if (recentErr) throw new Error(`최근 기록 확인 실패: ${recentErr.message}`);
  if (gamesErr) throw new Error(`후보를 못 불러옴: ${gamesErr.message}`);

  const recentIds = new Set(recent.map((r) => r.game_id));
  const nameById = new Map(games.map((g) => [g.id, g.name]));
  const candidates = ranked
    .filter((r) => nameById.has(r.id) && !recentIds.has(r.id))
    .sort((a, b) => a.score - b.score);
  if (!candidates.length) return console.log('조건에 맞는 후보가 없어서 고르지 않음');

  const pick = candidates[0];
  const { error: insertErr } = await supabase
    .from('featured_games')
    .insert({ week_start: weekStart, game_id: pick.id, reason: pick.reason, picked_by: 'auto' });
  // 그 사이 누가 직접 지정했으면 (같은 week_start) 그대로 둔다
  if (insertErr?.code === '23505') return console.log(`이번 주(${weekStart}) 게임이 방금 지정됨 → 건너뜀`);
  if (insertErr) throw new Error(`저장 실패: ${insertErr.message}`);

  console.log(`✅ ${weekStart} 이번주의 게임: ${nameById.get(pick.id)} — ${pick.reason}`);
  console.log('후보 상위 5개:\n' + candidates.slice(0, 5).map((c, i) => `  ${i + 1}. ${nameById.get(c.id)} — ${c.reason}`).join('\n'));
}

main().catch((e) => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
