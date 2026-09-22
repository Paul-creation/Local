import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const REVIEW_LABELS = {
  'Overwhelmingly Positive': '압도적으로 긍정적', 'Very Positive': '매우 긍정적',
  'Positive': '긍정적', 'Mostly Positive': '대체로 긍정적', 'Mixed': '복합적',
  'Mostly Negative': '대체로 부정적', 'Negative': '부정적',
  'Very Negative': '매우 부정적', 'Overwhelmingly Negative': '압도적으로 부정적',
  'No user reviews': '리뷰 없음',
};
const MAX_NEW_GAMES = 20;

async function getReviewSummary(appid) {
  const res = await fetch(`https://store.steampowered.com/appreviews/${appid}?json=1&filter=summary&language=all&purchase_type=all`);
  const json = await res.json();
  return REVIEW_LABELS[json.query_summary?.review_score_desc] || null;
}

async function main() {
  const { data: existing } = await supabase.from('games').select('steam_appid');
  const existingAppids = new Set((existing || []).map((g) => String(g.steam_appid)));

  const listRes = await fetch('https://steamspy.com/api.php?request=top100in2weeks');
  const listJson = await listRes.json();
  const candidates = Object.values(listJson);

  console.log(`SteamSpy 후보 ${candidates.length}개 확보, 스팀에서 co-op 여부 확인 중...\n`);

  let addedCount = 0;
  let checkedCount = 0;

  for (const candidate of candidates) {
    if (addedCount >= MAX_NEW_GAMES) break;
    const appid = String(candidate.appid);
    if (existingAppids.has(appid)) continue;

    const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&cc=kr&l=korean`);
    const json = await res.json();
    checkedCount++;

    if (!json[appid]?.success) {
      if (checkedCount <= 10) console.log(`  ✗ 조회 실패: appid ${appid} (${candidate.name || '이름 없음'})`);
      await new Promise((r) => setTimeout(r, 600));
      continue;
    }

    const data = json[appid].data;
    const categories = (data.categories || []).map((c) => c.description);
    const isCoop = categories.some((c) => /co-?op/i.test(c));

    if (checkedCount <= 10) console.log(`  · ${data.name}: [${categories.join(', ')}]`);

    if (!isCoop) {
      await new Promise((r) => setTimeout(r, 600));
      continue;
    }

    const reviewSummary = await getReviewSummary(appid);

    const { data: inserted, error } = await supabase
      .from('games')
      .insert({
        name: data.name,
        steam_appid: appid,
        platform: ['steam'],
        cover_image_url: data.header_image,
        description: data.short_description,
        review_summary: reviewSummary,
      })
      .select()
      .single();

    if (error) {
      console.error(`저장 실패 (${data.name}):`, error.message);
      continue;
    }

    console.log(`✅ 추가됨: ${data.name} (co-op: ${categories.filter((c) => /co-?op/i.test(c)).join(', ')})`);
    addedCount++;

    if (!data.is_free && data.price_overview) {
      await supabase.from('price_history').insert({
        game_id: inserted.id,
        price: data.price_overview.final / 100,
        discount_percent: data.price_overview.discount_percent,
      });
    }

    await new Promise((r) => setTimeout(r, 1200));
  }

  console.log(`\n총 ${addedCount}개 게임 추가 완료. (조회 성공: ${checkedCount}개)`);
}

main();