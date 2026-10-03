// scripts/fetch-coop-videos.mjs
// 멀티 게임의 "친구랑 하는 영상"(한국어 합방·멀티 영상)을 YouTube에서 찾아 game_videos(kind='coop')에 저장
// 실행: node --env-file=.env.local scripts/fetch-coop-videos.mjs [최대 처리 개수, 기본 50]
// - 대상: max_players 2 이상 중 인기 상위 50개 (heat_rank 순, 없으면 current_players 순)
// - coop_videos_at이 30일 이내면 건너뜀 (YouTube 정책상 저장한 정보는 30일마다 갱신)
// - 검색어: 한국어 이름(search_name_ko, fill-search-names로 채움)을 먼저, 3개가 안 차면 영어 이름(™ ® © 뺀 것)으로 한 번 더
//   search_name_ko는 쉼표로 여러 개 가능 → 영상 검색에는 첫 번째 이름만 씀 (두 글자 이하면 "게임"을 붙임)
// - 1차 규칙(확실한 것만 제외): 제목에 "TOP 숫자"·"추천 TOP"·트레일러·같이보기·뉴스·패치
// - 2차 Haiku: 남은 후보(조회수 순 최대 15개)의 제목+설명 앞부분을 게임당 한 번에 보내 "여러 명이 같이 플레이하는 영상"만 고름 (게임당 약 $0.003)
// - 고른 것 중 조회수 순 최대 3개. 없으면 0개
// - YouTube 사용량: 검색 1번당 약 101 (검색 100 + 영상 정보 1), 게임당 최대 2번. 하루 한도 10,000
// - 한도 초과면 그 게임은 기록하지 않고 바로 멈춤 → 다음 실행 때 그 게임부터 이어서
import { createClient } from '@supabase/supabase-js';
import { getCoopTargets, isCoopVideoFor, searchKeyword } from './lib/coop-targets.mjs';
import { judgeCoopVideos, haikuCost, JUDGE_MAX } from './lib/coop-judge.mjs';

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

// 이름 하나로 검색해서 1차 규칙에 맞는 영상만
// noCoop: 다른 조건은 맞는데 1차 규칙(게임 이름·협동 단어·제외 단어)에서 빠진 영상 수
async function searchOnce(names, game) {
  const since = new Date(Date.now() - RECENT_YEARS * 365 * 24 * 3600 * 1000).toISOString();
  const search = await youtube('search', {
    part: 'id',
    q: names.flatMap((n) => [`${n} 합방`, `${n} 멀티`, `${n} 같이`]).join(' | '),
    type: 'video',
    regionCode: 'KR',
    relevanceLanguage: 'ko',
    publishedAfter: since,
    maxResults: '15',
  });
  const ids = (search.items || []).map((it) => it.id?.videoId).filter(Boolean);
  if (!ids.length) return { videos: [], noCoop: 0 };
  const details = await youtube('videos', { part: 'snippet,statistics,contentDetails', id: ids.join(',') });
  const passed = (details.items || [])
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
    .filter((v) => /[가-힣]/.test(v.title) && v.view_count >= MIN_VIEWS && v.duration_sec >= MIN_SEC && v.duration_sec <= MAX_SEC);
  const videos = passed
    .filter((v) => isCoopVideoFor(v)); // 설명은 Haiku 판단에만 쓰고, 저장할 때 뺌
  return { videos, noCoop: passed.length - videos.length };
}

// 한국어 이름으로 먼저, 후보가 부족하면 영어 이름으로 한 번 더 (게임당 최대 2번) → Haiku가 최종 판단
async function findCoopVideos(game) {
  const ko = searchKeyword(game);
  const en = cleanName(game.name);
  const groups = [ko ? [ko] : [], ko === en ? [] : [en]].filter((g) => g.length);
  const found = new Map();
  let noCoop = 0;
  for (const names of groups) {
    const r = await searchOnce(names, game);
    noCoop += r.noCoop;
    for (const v of r.videos) found.set(v.video_id, v);
    if (found.size >= MAX_SAVE * 2) break; // Haiku가 걸러낼 여유를 두고 6개 이상이면 그만
  }
  const candidates = [...found.values()].sort((a, b) => b.view_count - a.view_count).slice(0, JUDGE_MAX);
  const { keep, usage } = candidates.length && process.env.ANTHROPIC_API_KEY
    ? await judgeCoopVideos(game, candidates)
    : { keep: [], usage: null };
  if (candidates.length && !process.env.ANTHROPIC_API_KEY) throw new Error('.env.local에 ANTHROPIC_API_KEY가 없어서 Haiku 판단을 못 함');
  return {
    queries: groups.map((g) => g.join(', ')),
    noCoop,
    candidates: candidates.length,
    rejected: candidates.filter((c) => !keep.includes(c)),
    cost: haikuCost(usage),
    videos: keep.sort((a, b) => b.view_count - a.view_count).slice(0, MAX_SAVE).map(({ description, ...v }) => v),
  };
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
  const noCoopNames = [];
  let totalCost = 0;
  for (const g of todo) {
    let videos, queries, noCoop, candidates, rejected, cost;
    try {
      ({ videos, queries, noCoop, candidates, rejected, cost } = await findCoopVideos(g));
      totalCost += cost;
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
    if (!videos.length) (noCoop > 0 || candidates > 0 ? noCoopNames : emptyNames).push(g.name);
    const qText = queries.map((q) => `"${q}"`).join(' → ');
    console.log(videos.length
      ? `✅ ${g.name} (검색: ${qText})`
      : `➖ ${g.name}: ${candidates ? `Haiku가 후보 ${candidates}개 모두 제외` : noCoop ? `규칙에 맞는 영상 없음 (빠진 영상 ${noCoop}개)` : '조건에 맞는 영상 없음'} (검색: ${qText})`);
    for (const r of rejected) console.log(`   ✕ ${r.title}`);
    for (const v of videos) {
      console.log(`   · ${v.title} — ${v.channel_title} (조회수 ${v.view_count.toLocaleString('ko-KR')}, ${Math.round(v.duration_sec / 60)}분)`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n완료 — 처리한 게임 ${done}개 · 저장한 영상 ${saved}개 · 결과 0개인 게임 ${emptyNames.length + noCoopNames.length}개${failed ? ` · 오류 ${failed}개` : ''} · Haiku 약 $${totalCost.toFixed(4)}`);
  if (noCoopNames.length) console.log(`규칙·Haiku 판단 때문에 0개: ${noCoopNames.join(', ')}`);
  if (emptyNames.length) console.log(`검색 결과 자체가 없어서 0개: ${emptyNames.join(', ')}`);
}

main();
