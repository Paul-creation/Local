// scripts/enrich-videos.mjs
// 영상 없는 게임의 상단 트레일러 찾기 — 매일 조금씩
// 실행: node --env-file=.env.local scripts/enrich-videos.mjs [최대 개수, 기본 90] [--other] [--names="Muck,Inside"] [--steam-only] [--yt-max=N]
//   --steam-only: 스팀 공식 영상만 찾고 유튜브는 안 씀. 스팀 영상이 없으면 null 그대로 둬서 다음 매일 작업이 유튜브로 찾게 함
// - 스팀 게임은 스팀 상점의 공식 영상(appdetails movies, 게임사가 올린 것)을 먼저 씀 → video_url에 HLS 주소(.m3u8) 저장
// - 스팀 영상이 없거나 스팀 외 게임이면 유튜브 검색으로 대체 (YouTube 검색은 하루 약 100번 한도)
//   검색 결과 10개 중 제목에 게임 이름과 trailer·공식 등 트레일러 단서가 있고, 리뷰·공략·방법·speedrun·Part N 등이 없고, movie·영화가 없는 첫 영상 (lib/video-filter.mjs trailerRejectReason)
// - 찾아봤는데 영상이 없으면 video_url을 ''로 저장해서 다음부터 다시 찾지 않음. 이미 값이 있는 게임은 건드리지 않음
import { createClient } from '@supabase/supabase-js';
import { gameNameKeys, excludeTerms } from './lib/coop-targets.mjs';
import { trailerRejectReason, englishNameKeys } from './lib/video-filter.mjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const ONLY_OTHER = process.argv.includes('--other');
const LIMIT = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a))) || 90;
const STEAM_ONLY = process.argv.includes('--steam-only');
// --yt-max=N: 이번 실행의 YouTube 검색 상한 (스팀 영상 찾기는 계속). 넘기면 그 게임은 null 그대로 둬서 다음 실행이 찾음
const YT_MAX = Number((process.argv.find((a) => a.startsWith('--yt-max=')) || '').slice(9)) || Infinity;
const ONLY_NAMES = (process.argv.find((a) => a.startsWith('--names=')) || '').slice(8).split(',').map((s) => s.trim()).filter(Boolean);

class QuotaError extends Error {}

const norm = (s) => String(s || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');

// 스팀 공식 영상 HLS 주소, 영상이 없으면 null. 요청 실패면 오류 (다음에 다시 시도)
async function steamTrailer(appid) {
  const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&filters=movies`);
  if (!res.ok) throw new Error(`스팀 HTTP ${res.status}`);
  const json = await res.json();
  const movies = json?.[appid]?.data?.movies || [];
  const pick = movies.find((m) => m.highlight && m.hls_h264) || movies.find((m) => m.hls_h264);
  const url = pick?.hls_h264;
  return url && /^https:\/\/video\.[a-z.]*steamstatic\.com\/.+\.m3u8/.test(url) ? url.replace(/\?.*$/, '') : null;
}

// 유튜브 영상 주소, 조건에 맞는 결과가 없으면 null. 한도 초과면 QuotaError
async function youtubeTrailer(game) {
  const name = String(game.name).replace(/[™®©]/g, '').trim();
  const query = encodeURIComponent(`${name} game trailer`);
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&maxResults=10&key=${YOUTUBE_API_KEY}`
  );
  const json = await res.json();
  if (json.error) {
    const quota = json.error.errors?.some((e) => /quota/i.test(e.reason)) || /quota/i.test(json.error.message);
    throw quota ? new QuotaError(json.error.message) : new Error(json.error.message);
  }
  const keys = [...gameNameKeys(game), ...englishNameKeys(game)]; // 한글 이름 또는 영어 원제(스토어 주소 이름) 중 하나가 제목에 있으면 됨
  const terms = excludeTerms(game).map(norm).filter(Boolean);
  const hit = (json.items || []).find((it) => {
    const video = { title: it.snippet?.title, channel_title: it.snippet?.channelTitle };
    return it.id?.videoId && !trailerRejectReason(video, keys) && !terms.some((w) => norm(video.title).includes(w));
  });
  return hit ? `https://www.youtube.com/embed/${hit.id.videoId}` : null;
}

async function main() {
  let q = supabase.from('games').select('id, name, steam_appid, external_id, search_name_ko, video_exclude_terms', { count: 'exact' }).eq('hidden', false).is('video_url', null)
    .order('created_at', { ascending: false }).limit(LIMIT);
  if (ONLY_OTHER) q = q.is('steam_appid', null);
  if (STEAM_ONLY) q = q.not('steam_appid', 'is', null);
  if (ONLY_NAMES.length) q = q.in('name', ONLY_NAMES);
  const { data: games, count, error } = await q;
  if (error) return console.error(`❌ 게임 목록을 못 불러옴: ${error.message}`);
  console.log(`영상 없는 게임 ${count ?? 0}개 중 ${games.length}개 처리\n`);

  let steam = 0;
  let found = 0;
  let none = 0;
  let failed = 0;
  let ytSearches = 0;
  for (const game of games) {
    let url = null;
    let source = '';
    try {
      if (game.steam_appid) {
        url = await steamTrailer(game.steam_appid);
        source = '스팀';
      }
      if (!url && STEAM_ONLY) {
        console.log(`➖ ${game.name}: 스팀 영상 없음 (null 그대로)`);
        none++;
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      if (!url) {
        if (!YOUTUBE_API_KEY) {
          console.log(`⏭️ ${game.name}: 스팀 영상 없음, YOUTUBE_API_KEY가 없어 유튜브 검색은 건너뜀`);
          continue;
        }
        if (ytSearches >= YT_MAX) {
          console.log(`⏭️ ${game.name}: 스팀 영상 없음, 이번 실행 YouTube 검색 상한 ${YT_MAX}개 도달 (null 그대로)`);
          continue;
        }
        ytSearches++;
        url = await youtubeTrailer(game);
        source = '유튜브';
      }
    } catch (e) {
      if (e instanceof QuotaError) {
        console.log(`⏳ YouTube 하루 한도 초과 — 나머지는 내일 이어서 (${e.message})`);
        break;
      }
      console.log(`⚠️ 영상 찾기 오류: ${game.name} — ${e.message}`);
      failed++;
      continue;
    }
    const { error: saveError } = await supabase.from('games').update({ video_url: url ?? '' }).eq('id', game.id).is('video_url', null);
    if (saveError) {
      console.log(`❌ 저장 실패 (${game.name}): ${saveError.message}`);
      failed++;
    } else if (url) {
      console.log(`✅ ${game.name} (${source}): ${url}`);
      if (source === '스팀') steam++;
      else found++;
    } else {
      console.log(`➖ ${game.name}: 영상 없음`);
      none++;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\n완료 — 스팀 공식 영상 ${steam}개 · 유튜브 ${found}개 · 영상 없음 ${none}개${STEAM_ONLY ? '(null 그대로, 매일 작업이 유튜브로 찾음)' : ''} · 오류 ${failed}개`);
}

main();
