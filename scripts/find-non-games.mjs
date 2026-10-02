// scripts/find-non-games.mjs
// 스팀 공식 장르로 "게임이 아닌 프로그램"(유틸리티, 제작 툴 등)을 찾기
// 실행: node --env-file=.env.local scripts/find-non-games.mjs            (찾기만)
//       node --env-file=.env.local scripts/find-non-games.mjs --delete   (찾은 것 삭제)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DELETE = process.argv.includes('--delete');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SOFTWARE = ['Utilities', 'Design & Illustration', 'Animation & Modeling', 'Audio Production',
  'Video Production', 'Photo Editing', 'Web Publishing', 'Education', 'Software Training',
  'Accounting', 'Game Development'];
const GAME = ['Action', 'Adventure', 'Casual', 'RPG', 'Simulation', 'Strategy', 'Sports',
  'Racing', 'Massively Multiplayer', 'Indie'];

const { data: games } = await supabase.from('games').select('id, name, steam_appid').not('steam_appid', 'is', null);
console.log(`스팀 게임 ${games.length}개 확인 (약 ${Math.ceil(games.length * 1.5 / 60)}분)\n`);

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
