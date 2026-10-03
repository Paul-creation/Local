// scripts/check-delisted.mjs
// 스팀에서 판매 중단된 것으로 보이는 게임 찾기 — 상점 API 기준 (찾기만 하고 지우지 않음)
// 1) 가격 정보만 100개씩 묶어서 요청 → success:false면 상점에서 사라진 것 (판매 중단)
// 2) 가격이 없는 게임만 하나씩 다시 확인 → 무료·무료 플레이 장르·출시 예정·에디션 가격이 있으면 정상,
//    아니면 "확인 필요"로만 알려줌 (묶음으로만 파는 게임도 여기에 걸려서 SQL에는 넣지 않음)
// 실행: node --env-file=.env.local scripts/check-delisted.mjs
import { createClient } from '@supabase/supabase-js';
import { steamGet } from './lib/steam.mjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH = 100;
const FREE_TO_PLAY_GENRE = '37';

async function main() {
  const { data: games, error } = await supabase.from('games').select('id, name, steam_appid').not('steam_appid', 'is', null);
  if (error) {
    console.error('조회 실패:', error.message);
    return;
  }
  console.log(`스팀 게임 ${games.length}개 확인\n`);

  const candidates = [];
  const review = [];
  const noPrice = [];
  let skipped = 0;

  // 1) 가격 정보 묶음 확인
  for (let i = 0; i < games.length; i += BATCH) {
    const chunk = games.slice(i, i + BATCH);
    let json;
    try {
      json = await steamGet(`https://store.steampowered.com/api/appdetails?appids=${chunk.map((g) => g.steam_appid).join(',')}&cc=kr&filters=price_overview`);
    } catch (e) {
      console.log(`⏳ 묶음 ${i / BATCH + 1} 확인 못 함 — ${e.message}`);
      skipped += chunk.length;
      continue;
    }
    for (const g of chunk) {
      const entry = json?.[g.steam_appid];
      if (!entry) skipped++;
      else if (!entry.success) candidates.push({ ...g, reason: '상점에서 찾을 수 없음' });
      else if (!entry.data?.price_overview) noPrice.push(g);
    }
  }

  // 2) 가격이 없는 게임은 무료인지 하나씩 확인
  console.log(`가격 없는 게임 ${noPrice.length}개 무료 여부 확인 (약 ${Math.ceil(noPrice.length * 2 / 60)}분)\n`);
  for (const g of noPrice) {
    let entry;
    try {
      entry = (await steamGet(`https://store.steampowered.com/api/appdetails?appids=${g.steam_appid}&cc=kr`))?.[g.steam_appid];
    } catch (e) {
      console.log(`⏳ 확인 못 함: ${g.name} — ${e.message}`);
      skipped++;
      continue;
    }
    if (!entry?.success) {
      candidates.push({ ...g, reason: '상점에서 찾을 수 없음' });
      continue;
    }
    const d = entry.data;
    // 에디션별 판매(package_groups)에 가격이나 무료 라이선스가 있으면 살 수 있음
    const editionOnSale = (d.package_groups || []).some((pg) => pg.subs?.some((sub) => sub.price_in_cents_with_discount > 0 || sub.is_free_license));
    const playable = d.is_free || d.genres?.some((x) => x.id === FREE_TO_PLAY_GENRE) || d.release_date?.coming_soon || editionOnSale;
    if (!playable) review.push(g);
  }

  for (const g of candidates) console.log(`⚠️  판매 중단으로 보임: ${g.name} (appid: ${g.steam_appid}) — ${g.reason}`);
  if (review.length) {
    console.log(`\n확인 필요 — 한국 상점에 단품 가격 없음 (묶음 판매만 있거나 판매 중단) ${review.length}개:`);
    for (const g of review) console.log(`   🔍 ${g.name} — https://store.steampowered.com/app/${g.steam_appid}/`);
  }
  if (skipped) console.log(`\n요청 제한 등으로 확인 못 한 게임 ${skipped}개 (판매 중단으로 처리하지 않음)`);

  if (candidates.length === 0) {
    console.log('\n판매 중단된 게임 없음.');
    return;
  }

  console.log(`\n총 ${candidates.length}개 발견. 스팀 상점 페이지에서 직접 확인한 뒤, 맞으면 아래 SQL을 Supabase에서 실행해줘:\n`);
  const values = candidates.map((g) => `('${g.steam_appid}', '${g.name.replace(/'/g, "''")}')`).join(', ');
  const names = candidates.map((g) => `'${g.name.replace(/'/g, "''")}'`).join(', ');
  console.log(`insert into delisted_appids (steam_appid, name) values ${values};`);
  console.log(`delete from games where name in (${names});`);
}

main();
