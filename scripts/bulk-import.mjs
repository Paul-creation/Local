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

const MAX_NEW_GAMES = 200;
const EXCLUDE_GENRES = ['Sexual Content', 'Adult Only', 'Nudity', 'Video Production', 'Photo Editing', 'Accounting'];

async function getKoreanTopSellers(page = 0) {
  try {
    const res = await fetch(
      `https://store.steampowered.com/search/results?filter=topsellers&cc=kr&l=korean&json=1&start=${page * 50}&count=50`
    );
    const json = await res.json();
    return json.items || [];
  } catch { return []; }
}

async function main() {
  const { data: existing } = await supabase.from('games').select('steam_appid');
  const existingAppids = new Set((existing || []).map((g) => String(g.steam_appid)));
  const { data: delisted } = await supabase.from('delisted_appids').select('steam_appid');
  const delistedAppids = new Set((delisted || []).map((d) => String(d.steam_appid)));

  let addedCount = 0;
  let page = 0;

  while (addedCount < MAX_NEW_GAMES) {
    const items = await getKoreanTopSellers(page);
    if (!items.length) break;

    console.log(`페이지 ${page + 1}: ${items.length}개 후보`);

    for (const item of items) {
      if (addedCount >= MAX_NEW_GAMES) break;

      const appid = String(item.id);
      if (!appid || appid === 'undefined') continue;
      if (existingAppids.has(appid)) continue;
      if (delistedAppids.has(appid)) continue;

      // 영어로 출시일 확인
      let releaseYear = null;
      try {
        const enRes = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&cc=kr&l=english`);
        const enJson = await enRes.json();
        const dateStr = enJson[appid]?.data?.release_date?.date;
        if (dateStr) {
          const year = new Date(dateStr).getFullYear();
          if (!isNaN(year)) releaseYear = year;
        }
      } catch {}

      if (releaseYear && releaseYear < 2013) {
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

      // 리뷰 최소 기준
      const reviewRes = await fetch(`https://store.steampowered.com/appreviews/${appid}?json=1&filter=summary&language=all&purchase_type=all`);
      const reviewJson = await reviewRes.json();
      const qs = reviewJson.query_summary;
      if (!qs || qs.total_reviews < 1000 || (qs.total_positive / qs.total_reviews) < 0.65) {
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }

      const reviewSummary = REVIEW_LABELS[qs.review_score_desc] || null;

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

    page++;
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\n총 ${addedCount}개 게임 추가 완료.`);
}

main();