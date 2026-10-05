// scripts/fetch-highlight-videos.mjs
// 게임 고를 때 보기 좋은 짧은 하이라이트·매드무비·쇼츠 영상을 YouTube에서 찾아 game_videos(kind='highlight')에 저장
// 실행: node --env-file=.env.local scripts/fetch-highlight-videos.mjs [--force] [--names="Lethal Company,Among Us"]
// - 매일 17:10 KST(.github/workflows/highlight.yml)에 실행. YouTube 한도는 태평양 시간 자정(KST 16시, 서머타임 끝나면 17시)에 초기화
// - 대상: heat_rank 있는 게임을 heat_rank 순으로. highlight_videos_at이 30일 이내면 건너뜀 (YouTube 정책상 30일마다 갱신)
// - 검색어: "<이름> 매드무비 | <이름> 하이라이트 | <이름> 웃긴 장면 | <이름> shorts" (한국어 이름이 있으면 영어 이름과 함께)
//   videoDuration=short 먼저, 3개가 안 차면 medium으로 한 번 더. order=viewCount, regionCode=KR, relevanceLanguage=ko
// - videos.list로 임베드 가능·조회수·길이 확인. 임베드 불가·게임 이름 없는 영상·트레일러 등·게임별 제외어(video_exclude_terms) 제외
// - 제목·채널에 movie·film·영화가 있으면 제외, 이름이 일반 단어인 게임(Muck 등)은 game·게임·스팀 등도 있어야 함 (lib/video-filter.mjs)
// - 게임당 최대 3개 (짧은 영상 우선, 그다음 조회수 순). 기존 합방 영상(kind='coop')은 건드리지 않음
// - YouTube 사용량: 검색 1번당 101 (검색 100 + 영상 정보 1), 게임당 최대 202
// - 하루 사용 상한 (새벽·주간 작업 몫을 먼저 남김):
//     트레일러 몫 = min(영상 못 찾은 게임 수, 90) × 100 (새벽 3시 enrich-videos 90)
//     스트리머 영상 몫 = 200 (새벽 3시 fetch-streamer-videos, lib/streamer-videos.mjs)
//     평소: max(5,000, 10,000 − 여유 500 − 트레일러 몫 − 스트리머 몫) → 트레일러 대기분이 줄면 남는 한도가 자동으로 하이라이트에 더해짐
//     목요일(태평양 시간, 금요일 새벽 주간 작업과 같은 한도일): 10,000 − 여유 500 − 트레일러 몫 − 스트리머 몫 − 합방 몫(갱신할 게임 × 202), 최소 보장 없음
// - 한도일 중 새벽 작업이 이미 돌았을 수 있는 시각(태평양 시간 10시 이후)이면 남은 한도를 알 수 없어 건너뜀 (--force로 무시)
// - 한도 초과면 그 게임은 기록하지 않고 조용히 멈춤 → 다음 실행 때 그 게임부터 이어서
import { createClient } from '@supabase/supabase-js';
import { getCoopTargets, gameNameKeys, searchKeyword, searchExcludeSuffix, excludeTerms, EXCLUDE_TITLE_WORDS, DESC_HEAD } from './lib/coop-targets.mjs';
import { videoRejectReason, isGenericName } from './lib/video-filter.mjs';
import { STREAMER_UNITS_PER_DAY } from './lib/streamer-videos.mjs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const FORCE = process.argv.includes('--force');
const ONLY_NAMES = (process.argv.find((a) => a.startsWith('--names=')) || '').slice(8).split(',').map((s) => s.trim()).filter(Boolean);

const DAILY_QUOTA = 10000;
const SAFETY = 500;
const HIGHLIGHT_BASE = 5000;
const TRAILER_PER_DAY = 90; // run-steps.mjs daily의 'enrich-videos 90'과 맞춤
const TRAILER_UNIT = 100;
const COOP_UNIT_PER_GAME = 202;
const SEARCH_UNIT = 101;
const REFRESH_DAYS = 30;
const MAX_SAVE = 3;
const MIN_VIEWS = 1000;

class QuotaError extends Error {}

