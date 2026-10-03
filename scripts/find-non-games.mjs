// scripts/find-non-games.mjs
// 스팀 공식 장르로 "게임이 아닌 프로그램"(유틸리티, 제작 툴 등)을 찾기
// 실행: node --env-file=.env.local scripts/find-non-games.mjs            (최근 14일 안에 추가된 게임만 찾기)
//       node --env-file=.env.local scripts/find-non-games.mjs --all      (게임 전체 찾기, 약 15분)
//       node --env-file=.env.local scripts/find-non-games.mjs --delete   (찾은 것 삭제, --all과 같이 써도 됨)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DELETE = process.argv.includes('--delete');
const ALL = process.argv.includes('--all');
const RECENT_DAYS = 14;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SOFTWARE = ['Utilities', 'Design & Illustration', 'Animation & Modeling', 'Audio Production',
  'Video Production', 'Photo Editing', 'Web Publishing', 'Education', 'Software Training',
  'Accounting', 'Game Development'];
const GAME = ['Action', 'Adventure', 'Casual', 'RPG', 'Simulation', 'Strategy', 'Sports',
  'Racing', 'Massively Multiplayer', 'Indie'];

// 매주 갱신에서는 새로 들어온 게임만 보면 충분하다. 전체를 다시 보려면 --all
let query = supabase.from('games').select('id, name, steam_appid').not('steam_appid', 'is', null);
if (!ALL) query = query.gte('created_at', new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString());
const { data: games, error: loadError } = await query;
if (loadError) {
  console.error(`❌ 게임 목록을 못 불러옴: ${loadError.message}`);
  process.exit(1);
}
const scope = ALL ? '전체' : `최근 ${RECENT_DAYS}일 안에 추가된`;
console.log(`${scope} 스팀 게임 ${games.length}개 확인 (약 ${Math.ceil(games.length * 1.5 / 60)}분)\n`);

const found = [];
for (const g of games) {
  try {
    const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${g.steam_appid}&cc=kr&l=english&filters=genres`);
    const genres = ((await res.json())?.[g.steam_appid]?.data?.genres || []).map((x) => x.description);
    const soft = genres.filter((x) => SOFTWARE.includes(x));
    const isGame = genres.some((x) => GAME.includes(x));
    if (soft.length && !isGame) {
      found.push(g);
      console.log(`🔧 ${g.name} — ${genres.join(', ')}`);
    }
  } catch {}
  await sleep(1500);
}

console.log(`\n게임이 아닌 것으로 보이는 항목: ${found.length}개`);
if (!DELETE || !found.length) {
  if (found.length) console.log('확인 후 지우려면 같은 명령 끝에 --delete 를 붙여서 다시 실행하세요');
  process.exit(0);
}
const ids = found.map((g) => g.id);
for (const t of ['price_history', 'player_history', 'game_votes', 'game_streamers']) {
  await supabase.from(t).delete().in('game_id', ids);
}
const { error } = await supabase.from('games').delete().in('id', ids);
console.log(error ? `❌ 삭제 실패: ${error.message}` : `🗑️  ${ids.length}개 삭제 완료`);
