// scripts/update-trending.mjs
// 검색 "지금 뜨는 게임" 필터용 판정 저장 — 전체 게임(숨김 제외)을 app/lib/trending.ts 규칙 그대로 판정해 games.trend_badge·trend_score·trend_at에 쓴다
// 실행: node --env-file=.env.local scripts/update-trending.mjs          (미리보기: 개수만 출력, 쓰지 않음)
//       node --env-file=.env.local scripts/update-trending.mjs --apply  (저장)
// - trend_badge: new(신작) · rising_old(다시 뜨는 중) · rising_recent(요즘 뜨는 중), 해당 없으면 null로 초기화
// - 인원 조건·핫차트 상위 10 제외 없음 (그건 메인 인원별 추천 전용). 읽기만 하는 미리보기는 칸이 아직 없어도 동작
// - 칸이 없으면(마이그레이션 전) --apply는 실패로 끝남. 매일 daily 마지막에 돈다 (enrich-players·enrich-recent-reviews 뒤)
import { createClient } from '@supabase/supabase-js';
import { judgeTrends, planWrites, countByBadge } from './lib/trend-judge.mjs';

const apply = process.argv.includes('--apply');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DAY = 86400_000;
const HISTORY_DAYS = 11; // playerGrowth가 보는 가장 먼 기록 (app/lib/peopleRecs와 같음)
const STREAMER_DAYS = 14;
const PAGE = 1000;

async function readAll(build) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

async function main() {
  const now = Date.now();
  // trend 칸이 없으면(마이그레이션 전) 미리보기는 그 칸 없이 읽는다
  const probe = await supabase.from('games').select('trend_badge').limit(1);
  const hasCols = !probe.error;
  if (!hasCols && apply) throw new Error(`trend_badge 칸이 없음 — 마이그레이션 먼저: ${probe.error.message}`);
  const probeStatus = await supabase.from('games').select('release_status').limit(1); // 출시 예정 게임은 판정에서 뺌 (칸이 없으면 그 칸 없이 읽음)
  const cols = `id, hidden, current_players, release_date, review_total, recent_review_count${hasCols ? ', trend_badge, trend_score' : ''}${probeStatus.error ? '' : ', release_status'}`;
  const games = await readAll((a, b) => supabase.from('games').select(cols).order('id').range(a, b));

  const since = new Date(now - HISTORY_DAYS * DAY).toISOString();
  const history = await readAll((a, b) => supabase.from('player_history').select('game_id, player_count, recorded_at').gte('recorded_at', since).order('recorded_at').order('id').range(a, b));
  const samples = new Map();
  for (const r of history) {
    const list = samples.get(r.game_id) ?? [];
    list.push({ age: (now - new Date(r.recorded_at).getTime()) / DAY, count: r.player_count });
    samples.set(r.game_id, list);
  }
  const videos = await readAll((a, b) => supabase.from('streamer_videos').select('game_id, published_at').gte('published_at', new Date(now - STREAMER_DAYS * DAY).toISOString()).order('published_at', { ascending: false }).order('video_id').range(a, b));
  const streamerAges = new Map();
  for (const r of videos) {
    const list = streamerAges.get(r.game_id) ?? [];
    list.push((now - new Date(r.published_at).getTime()) / DAY);
    streamerAges.set(r.game_id, list);
  }

  const judged = judgeTrends(games, samples, streamerAges, now);
  const c = countByBadge(judged);
  console.log(`게임 ${games.length}개(숨김 ${games.filter((g) => g.hidden).length}개 · 출시 예정 ${games.filter((g) => g.release_status === 'coming_soon').length}개 제외 판정) → 신작 ${c.new} · 다시 뜨는 중 ${c.rising_old} · 요즘 뜨는 중 ${c.rising_recent}`);

  const writes = planWrites(games, judged, new Date(now).toISOString());
  if (!apply) return console.log(`미리보기라 저장하지 않음 (저장 대상 ${writes.length}개, --apply로 저장)`);
  for (let i = 0; i < writes.length; i += 10) {
    await Promise.all(writes.slice(i, i + 10).map(async ({ id, ...patch }) => {
      const { error } = await supabase.from('games').update(patch).eq('id', id);
      if (error) throw new Error(`저장 실패 (${id}): ${error.message}`);
    }));
  }
  console.log(`✅ 판정 ${writes.length}개 저장`);
}

main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
