// scripts/fetch-coop-videos.mjs
// 멀티 게임의 "친구랑 하는 영상"(한국어 합방·멀티 영상)을 YouTube에서 찾아 game_videos(kind='coop')에 저장
// 실행: node --env-file=.env.local scripts/fetch-coop-videos.mjs [최대 처리 개수, 기본 50]
// - 대상: max_players 2 이상 중 인기 상위 50개 (heat_rank 순, 없으면 current_players 순)
// - coop_videos_at이 30일 이내면 건너뜀 (YouTube 정책상 저장한 정보는 30일마다 갱신)
// - YouTube 사용량: 게임당 약 101 (검색 100 + 영상 정보 1). 하루 한도 10,000
// - 한도 초과면 바로 멈추고 정상 종료 → 다음 실행 때 남은 게임부터 이어서
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const LIMIT = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a))) || 50;
const TOP_N = 50;
const REFRESH_DAYS = 30;
const MAX_SAVE = 3;
const MIN_VIEWS = 1000;
const MIN_SEC = 4 * 60;
const MAX_SEC = 60 * 60;

class QuotaError extends Error {}

async function youtube(path, params) {
  const qs = new URLSearchParams({ ...params, key: YOUTUBE_API_KEY });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${qs}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const reasons = (json.error?.errors || []).map((e) => e.reason).join(',');
    const msg = `HTTP ${res.status} ${reasons} ${json.error?.message || ''}`.trim();
    if (/quota|rateLimitExceeded|dailyLimitExceeded/i.test(reasons + ' ' + (json.error?.message || ''))) throw new QuotaError(msg);
    throw new Error(msg);
  }
  return json;
}

// PT1H2M3S → 초
function parseDuration(iso) {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || '');
  return m ? (Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0)) : 0;
}

async function findCoopVideos(name) {
  const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 3600 * 1000).toISOString();
  const search = await youtube('search', {
    part: 'id',
    q: `${name} 합방 | ${name} 멀티 | ${name} 같이`,
    type: 'video',
    regionCode: 'KR',
    relevanceLanguage: 'ko',
    publishedAfter: twoYearsAgo,
    maxResults: '15',
  });
  const ids = (search.items || []).map((it) => it.id?.videoId).filter(Boolean);
  if (!ids.length) return [];
  const details = await youtube('videos', { part: 'snippet,statistics,contentDetails', id: ids.join(',') });
  return (details.items || [])
    .map((v) => ({
      video_id: v.id,
      title: v.snippet?.title || '',
      channel_id: v.snippet?.channelId || null,
      channel_title: v.snippet?.channelTitle || null,
      published_at: v.snippet?.publishedAt || null,
      view_count: Number(v.statistics?.viewCount || 0),
      duration_sec: parseDuration(v.contentDetails?.duration),
    }))
    .filter((v) => /[가-힣]/.test(v.title) && v.view_count >= MIN_VIEWS && v.duration_sec >= MIN_SEC && v.duration_sec <= MAX_SEC)
    .sort((a, b) => b.view_count - a.view_count)
    .slice(0, MAX_SAVE);
}

// 새 결과를 먼저 넣고, 성공하면 그 게임의 예전 coop 기록만 지움 (중간에 실패해도 영상이 비지 않게)
async function saveVideos(gameId, videos) {
  let newIds = [];
  if (videos.length) {
    const { data, error } = await supabase
      .from('game_videos')
      .insert(videos.map((v) => ({ ...v, game_id: gameId, kind: 'coop' })))
      .select('id');
    if (error) throw new Error(`영상 저장 실패: ${error.message}`);
    newIds = data.map((r) => r.id);
  }
  let del = supabase.from('game_videos').delete().eq('game_id', gameId).eq('kind', 'coop');
  if (newIds.length) del = del.not('id', 'in', `(${newIds.join(',')})`);
  const { error: delError } = await del;
  if (delError) throw new Error(`예전 영상 정리 실패: ${delError.message}`);
  const { error: markError } = await supabase.from('games').update({ coop_videos_at: new Date().toISOString() }).eq('id', gameId);
  if (markError) throw new Error(`확인 날짜 저장 실패: ${markError.message}`);
}

async function main() {
  if (!YOUTUBE_API_KEY) return console.error('.env.local에 YOUTUBE_API_KEY가 없어요');

  const { data: games, error } = await supabase
    .from('games')
    .select('id, name, heat_rank, current_players, coop_videos_at')
    .gte('max_players', 2);
  if (error) return console.error(`❌ 게임 목록을 못 불러옴: ${error.message}`);

  // 인기 순: heat_rank 있는 게임(순위 낮을수록 위) → 없으면 current_players 많은 순
  const top = games
    .filter((g) => g.heat_rank || g.current_players)
    .sort((a, b) => {
      if (a.heat_rank && b.heat_rank) return a.heat_rank - b.heat_rank;
      if (a.heat_rank) return -1;
      if (b.heat_rank) return 1;
      return (b.current_players || 0) - (a.current_players || 0);
    })
    .slice(0, TOP_N);
  const cutoff = Date.now() - REFRESH_DAYS * 24 * 3600 * 1000;
  const todo = top.filter((g) => !g.coop_videos_at || new Date(g.coop_videos_at).getTime() < cutoff).slice(0, LIMIT);
  console.log(`인기 멀티 게임 ${top.length}개 중 갱신할 게임 ${todo.length}개 처리 (최대 ${LIMIT}개)\n`);

  let done = 0, saved = 0, empty = 0, failed = 0;
  for (const g of todo) {
    let videos;
    try {
      videos = await findCoopVideos(g.name);
    } catch (e) {
      if (e instanceof QuotaError) {
        console.log(`⏳ YouTube 한도 초과로 중단, 다음 실행 때 이어서 (${e.message})`);
        break;
      }
      console.log(`⚠️ YouTube 오류: ${g.name} — ${e.message}`);
      failed++;
      continue;
    }
    try {
      await saveVideos(g.id, videos);
    } catch (e) {
      console.log(`❌ ${g.name} — ${e.message}`);
      failed++;
      continue;
    }
    done++;
    saved += videos.length;
    if (!videos.length) empty++;
    console.log(videos.length ? `✅ ${g.name}` : `➖ ${g.name}: 조건에 맞는 영상 없음`);
    for (const v of videos) {
      console.log(`   · ${v.title} — ${v.channel_title} (조회수 ${v.view_count.toLocaleString('ko-KR')}, ${Math.round(v.duration_sec / 60)}분)`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n완료 — 처리한 게임 ${done}개 · 저장한 영상 ${saved}개 · 결과 0개인 게임 ${empty}개${failed ? ` · 오류 ${failed}개` : ''}`);
}

main();
