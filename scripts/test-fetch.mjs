import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const APPIDS = [
  '3527290', // PEAK
  '3949040', // RV There Yet?
  '1509960', // PICO PARK
  '1625450', // Muck
  '319450',  // Chariot
  '4704690', // MECCHA CHAMELEON
  '341800',  // Keep Talking and Nobody Explodes
];

async function fetchAndSave(appid) {
  const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&cc=kr&l=korean`);
  const json = await res.json();

  if (!json[appid]?.success) {
    console.error(`실패: appid ${appid} 데이터 없음`);
    return;
  }

  const data = json[appid].data;

  const { data: inserted, error } = await supabase
    .from('games')
    .insert({
      name: data.name,
      steam_appid: appid,
      platform: ['steam'],
      cover_image_url: data.header_image,
    })
    .select()
    .single();

  if (error) {
    console.error(`저장 실패 (${data.name}):`, error.message);
    return;
  }

  console.log(`저장 성공: ${data.name}`);

  if (!data.is_free && data.price_overview) {
    await supabase.from('price_history').insert({
      game_id: inserted.id,
      price: data.price_overview.final / 100,
      discount_percent: data.price_overview.discount_percent,
    });
    console.log(`  → 가격 저장: ${data.price_overview.final_formatted}`);
  }

  await new Promise((r) => setTimeout(r, 1000)); // 스팀 API 과호출 방지
}

async function main() {
  for (const appid of APPIDS) {
    await fetchAndSave(appid);
  }
}

main();