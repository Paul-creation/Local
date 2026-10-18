// scripts/snapshot-review-history.mjs
// 숨기지 않은 게임의 리뷰 수·긍정률을 오늘 날짜(한국 시간)로 review_history에 저장 (인원별 추천 "인기 급상승"의 리뷰 증가 기록, 영구 보관)
// 실행: node --env-file=.env.local scripts/snapshot-review-history.mjs
// - games 값을 복사만 함 — 외부 요청 없음. enrich-players(review_total 갱신) 뒤에 돌아야 해서 daily 뒤쪽에 둠
// - 같은 날 다시 돌리면 오늘 행을 새 값으로 덮어씀 (다른 날짜 기록은 건드리지 않고, 지우는 쿼리는 없음)
// - review_history 표가 없으면(마이그레이션 전) 실패로 끝남
import { createClient } from '@supabase/supabase-js';
import { buildReviewRows } from './lib/review-snapshot.mjs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const CHUNK = 500;

async function main() {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date()); // YYYY-MM-DD
  const games = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('games').select('id, review_total, review_positive_percent').eq('hidden', false).order('id').range(from, from + 999);
    if (error) throw new Error(`게임 목록을 못 불러옴: ${error.message}`);
    games.push(...data);
    if (data.length < 1000) break;
  }
  const rows = buildReviewRows(games, today);
  if (!rows.length) return console.log('리뷰 수가 있는 게임이 없어서 기록하지 않음');
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from('review_history').upsert(rows.slice(i, i + CHUNK), { onConflict: 'snapshot_date,game_id' });
    if (error) throw new Error(`저장 실패: ${error.message}`);
  }
  console.log(`✅ ${today} 리뷰 기록 ${rows.length}개 저장 (게임 ${games.length}개 중 리뷰 수를 아는 게임)`);
}

main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