let used = 0;
async function youtube(path, params, units) {
  const qs = new URLSearchParams({ ...params, key: YOUTUBE_API_KEY });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${qs}`);
  used += units; // 실패한 요청도 한도에서 빠짐
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
const norm = (s) => String(s || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');

// 태평양 시간 기준 시각·요일 (YouTube 한도일 기준)
function pacificNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hour: 'numeric', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { hour: Number(parts.hour), weekday: parts.weekday };
}

async function computeBudget() {
  const { count: pendingTrailers, error } = await supabase.from('games').select('id', { count: 'exact', head: true }).eq('hidden', false).is('video_url', null);
  if (error) throw new Error(`트레일러 대기 수를 못 불러옴: ${error.message}`);
  const trailer = Math.min(pendingTrailers ?? 0, TRAILER_PER_DAY) * TRAILER_UNIT;
  const { weekday } = pacificNow();
  if (weekday === 'Thu') {
    const cutoff = Date.now() - REFRESH_DAYS * 24 * 3600 * 1000;
    const targets = await getCoopTargets(supabase, 'coop_videos_at');
    const coopDue = targets.filter((g) => !g.coop_videos_at || new Date(g.coop_videos_at).getTime() < cutoff).length;
    const coop = coopDue * COOP_UNIT_PER_GAME;
    return { cap: Math.max(0, DAILY_QUOTA - SAFETY - trailer - STREAMER_UNITS_PER_DAY - coop), note: `목요일 — 트레일러 몫 ${trailer} · 스트리머 몫 ${STREAMER_UNITS_PER_DAY} · 주간 합방 몫 ${coop} (${coopDue}개) 먼저 남김` };
  }
  return { cap: Math.max(HIGHLIGHT_BASE, DAILY_QUOTA - SAFETY - trailer - STREAMER_UNITS_PER_DAY), note: `트레일러 몫 ${trailer} (대기 ${pendingTrailers ?? 0}개) · 스트리머 몫 ${STREAMER_UNITS_PER_DAY}` };
}

// 영상에 이 게임 이름이 있는지 (제목 또는 설명 앞부분)
function mentions(video, game) {
  const t = norm(`${video.title} ${video.description.slice(0, DESC_HEAD)}`);
  return gameNameKeys(game).some((k) => t.includes(k));
}

function excluded(video, game) {
  const title = video.title;
  if (EXCLUDE_TITLE_WORDS.test(title)) return true;
  if (videoRejectReason(video, gameNameKeys(game), { requireGameWord: isGenericName(game) })) return true;
  const t = norm(title);
  return excludeTerms(game).some((w) => norm(w) && t.includes(norm(w)));
}

async function searchOnce(game, duration, skipIds) {
  const ko = searchKeyword(game);
  const en = cleanName(game.name);
  const names = [...new Set([ko, en].filter(Boolean))];
  const search = await youtube('search', {
    part: 'id',
    q: `${names.flatMap((n) => [`${n} 매드무비`, `${n} 하이라이트`, `${n} 웃긴 장면`, `${n} shorts`]).join(' | ')} ${searchExcludeSuffix(game)}`,
    type: 'video',
    videoDuration: duration,
    videoEmbeddable: 'true',
    order: 'viewCount',
    regionCode: 'KR',
    relevanceLanguage: 'ko',
    maxResults: '15',
  }, 100);
  const ids = (search.items || []).map((it) => it.id?.videoId).filter((id) => id && !skipIds.has(id));
  if (!ids.length) return [];
  const details = await youtube('videos', { part: 'snippet,statistics,contentDetails,status', id: ids.join(',') }, 1);
  return (details.items || [])
    .filter((v) => v.status?.embeddable === true)
    .map((v) => ({
      video_id: v.id,
      title: v.snippet?.title || '',
      description: v.snippet?.description || '',
      channel_id: v.snippet?.channelId || null,
      channel_title: v.snippet?.channelTitle || null,
      published_at: v.snippet?.publishedAt || null,
      view_count: Number(v.statistics?.viewCount || 0),
      duration_sec: parseDuration(v.contentDetails?.duration),
    }))
    .filter((v) => v.view_count >= MIN_VIEWS && /[가-힣]/.test(`${v.title} ${v.description.slice(0, DESC_HEAD)}`))
    .filter((v) => !excluded(v, game) && mentions(v, game))
    .sort((a, b) => b.view_count - a.view_count);
}

// short 먼저, 3개가 안 차면 medium으로 한 번 더. 같은 게임의 합방 영상과 겹치는 것은 뺌
async function findHighlights(game, coopIds, remaining) {
  const picked = [];
  const seen = new Set(coopIds);
  for (const duration of ['short', 'medium']) {
    if (picked.length >= MAX_SAVE) break;
    if (duration === 'medium' && remaining() < SEARCH_UNIT) break;
    for (const v of await searchOnce(game, duration, seen)) {
      if (picked.length >= MAX_SAVE) break;
      if (seen.has(v.video_id)) continue;
      seen.add(v.video_id);
      picked.push(v);
    }
  }
  return picked.map(({ description, ...v }) => v);
}

// 새 결과를 먼저 넣고, 성공하면 그 게임의 예전 highlight 기록만 지움 (coop은 그대로)
async function saveVideos(gameId, videos) {
  let newIds = [];
  if (videos.length) {
    const { data, error } = await supabase
      .from('game_videos')
      .insert(videos.map((v) => ({ ...v, game_id: gameId, kind: 'highlight' })))
      .select('id');
    if (error) throw new Error(`영상 저장 실패: ${error.message}`);
    newIds = data.map((r) => r.id);
  }
  let del = supabase.from('game_videos').delete().eq('game_id', gameId).eq('kind', 'highlight');
  if (newIds.length) del = del.not('id', 'in', `(${newIds.join(',')})`);
  const { error: delError } = await del;
  if (delError) throw new Error(`예전 영상 정리 실패: ${delError.message}`);
  const { error: markError } = await supabase.from('games').update({ highlight_videos_at: new Date().toISOString() }).eq('id', gameId);
  if (markError) throw new Error(`확인 날짜 저장 실패: ${markError.message}`);
}

async function main() {
  if (!YOUTUBE_API_KEY) return console.error('.env.local에 YOUTUBE_API_KEY가 없어요');

  const { hour } = pacificNow();
  if (hour >= 10 && !FORCE) {
    return console.log(`⏭️ 태평양 시간 ${hour}시 — 이번 한도일의 새벽 작업이 이미 돌았을 수 있어 건너뜀 (KST 16~17시 이후에 실행, 무시하려면 --force)`);
  }

  let budget, games;
  try {
    budget = await computeBudget();
    const { data, error } = await supabase
      .from('games')
      .select('id, name, heat_rank, search_name_ko, video_exclude_terms, highlight_videos_at').eq('hidden', false)
      .not('heat_rank', 'is', null)
      .order('heat_rank', { ascending: true });
    if (error) throw new Error(`게임 목록을 못 불러옴: ${error.message}`);
    games = data;
  } catch (e) {
    return console.error(`❌ ${e.message}`);
  }

  const cutoff = Date.now() - REFRESH_DAYS * 24 * 3600 * 1000;
  const todo = ONLY_NAMES.length
    ? games.filter((g) => ONLY_NAMES.includes(g.name))
    : games.filter((g) => !g.highlight_videos_at || new Date(g.highlight_videos_at).getTime() < cutoff);
  console.log(`heat_rank 게임 ${games.length}개 중 갱신할 게임 ${todo.length}개 · 오늘 상한 ${budget.cap} 유닛 (${budget.note})\n`);

  const remaining = () => budget.cap - used;
  let done = 0, saved = 0, failed = 0;
  const emptyNames = [];
  let stopReason = todo.length ? '' : '갱신할 게임 없음';
  for (const g of todo) {
    if (remaining() < SEARCH_UNIT) { stopReason = `상한 도달, 다음 실행 때 ${g.name}부터 이어서`; break; }
    let videos;
    try {
      const { data: coop } = await supabase.from('game_videos').select('video_id').eq('game_id', g.id).eq('kind', 'coop');
      videos = await findHighlights(g, (coop || []).map((r) => r.video_id), remaining);
    } catch (e) {
      // 한도 초과는 "결과 없음"이 아니므로 highlight_videos_at을 기록하지 않고 멈춤
      if (e instanceof QuotaError) { stopReason = `YouTube 한도 초과, 다음 실행 때 ${g.name}부터 이어서`; break; }
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
    console.log(videos.length ? `✅ #${g.heat_rank} ${g.name}` : `➖ #${g.heat_rank} ${g.name}: 조건에 맞는 영상 없음`);
    for (const v of videos) {
      console.log(`   · ${v.title} — ${v.channel_title} (조회수 ${v.view_count.toLocaleString('ko-KR')}, ${Math.round(v.duration_sec / 60 * 10) / 10}분)`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  if (stopReason) console.log(`\n⏳ ${stopReason}`);
  console.log(`\n완료 — 처리한 게임 ${done}개 · 저장한 영상 ${saved}개 · 결과 0개 ${emptyNames.length}개${failed ? ` · 오류 ${failed}개` : ''} · YouTube 약 ${used} 유닛 사용 (상한 ${budget.cap})`);
  if (emptyNames.length) console.log(`0개: ${emptyNames.join(', ')}`);
}

main();
