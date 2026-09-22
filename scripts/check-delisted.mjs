import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DELISTED_PHRASES = [
  'no longer available',
  'this item is not longer available', // 스팀에 실제로 이렇게 오타난 문구가 있음
];

async function isDelisted(appid) {
  try {
    const res = await fetch(`https://store.steampowered.com/app/${appid}`, {
      headers: { 'Accept-Language': 'en-US' },
    });
    const html = await res.text();
    const lower = html.toLowerCase();
    return DELISTED_PHRASES.some((phrase) => lower.includes(phrase));
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
    const delisted = await isDelisted(game.steam_appid);
    if (delisted) {
      candidates.push(game);
      console.log(`⚠️  삭제된 것으로 보임: ${game.name} (appid: ${game.steam_appid})`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  if (candidates.length === 0) {
    console.log('\n삭제된 게임 없음.');
    return;
  }

  console.log(`\n총 ${candidates.length}개 발견. 위 목록 직접 스팀에서 한 번 확인해보고,`);
  console.log('맞으면 아래 SQL을 Supabase에 붙여넣어서 삭제해줘:\n');
  console.log(
    candidates
      .map((g) => `delete from games where id = '${g.id}'; -- ${g.name}`)
      .join('\n')
  );
}

main();