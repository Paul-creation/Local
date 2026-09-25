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

const MAX_NEW_GAMES = 300;
const EXCLUDE_GENRES = ['Sexual Content', 'Adult Only', 'Nudity', 'Video Production', 'Photo Editing', 'Accounting'];

async function getReviewSummary(appid) {
  try {
    const res = await fetch(`https://store.steampowered.com/appreviews/${appid}?json=1&filter=summary&language=all&purchase_type=all`);
    const json = await res.json();
    return REVIEW_LABELS[json.query_summary?.review_score_desc] || null;
  } catch { return null; }
}

async function getEnglishReleaseYear(appid) {
  try {
    const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&cc=kr&l=english`);
    const json = await res.json();
    const dateStr = json[appid]?.data?.release_date?.date;
    if (!dateStr) return null;
    const year = new Date(dateStr).getFullYear();
    return isNaN(year) ? null : year;
  } catch { return null; }
}

async function main() {
  const { data: existing } = await supabase.from('games').select('steam_appid');
  const existingAppids = new Set((existing || []).map((g) => String(g.steam_appid)));
  const { data: delisted } = await supabase.from('delisted_appids').select('steam_appid');
  const delistedAppids = new Set((delisted || []).map((d) => String(d.steam_appid)));

    const endpoints = [
    'https://steamspy.com/api.php?request=top100in2weeks',
    'https://steamspy.com/api.php?request=top100forever',
    'https://steamspy.com/api.php?request=tag&tag=Co-op',
    'https://steamspy.com/api.php?request=tag&tag=Multiplayer',
    'https://steamspy.com/api.php?request=tag&tag=Online+Co-Op',
    'https://steamspy.com/api.php?request=tag&tag=Survival',
    'https://steamspy.com/api.php?request=tag&tag=Open+World',
    'https://steamspy.com/api.php?request=tag&tag=Battle+Royale',
    'https://steamspy.com/api.php?request=tag&tag=Horror',
    'https://steamspy.com/api.php?request=tag&tag=RPG',
    'https://steamspy.com/api.php?request=tag&tag=Strategy',
    'https://steamspy.com/api.php?request=tag&tag=Puzzle',
  ];
  const allCandidates = new Map();
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint);
      const json = await res.json();
      Object.values(json).forEach(g => allCandidates.set(String(g.appid), g));
      await new Promise((r) => setTimeout(r, 1000));
    } catch (e) {
      console.error(`엔드포인트 실패: ${endpoint}`);
    }
  }

  const candidates = Array.from(allCandidates.values());
  console.log(`총 후보 ${candidates.length}개 확보\n`);

  let addedCount = 0;

  for (const candidate of candidates) {
    if (addedCount >= MAX_NEW_GAMES) break;

    const appid = String(candidate.appid);
    if (existingAppids.has(appid)) continue;
    if (delistedAppids.has(appid)) continue;

    // 출시년도 먼저 확인 (영어로)
    const releaseYear = await getEnglishReleaseYear(appid);
    if (releaseYear !== null && releaseYear < 2015) {
      await new Promise((r) => setTimeout(r, 300));
      continue;
    }

    let json;
    try {
      const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&cc=kr&l=korean`);
      json = await res.json();
    } catch { continue; }

    if (!json || !json[appid]?.success) {
      await new Promise((r) => setTimeout(r, 600));
      continue;
    }

    const data = json[appid].data;

    if (data.type !== 'game') {
      await new Promise((r) => setTimeout(r, 300));
      continue;
    }

    const genres = (data.genres || []).map(g => g.description);
    if (EXCLUDE_GENRES.some(e => genres.includes(e))) {
      await new Promise((r) => setTimeout(r, 300));
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
        is_casual_party: false,
      })
      .select()
      .single();

    if (error) {
      console.error(`저장 실패 (${data.name}):`, error.message);
      continue;
    }

    console.log(`✅ 추가됨: ${data.name} (${appid}) — ${releaseYear}년`);
    addedCount++;
    existingAppids.add(appid);

    if (!data.is_free && data.price_overview) {
      await supabase.from('price_history').insert({
        game_id: inserted.id,
        price: data.price_overview.final / 100,
        discount_percent: data.price_overview.discount_percent,
      });
    }

    await new Promise((r) => setTimeout(r, 1200));
  }

  console.log(`\n총 ${addedCount}개 게임 추가 완료.`);
}

main();