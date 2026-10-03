// scripts/fetch-coop-videos.mjs
// 멀티 게임의 "친구랑 하는 영상"(한국어 합방·멀티 영상)을 YouTube에서 찾아 game_videos(kind='coop')에 저장
// 실행: node --env-file=.env.local scripts/fetch-coop-videos.mjs [최대 처리 개수, 기본 50]
// - 대상: max_players 2 이상 중 인기 상위 50개 (heat_rank 순, 없으면 current_players 순)
// - coop_videos_at이 30일 이내면 건너뜀 (YouTube 정책상 저장한 정보는 30일마다 갱신)
// - 검색어: 한국어 이름(search_name_ko, fill-search-names로 채움)을 먼저, 3개가 안 차면 영어 이름(™ ® © 뺀 것)으로 한 번 더
// - YouTube 사용량: 검색 1번당 약 101 (검색 100 + 영상 정보 1), 게임당 최대 2번. 하루 한도 10,000
// - 한도 초과면 그 게임은 기록하지 않고 바로 멈춤 → 다음 실행 때 그 게임부터 이어서
import { createClient } from '@supabase/supabase-js';
import { getCoopTargets } from './lib/coop-targets.mjs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const LIMIT = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a))) || 50;
const REFRESH_DAYS = 30;
const MAX_SAVE = 3;
const MIN_VIEWS = 1000;
const MIN_SEC = 3 * 60;
const MAX_SEC = 120 * 60;
const RECENT_YEARS = 5;
// 시험 실행용: --names="Lethal Company,Among Us" 로 특정 게임만 (30일 기준 무시)
const ONLY_NAMES = (process.argv.find((a) => a.startsWith('--names=')) || '').slice(8).split(',').map((s) => s.trim()).filter(Boolean);

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

const cleanName = (name) => String(name || '').replace(/[™®©]/g, '').replace(/\s+/g, ' ').trim();

// 검색어 하나로 찾아서 조건에 맞는 영상만
async function searchOnce(name) {
  const since = new Date(Date.now() - RECENT_YEARS * 365 * 24 * 3600 * 1000).toISOString();
  const search = await youtube('search', {
    part: 'id',
    q: `${name} 합방 | ${name} 멀티 | ${name} 같이`,
    type: 'video',
    regionCode: 'KR',
    relevanceLanguage: 'ko',
    publishedAfter: since,
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
    .filter((v) => /[가-힣]/.test(v.title) && v.view_count >= MIN_VIEWS && v.duration_sec >= MIN_SEC && v.duration_sec <= MAX_SEC);
}

// 한국어 이름으로 먼저, 3개가 안 차면 영어 이름으로 한 번 더 (게임당 최대 2번)
async function findCoopVideos(game) {
  const ko = cleanName(game.search_name_ko);
  const en = cleanName(game.name);
  const queries = [...new Set([ko, en].filter(Boolean))];
  const found = new Map();
  for (const q of queries) {
    for (const v of await searchOnce(q)) found.set(v.video_id, v);
    if (found.size >= MAX_SAVE) break;
  }
  return { queries, videos: [...found.values()].sort((a, b) => b.view_count - a.view_count).slice(0, MAX_SAVE) };
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

  let top;
  try {
    top = await getCoopTargets(supabase, 'search_name_ko, coop_videos_at');
  } catch (e) {
    return console.error(`❌ ${e.message}`);
  }
  const cutoff = Date.now() - REFRESH_DAYS * 24 * 3600 * 1000;
  const todo = ONLY_NAMES.length
    ? top.filter((g) => ONLY_NAMES.includes(g.name))
    : top.filter((g) => !g.coop_videos_at || new Date(g.coop_videos_at).getTime() < cutoff).slice(0, LIMIT);
  console.log(`인기 멀티 게임 ${top.length}개 중 갱신할 게임 ${todo.length}개 처리${ONLY_NAMES.length ? ' (이름 지정)' : ` (최대 ${LIMIT}개)`}\n`);

  let done = 0, saved = 0, failed = 0;
  const emptyNames = [];
  for (const g of todo) {
    let videos, queries;
    try {
      ({ videos, queries } = await findCoopVideos(g));
    } catch (e) {
      // 한도 초과는 "결과 없음"이 아니므로 coop_videos_at을 기록하지 않고 멈춤
      if (e instanceof QuotaError) {
        console.log(`⏳ YouTube 한도 초과로 중단, 다음 실행 때 이어서 — ${g.name}부터 (${e.message})`);
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
    if (!videos.length) emptyNames.push(g.name);
    const qText = queries.map((q) => `"${q}"`).join(' → ');
    console.log(videos.length ? `✅ ${g.name} (검색: ${qText})` : `➖ ${g.name}: 조건에 맞는 영상 없음 (검색: ${qText})`);
    for (const v of videos) {
      console.log(`   · ${v.title} — ${v.channel_title} (조회수 ${v.view_count.toLocaleString('ko-KR')}, ${Math.round(v.duration_sec / 60)}분)`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n완료 — 처리한 게임 ${done}개 · 저장한 영상 ${saved}개 · 결과 0개인 게임 ${emptyNames.length}개${failed ? ` · 오류 ${failed}개` : ''}`);
  if (emptyNames.length) console.log(`결과 0개: ${emptyNames.join(', ')}`);
}

main();
