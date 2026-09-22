import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DELISTED_PHRASES = ['no longer available', 'this item is not longer available'];

async function isDelisted(appid) {
  try {
    const res = await fetch(`https://store.steampowered.com/app/${appid}`, {
      headers: { 'Accept-Language': 'en-US' },
    });
    const html = await res.text();
    return DELISTED_PHRASES.some((phrase) => html.toLowerCase().includes(phrase));
  } catch {
    return false;
  }
}

async function main() {
  const { data: games, error } = await supabase.from('games').select('id, name, steam_appid');
  if (error) {
    console.error('조회 실패:', error.message);
    return;
  }

  const candidates = [];

  for (const game of games) {
    if (await isDelisted(game.steam_appid)) {
      candidates.push(game);
      console.log(`⚠️  삭제된 것으로 보임: ${game.name} (appid: ${game.steam_appid})`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  if (candidates.length === 0) {
    console.log('\n삭제된 게임 없음.');
    return;
  }

  console.log(`\n총 ${candidates.length}개 발견. 확인 후 아래 SQL을 Supabase에서 실행해줘:\n`);

  const values = candidates.map((g) => `('${g.steam_appid}', '${g.name.replace(/'/g, "''")}')`).join(', ');
  const names = candidates.map((g) => `'${g.name.replace(/'/g, "''")}'`).join(', ');

  console.log(`insert into delisted_appids (steam_appid, name) values ${values};`);
  console.log(`delete from games where name in (${names});`);
}

main();