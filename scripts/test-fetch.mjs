import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const APPIDS = [
  '108600',  // Project Zomboid (좀보이드) — 괴물쥐, 랄로 둘 다 플레이
  '322330',  // Don't Starve Together — 괴물쥐 "쥐지마"
  '1326470', // Sons Of The Forest — 괴물쥐 플레이
];

const REVIEW_LABELS = {
  'Overwhelmingly Positive': '압도적으로 긍정적', 'Very Positive': '매우 긍정적',
  'Positive': '긍정적', 'Mostly Positive': '대체로 긍정적', 'Mixed': '복합적',
  'Mostly Negative': '대체로 부정적', 'Negative': '부정적',
  'Very Negative': '매우 부정적', 'Overwhelmingly Negative': '압도적으로 부정적',
  'No user reviews': '리뷰 없음',
};

async function getReviewSummary(appid) {
  const res = await fetch(`https://store.steampowered.com/appreviews/${appid}?json=1&filter=summary&language=all&purchase_type=all`);
  const json = await res.json();
  const desc = json.query_summary?.review_score_desc;
  return REVIEW_LABELS[desc] || desc || null;
}

async function fetchAndSave(appid, existingAppids) {
  if (existingAppids.has(String(appid))) {
    console.log(`건너뜀 (이미 있음): appid ${appid}`);
    return;
  }

  const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&cc=kr&l=korean`);
  const json = await res.json();

  if (!json[appid]?.success) {
    console.error(`실패: appid ${appid} 데이터 없음`);
    return;
  }

  const data = json[appid].data;
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
    return;
  }

  console.log(`저장 성공: ${data.name} (평가: ${reviewSummary})`);

  if (!data.is_free && data.price_overview) {
    await supabase.from('price_history').insert({
      game_id: inserted.id,
      price: data.price_overview.final / 100,
      discount_percent: data.price_overview.discount_percent,
    });
  }

  await new Promise((r) => setTimeout(r, 1000));
}

async function main() {
  const { data: existing } = await supabase.from('games').select('steam_appid');
  const existingAppids = new Set((existing || []).map((g) => String(g.steam_appid)));

  for (const appid of APPIDS) {
    await fetchAndSave(appid, existingAppids);
  }
}

main();