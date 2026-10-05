// scripts/fetch-streamer-videos.mjs
// 스트리머 공식 채널(streamer_channels)의 새 영상을 받아 게임과 연결해 streamer_videos에 저장 (스트리머 PICK)
// 실행: node --env-file=.env.local scripts/fetch-streamer-videos.mjs              (미리보기 — 연결 결과만 출력, DB는 안 건드림)
//       node --env-file=.env.local scripts/fetch-streamer-videos.mjs --apply      (실제 저장, 매일 단계)
//       --cap=N  이번 실행의 YouTube 상한을 바꿈 (기본 200, 수동 백필용)
// - supabase/migrations/20261014090000_streamer_videos.sql을 먼저 실행해야 함 (표가 없으면 미리보기는 data/streamers/channels.json으로, --apply는 건너뜀)
// - --apply: channels.json에 있는데 표에 없는 채널만 추가 (이미 있는 행·켜기/끄기는 그대로)
// - 켜진 채널만, 오래 확인 안 한 채널부터. 업로드 목록(playlistItems, 50개당 1유닛)에서 uploads_checked_at 이후 영상만
//   처음(uploads_checked_at 없음)은 최근 60일치 백필. 생방송 중·예정 영상은 건너뛰고 다음에 다시 봄
// - videos.list(50개당 1유닛)로 조회수·길이. 60초 이하는 쇼츠
// - 게임 연결 (app/lib/gameMatch.mjs, 영어 이름·한국어 이름·별칭):
//   제목 + 설명 앞부분(200자). 쇼츠는 제목만
//   이름이 일반 단어인 게임(Muck·Inside 등, lib/video-filter.mjs)은 제목에 "게임"·game·스팀 등이나 영문 원제+한국어 이름이 같이 있을 때만
//   이름 바로 뒤가 "같은·감성·후속작"이나 한 자리 숫자(속편)면 그 게임으로 보지 않음
//   여러 게임이 걸리면 가장 긴 이름 하나 (길이가 같으면 제목 쪽, 먼저 나온 쪽)
// - 연결 안 된 영상은 저장하지 않고 개수만 기록. 이미 저장된 영상은 건드리지 않음
// - YouTube 하루 상한 200유닛 (lib/streamer-videos.mjs, 하이라이트 작업이 이 몫을 빼 두고 씀). 상한에 닿으면 그 채널은 확인 시각을 안 바꾸고 멈춤 → 다음 실행 때 이어서
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { buildMatchers, findGameHits, normalize } from '../app/lib/gameMatch.mjs';
import { GAME_WORDS, isGenericName } from './lib/video-filter.mjs';
import { DESC_HEAD, gameNameKeys } from './lib/coop-targets.mjs';
import { STREAMER_UNITS_PER_DAY, recordStreamerVideos } from './lib/streamer-videos.mjs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const APPLY = process.argv.includes('--apply');
const CAP = Number((process.argv.find((a) => a.startsWith('--cap=')) || '').slice(6)) || STREAMER_UNITS_PER_DAY;
const BACKFILL_DAYS = 60;
const SHORT_MAX_SEC = 60;
const PAGE = 1000;

class QuotaError extends Error {}
class CapError extends Error {}

