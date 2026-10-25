// scripts/check-expired-demos.mjs
// 내려간 데모 정리 — games.demo_appid가 스팀에서 내려갔으면 비움 (매일, check-coming-soon 바로 뒤)
// 실행: node --env-file=.env.local scripts/check-expired-demos.mjs           (미리보기 — 비울 게임만 출력, DB는 안 건드림)
//       node --env-file=.env.local scripts/check-expired-demos.mjs --apply   (demo_appid 비우기)
// - 판정: 부모 게임 appdetails의 demos[]에 demo_appid가 없으면 내려간 데모. 보조로 데모 appdetails가 success:false여도 내려간 것 (scripts/lib/expired-demos.mjs)
// - 스팀 요청이 실패한 게임은 건너뛰고 다음 날 다시 확인
import { createClient } from '@supabase/supabase-js';
import { steamGet, appdetailsUrl } from './lib/steam.mjs';
import { judgeDemo, parentListsDemo } from './lib/expired-demos.mjs';

const APPLY = process.argv.includes('--apply');
const TIME_BUDGET_MS = 40 * 60 * 1000; // run-steps 단계 시간 제한(45분) 전에 스스로 멈춤
const startedAt = Date.now();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: games, error } = await supabase
    .from('games')
    .select('id, name, steam_appid, demo_appid')
    .not('demo_appid', 'is', null)
    .neq('demo_appid', '')
    .not('steam_appid', 'is', null)
    .order('id');
  if (error) throw new Error(`데모 게임 조회 실패: ${error.message}`);
  console.log(`${APPLY ? '반영' : '미리보기'} — 데모가 있는 게임 ${games.length}개 확인\n`);

  let alive = 0, expired = 0, skipped = 0;
  for (const game of games) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) { console.log('⏱️  시간이 지나서 여기서 멈춤 (남은 게임은 내일)'); break; }
    try {
      const parentRes = (await steamGet(appdetailsUrl(game.steam_appid, 'korean', 'kr')))?.[game.steam_appid];
      // 부모에 아직 올라 있을 때만 데모 appdetails를 따로 확인 (요청 절약)
      const demoRes = parentListsDemo(parentRes, game.demo_appid) === true
        ? (await steamGet(appdetailsUrl(game.demo_appid, 'korean', 'kr')))?.[game.demo_appid]
        : undefined;
      const verdict = judgeDemo(parentRes, game.demo_appid, demoRes);
      if (verdict === 'skip') { skipped++; console.log(`   ⚠️ ${game.name}: 스팀 상점 정보 없음 (내일 다시 확인)`); continue; }
      if (verdict === 'alive') { alive++; continue; }
      if (APPLY) {
        const { error: upErr } = await supabase.from('games').update({ demo_appid: null }).eq('id', game.id).eq('demo_appid', game.demo_appid);
        if (upErr) { skipped++; console.log(`   ❌ ${game.name}: 저장 실패 ${upErr.message}`); continue; }
      }
      expired++;
      console.log(`🧹 종료된 데모: ${game.name} (데모 ${game.demo_appid})`);
    } catch (e) {
      skipped++;
      console.log(`   ⚠️ ${game.name}: ${e.message} (내일 다시 확인)`);
    }
  }
  console.log(`\n종료된 데모 ${expired}개 · 유지 ${alive}개 · 건너뜀 ${skipped}개`);
  if (!APPLY) console.log('미리보기만 했어요. 반영하려면 --apply를 붙여 주세요');
}

main().catch((e) => {
  console.error('종료된 데모 확인 중단:', e.message);
  process.exit(1);
});
