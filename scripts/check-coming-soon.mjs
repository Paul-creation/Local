// scripts/check-coming-soon.mjs
// 출시 예정(games.release_status = 'coming_soon') 게임이 출시됐는지 스팀 appdetails로 확인 — 매일 첫 단계 (가격 수집보다 먼저, 출시된 날부터 일반 게임처럼 가격·리뷰를 받도록)
// 실행: node --env-file=.env.local scripts/check-coming-soon.mjs           (미리보기 — 바뀔 게임만 출력, DB는 안 건드림)
//       node --env-file=.env.local scripts/check-coming-soon.mjs --apply   (저장)
// - 출시됐으면 release_status를 'released'로만 바꿈. 아직이면 출시일 원문(release_date_text)·데모(demo_appid)가 스팀에서 바뀐 경우만 따라감 (스팀 응답에 값이 없다고 기존 값을 비우지 않음)
// - 스팀 요청이 끝까지 실패한 게임은 건너뛰고 다음 날 다시 확인. 가격·리뷰 실패로 세지 않음
// - 결과 숫자는 scripts/.cache/coming-soon-check.json → 일일 요약 "출시 전환 N개"
import { createClient } from '@supabase/supabase-js';
import { steamGet, appdetailsUrl } from './lib/steam.mjs';
import { comingSoonPatch, recordComingSoonCheck } from './lib/coming-soon.mjs';

const APPLY = process.argv.includes('--apply');
const TIME_BUDGET_MS = 40 * 60 * 1000; // run-steps 단계 시간 제한(45분) 전에 스스로 멈춤
const startedAt = Date.now();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: games, error } = await supabase
    .from('games')
    .select('id, name, steam_appid, release_date_text, demo_appid')
    .eq('hidden', false)
    .eq('release_status', 'coming_soon')
    .not('steam_appid', 'is', null)
    .order('id');
  if (error) throw new Error(`출시 예정 게임 조회 실패: ${error.message}`);
  console.log(`${APPLY ? '반영' : '미리보기'} — 출시 예정 게임 ${games.length}개 확인\n`);

  let checked = 0, released = 0, failed = 0, updated = 0;
  for (const game of games) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) { console.log('⏱️  시간이 지나서 여기서 멈춤 (남은 게임은 내일)'); break; }
    try {
      const res = (await steamGet(appdetailsUrl(game.steam_appid, 'korean', 'kr')))?.[game.steam_appid];
      if (!res?.success) { failed++; console.log(`   ⚠️ ${game.name}: 스팀 상점 정보 없음 (내일 다시 확인)`); continue; }
      checked++;
      const { released: isOut, patch } = comingSoonPatch(game, res.data);
      if (!patch) continue;
      if (APPLY) {
        const { error: upErr } = await supabase.from('games').update(patch).eq('id', game.id).eq('release_status', 'coming_soon');
        if (upErr) { failed++; checked--; console.log(`   ❌ ${game.name}: 저장 실패 ${upErr.message}`); continue; }
      }
      if (isOut) { released++; console.log(`🚀 출시됨: ${game.name} (${game.steam_appid})`); }
      else { updated++; console.log(`✏️  ${game.name}: ${Object.entries(patch).map(([k, v]) => `${k} → ${v}`).join(', ')}`); }
    } catch (e) {
      failed++;
      console.log(`   ⚠️ ${game.name}: ${e.message} (내일 다시 확인)`);
    }
  }
  console.log(`\n출시 전환 ${released}개 · 출시일·데모 갱신 ${updated}개 · 확인 실패 ${failed}개 (확인 ${checked}개)`);
  if (APPLY) recordComingSoonCheck({ checked, released, failed });
  else console.log('미리보기만 했어요. 반영하려면 --apply를 붙여 주세요');
}

main().catch((e) => {
  console.error('출시 여부 확인 중단:', e.message);
  process.exit(1);
});
