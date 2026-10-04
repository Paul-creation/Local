// scripts/enrich-videos.mjs
// 영상 없는 게임의 유튜브 트레일러 찾기 — 매일 조금씩 (YouTube 검색은 하루 약 100번 한도)
// 실행: node --env-file=.env.local scripts/enrich-videos.mjs [최대 개수, 기본 90] [--other]
// 찾아봤는데 영상이 없으면 video_url을 ''로 저장해서 다음부터 다시 찾지 않음
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const ONLY_OTHER = process.argv.includes('--other');
const LIMIT = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a))) || 90;

class QuotaError extends Error {}

// 영상 주소, 검색 결과가 없으면 null. 한도 초과면 QuotaError
async function searchTrailer(gameName) {
  const query = encodeURIComponent(`${gameName} official trailer`);
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&maxResults=1&key=${YOUTUBE_API_KEY}`
  );
  const json = await res.json();
  if (json.error) {
    const quota = json.error.errors?.some((e) => /quota/i.test(e.reason)) || /quota/i.test(json.error.message);
    throw quota ? new QuotaError(json.error.message) : new Error(json.error.message);
  }
  const videoId = json.items?.[0]?.id?.videoId;
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}

async function main() {
  if (!YOUTUBE_API_KEY) return console.error('.env.local에 YOUTUBE_API_KEY가 없어요');

  let q = supabase.from('games').select('id, name', { count: 'exact' }).eq('hidden', false).is('video_url', null)
    .order('created_at', { ascending: false }).limit(LIMIT);
  if (ONLY_OTHER) q = q.is('steam_appid', null);
  const { data: games, count, error } = await q;
  if (error) return console.error(`❌ 게임 목록을 못 불러옴: ${error.message}`);
  console.log(`영상 없는 게임 ${count ?? 0}개 중 ${games.length}개 처리\n`);

  let found = 0;
  let none = 0;
  let failed = 0;
  for (const game of games) {
    let url;
    try {
      url = await searchTrailer(game.name);
    } catch (e) {
      if (e instanceof QuotaError) {
        console.log(`⏳ YouTube 하루 한도 초과 — 나머지는 내일 이어서 (${e.message})`);
        break;
      }
      console.log(`⚠️ YouTube API 오류: ${game.name} — ${e.message}`);
      failed++;
      continue;
    }
    const { error: saveError } = await supabase.from('games').update({ video_url: url ?? '' }).eq('id', game.id).is('video_url', null);
    if (saveError) {
      console.log(`❌ 저장 실패 (${game.name}): ${saveError.message}`);
      failed++;
    } else if (url) {
      console.log(`✅ ${game.name}: ${url}`);
      found++;
    } else {
      console.log(`➖ ${game.name}: 영상 없음`);
      none++;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\n완료 — 영상 찾음 ${found}개 · 영상 없음 ${none}개 · 오류 ${failed}개`);
}

main();
