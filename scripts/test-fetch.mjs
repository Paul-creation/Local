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
  '341800', // Keep Talking and Nobody Explodes 
];

async function fetchAndSave(appid) {
  const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}`);
  const json = await res.json();

  if (!json[appid]?.success) {
    console.error(`실패: appid ${appid} 데이터 없음`);
    return;
  }

  const data = json[appid].data;

  const { error } = await supabase.from('games').insert({
    name: data.name,
    steam_appid: appid,
    platform: ['steam'],
    cover_image_url: data.header_image,
  });

  if (error) {
    console.error(`저장 실패 (${data.name}):`, error.message);
  } else {
    console.log(`저장 성공: ${data.name}`);
  }

  await new Promise((r) => setTimeout(r, 1000)); // 스팀 API 과호출 방지
}

async function main() {
  for (const appid of APPIDS) {
    await fetchAndSave(appid);
  }
}

main();