let used = 0;
async function youtube(path, params, units) {
  if (used + units > CAP) throw new CapError(`상한 ${CAP}유닛 도달`);
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

const norm = (s) => String(s || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');

async function readAll(table, cols, filter = (q) => q) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await filter(supabase.from(table).select(cols)).order('id').range(from, from + PAGE - 1);
    if (error) throw new Error(`${table} 조회 실패: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

// 표에 있는 채널 (표가 없으면 null)
async function loadChannels() {
  const seed = JSON.parse(fs.readFileSync('data/streamers/channels.json', 'utf8')).channels;
  const { data, error } = await supabase.from('streamer_channels').select('channel_id, streamer_name, channel_title, handle, kind, enabled, uploads_checked_at');
  if (error) return { channels: null, seed, error };
  let rows = data;
  const missing = seed.filter((c) => !rows.some((r) => r.channel_id === c.channel_id));
  if (missing.length) {
    if (APPLY) {
      const { error: insError } = await supabase.from('streamer_channels').upsert(missing, { onConflict: 'channel_id', ignoreDuplicates: true });
      if (insError) throw new Error(`채널 추가 실패: ${insError.message}`);
      console.log(`channels.json의 새 채널 ${missing.length}개를 표에 추가`);
    } else {
      console.log(`channels.json에만 있는 채널 ${missing.length}개 (--apply 때 표에 추가) — 이번 미리보기에는 포함`);
    }
    rows = [...rows, ...missing.map((c) => ({ ...c, enabled: true, uploads_checked_at: null }))];
  }
  return { channels: rows, seed };
}

// 일반 단어 이름 게임: 제목에 게임 단어(이름 부분 빼고) 또는 영문 원제 + 한국어 이름이 같이 있어야 함
function genericOk(game, title) {
  const keys = gameNameKeys(game);
  let rest = norm(title);
  for (const k of keys) rest = rest.split(k).join(' ');
  if (GAME_WORDS.test(rest)) return true;
  const t = norm(title);
  const en = norm(String(game.name || '').replace(/[™®©]/g, ''));
  const ko = keys.filter((k) => /[가-힣]/.test(k));
  return t.includes(en) && ko.some((k) => t.includes(k));
}

// 이름 바로 뒤가 비교·후속작 표현("피코파크 같은", "스타듀밸리 감성", "오공 후속작")이거나
// 따로 떨어진 한 자리 숫자("그레이브야드 키퍼 2", "keeper2는")면 그 게임 영상이 아님
// "빅워크 3원정대"·"롤 1대1"·"문명6 3화"·"세피리아 2026-08-26"·"스테퍼 레트로 #1"은 그대로 연결
const COMPARE_AFTER = /^(?:같은|처럼|감성|느낌|스러운|후속|짝퉁|아류)/;
const SEQUEL_AFTER = /^ ?\d(?=$| |[은는이가을를의도와과로에](?:$| ))/;

// → { hits: 쓸 수 있는 매칭, notIds: 이 글에서 "그 게임이 아니"라고 드러난 게임 }
function hitsIn(raw, where, matchers) {
  const text = raw.replace(/#(?=\s?\d)/g, 'ep '); // "#1"은 회차 번호 → 속편 숫자로 안 봄
  const spaced = normalize(text);
  const keyText = spaced.replace(/ /g, '');
  const keyToSpaced = [];
  for (let i = 0; i < spaced.length; i++) if (spaced[i] !== ' ') keyToSpaced.push(i);
  const hits = [];
  const notIds = new Set();
  for (const h of findGameHits(text, matchers)) {
    const end = h.start + h.len;
    if (COMPARE_AFTER.test(keyText.slice(end)) || SEQUEL_AFTER.test(spaced.slice(keyToSpaced[end - 1] + 1))) notIds.add(h.id);
    else hits.push({ ...h, where });
  }
  return { hits, notIds };
}

function matchVideo(v, matchers, gamesById) {
  const title = hitsIn(v.title, 'title', matchers);
  const desc = v.is_short ? { hits: [] } : hitsIn(v.description.slice(0, DESC_HEAD), 'description', matchers);
  // 제목에서 "그 게임이 아니"라고 드러난 게임은 설명(해시태그 등)에서도 연결하지 않음
  const hits = [...title.hits, ...desc.hits.filter((h) => !title.notIds.has(h.id))].filter((h) => {
    const g = gamesById.get(h.id);
    return !isGenericName(g) || (h.where === 'title' && genericOk(g, v.title));
  });
  if (!hits.length) return null;
  hits.sort((a, b) => b.len - a.len || (a.where === 'title' ? 0 : 1) - (b.where === 'title' ? 0 : 1) || a.start - b.start);
  return hits[0];
}

// 한 채널의 새 영상 → { checked, linked: 저장할 행[], unlinked, cursor }
async function scanChannel(ch, matchers, gamesById) {
  const startedAt = new Date();
  const since = ch.uploads_checked_at ? Date.parse(ch.uploads_checked_at) : startedAt.getTime() - BACKFILL_DAYS * 24 * 3600 * 1000;
  const playlistId = `UU${ch.channel_id.slice(2)}`;

  // 업로드 목록은 최신순 → since보다 오래된 영상이 나오면 멈춤
  const ids = [];
  let token;
  for (;;) {
    const page = await youtube('playlistItems', { part: 'contentDetails', playlistId, maxResults: '50', ...(token ? { pageToken: token } : {}) }, 1);
    let reachedOld = false;
    for (const it of page.items || []) {
      const at = Date.parse(it.contentDetails?.videoPublishedAt || '');
      if (!at) continue; // 비공개·삭제 영상
      if (at <= since) { reachedOld = true; continue; }
      ids.push(it.contentDetails.videoId);
    }
    token = page.nextPageToken;
    if (reachedOld || !token) break;
  }

  const linked = [];
  let unlinked = 0;
  let cursor = startedAt;
  for (let i = 0; i < ids.length; i += 50) {
    const res = await youtube('videos', { part: 'snippet,statistics,contentDetails', id: ids.slice(i, i + 50).join(',') }, 1);
    for (const item of res.items || []) {
      const published = new Date(item.snippet?.publishedAt);
      // 생방송 중·예정: 끝난 뒤 다시 보도록 확인 시각을 그 영상 앞으로 둠
      if (['live', 'upcoming'].includes(item.snippet?.liveBroadcastContent)) {
        if (item.snippet.liveBroadcastContent === 'live' && published < cursor) cursor = new Date(published.getTime() - 1000);
        continue;
      }
      const duration = parseDuration(item.contentDetails?.duration);
      const v = {
        video_id: item.id,
        title: item.snippet?.title || '',
        description: item.snippet?.description || '',
        published_at: published.toISOString(),
        view_count: Number(item.statistics?.viewCount || 0),
        is_short: duration > 0 && duration <= SHORT_MAX_SEC,
      };
      const hit = matchVideo(v, matchers, gamesById);
      if (!hit) { unlinked++; continue; }
      const { description, ...row } = v;
      linked.push({ ...row, channel_id: ch.channel_id, game_id: hit.id, match_method: hit.where });
    }
  }
  return { checked: ids.length, linked, unlinked, cursor };
}

async function main() {
  if (!YOUTUBE_API_KEY) return console.error('.env.local에 YOUTUBE_API_KEY가 없어요');

  let { channels, seed, error } = await loadChannels();
  if (!channels) {
    if (APPLY) return console.log(`⏭️ streamer_channels 표가 없어 건너뜀 (${error.message}) — supabase/migrations/20261014090000_streamer_videos.sql 먼저 실행`);
    console.log('streamer_channels 표가 아직 없어 data/streamers/channels.json으로 미리보기 (처음 실행 = 60일 백필)');
    channels = seed.map((c) => ({ ...c, enabled: true, uploads_checked_at: null }));
  }
  const todo = channels
    .filter((c) => c.enabled)
    .sort((a, b) => (a.uploads_checked_at ? Date.parse(a.uploads_checked_at) : 0) - (b.uploads_checked_at ? Date.parse(b.uploads_checked_at) : 0));

  let games = await readAll('games', 'id, name, search_name_ko', (q) => q.eq('hidden', false)).catch(() => null);
  if (!games) games = await readAll('games', 'id, name, search_name_ko'); // hidden 칸이 아직 없을 때
  const gamesById = new Map(games.map((g) => [g.id, g]));
  const matchers = buildMatchers(games);
  console.log(`${APPLY ? '저장' : '미리보기'} · 켜진 채널 ${todo.length}개 · 게임 ${games.length}개 · 상한 ${CAP}유닛\n`);

  const perGame = new Map();
  const samples = [];
  let totalLinked = 0, totalUnlinked = 0, totalChecked = 0, done = 0, stopReason = '';
  for (const ch of todo) {
    let r;
    try {
      r = await scanChannel(ch, matchers, gamesById);
    } catch (e) {
      if (e instanceof CapError || e instanceof QuotaError) { stopReason = `${e instanceof CapError ? e.message : 'YouTube 한도 초과'}, 다음 실행 때 ${ch.channel_title}부터 이어서`; break; }
      console.log(`❌ ${ch.streamer_name} · ${ch.channel_title}: ${e.message}`);
      continue;
    }
    if (APPLY) {
      if (r.linked.length) {
        const { error: insError } = await supabase.from('streamer_videos').upsert(r.linked, { onConflict: 'video_id', ignoreDuplicates: true });
        if (insError) { console.log(`❌ ${ch.channel_title} 영상 저장 실패: ${insError.message}`); continue; }
      }
      const { error: markError } = await supabase.from('streamer_channels').update({ uploads_checked_at: r.cursor.toISOString() }).eq('channel_id', ch.channel_id);
      if (markError) console.log(`⚠️ ${ch.channel_title} 확인 시각 저장 실패: ${markError.message}`);
    }
    done++;
    totalChecked += r.checked; totalLinked += r.linked.length; totalUnlinked += r.unlinked;
    for (const v of r.linked) {
      perGame.set(v.game_id, (perGame.get(v.game_id) || 0) + 1);
      samples.push({ streamer: ch.streamer_name, channel: ch.channel_title, game: gamesById.get(v.game_id)?.name, how: v.match_method, short: v.is_short, title: v.title });
    }
    console.log(`${ch.streamer_name} · ${ch.channel_title} (${ch.kind}) — 새 영상 ${r.checked}개 · 연결 ${r.linked.length}개 · 연결 안 됨 ${r.unlinked}개`);
  }

  console.log('\n연결된 게임 상위 10개');
  [...perGame].sort((a, b) => b[1] - a[1]).slice(0, 10)
    .forEach(([id, n], i) => console.log(`${i + 1}. ${gamesById.get(id)?.name} — ${n}개`));
  if (!APPLY) {
    console.log('\n연결 결과 (스트리머 | 채널 | 게임 | 찾은 곳 | 영상 제목)');
    for (const s of samples) console.log(`${s.streamer} | ${s.channel} | ${s.game} | ${s.how}${s.short ? ' · 쇼츠' : ''} | ${s.title}`);
  }
  console.log(`\n완료 — 채널 ${done}/${todo.length}개 · 새 영상 ${totalChecked}개 · 연결 ${totalLinked}개 · 연결 안 됨 ${totalUnlinked}개 · YouTube ${used}유닛 사용 (상한 ${CAP})${stopReason ? ` · ${stopReason}` : ''}`);
  if (APPLY) recordStreamerVideos({ linked: totalLinked, unlinked: totalUnlinked, units: used });
}

main();
