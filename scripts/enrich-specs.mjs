// scripts/enrich-specs.mjs
// 스팀 상점 정보(사양·출시일·한국어·용량 등)로 정보가 빈 게임만 채우기 — 이미 있는 값은 덮어쓰지 않음
// 실행: node --env-file=.env.local scripts/enrich-specs.mjs
import { createClient } from '@supabase/supabase-js';
import { onlyIds } from './lib/only-ids.mjs';
import { steamGet, appdetailsUrl, SteamLimitError } from './lib/steam.mjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseMinSpecOnly(html) {
  if (!html) return null;
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<ul[^>]*>/gi, '')
    .replace(/<\/ul>/gi, '')
    .replace(/<li>/gi, '')
    .replace(/<\/li>/gi, '\n')
    .replace(/<strong>최소[:：]<\/strong>/gi, '')
    .replace(/<strong>Minimum[:：]<\/strong>/gi, '')
    .replace(/<strong>/gi, '')
    .replace(/<\/strong>/gi, '')
    .replace(/<[^>]+>/g, '')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.includes('64비트 프로세서'))
    .join(' / ')
    .trim() || null;
}

function isLowSpec(minSpec) {
  if (!minSpec) return false;
  const text = minSpec.toLowerCase();
  return (
    text.includes('gtx 750') || text.includes('gtx 960') ||
    text.includes('gtx 1050') || text.includes('rx 470') ||
    text.includes('intel hd') || text.includes('integrated') ||
    text.includes('4 gb ram') || text.includes('4gb ram')
  );
}

function parseKoreanSupport(languages, fullAudioLanguages) {
  if (!languages) return '한국어 없음';
  const stripped = languages.replace(/<[^>]+>/g, '');
  const hasKorean = stripped.includes('한국어') || stripped.toLowerCase().includes('korean');
  if (!hasKorean) return '한국어 없음';
  const audio = (fullAudioLanguages || '').replace(/<[^>]+>/g, '');
  const hasKoreanAudio = audio.includes('한국어') || audio.toLowerCase().includes('korean');
  if (hasKoreanAudio) return '자막+더빙';
  return '자막';
}

function parseFamilySharing(categories) {
  const ids = (categories || []).map((c) => c.id);
  return !ids.includes(62);
}

function parseStorage(html) {
  if (!html) return null;
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const storageMatch = text.match(/저장\s*공간[^0-9]*(\d+(?:\.\d+)?)\s*(GB|MB|TB)/i)
    || text.match(/storage[^0-9]*(\d+(?:\.\d+)?)\s*(GB|MB|TB)/i);
  if (!storageMatch) return null;
  const num = parseFloat(storageMatch[1]);
  const unit = storageMatch[2].toUpperCase();
  if (unit === 'TB') return num * 1024;
  if (unit === 'MB') return Math.round((num / 1024) * 10) / 10;
  return num;
}

// 한국어 상점의 "2020년 3월 5일" 형식. 못 읽으면 null
function parseKoreanDate(dateStr) {
  const m = dateStr?.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

async function getEnglishReleaseDate(appid) {
  try {
    const json = await steamGet(appdetailsUrl(appid, 'english'));
    const dateStr = json[appid]?.data?.release_date?.date;
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  } catch { return null; }
}

async function getReviewStats(appid) {
  try {
    const res = await fetch(
      `https://store.steampowered.com/appreviews/${appid}?json=1&filter=summary&language=all&purchase_type=all&review_type=all`
    );
    const json = await res.json();
    const qs = json.query_summary;
    if (!qs) return null;
    return {
      total: qs.total_reviews,
      positive: qs.total_positive,
      percent: qs.total_reviews > 0
        ? Math.round((qs.total_positive / qs.total_reviews) * 100)
        : 0,
    };
  } catch { return null; }
}

async function getAchievementCount(appid) {
  try {
    const res = await fetch(
      `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${process.env.STEAM_API_KEY}&appid=${appid}`
    );
    const json = await res.json();
    return json.game?.availableGameStats?.achievements?.length ?? null;
  } catch { return null; }
}

async function getLowestPrice(gameId) {
  try {
    const { data } = await supabase
      .from('price_history')
      .select('price, discount_percent, checked_at')
      .eq('game_id', gameId)
      .order('price', { ascending: true })
      .limit(1)
      .single();
    if (!data || !data.price) return null;
    if (data.price < 100) return null;
    return {
      price: data.price,
      date: data.checked_at?.slice(0, 10) ?? null,
    };
  } catch { return null; }
}

// 이 칸들이 비어 있으면 아직 스팀 정보를 못 채운 게임으로 본다
const EMPTY_FILTER = 'min_spec.is.null,release_date.is.null';
// 스팀 정보를 처음 채울 때만 정해지는 값 (추가할 때 기본값 false라서 빈 게임이면 스팀 값으로 바꾼다)
const STEAM_FLAGS = ['has_dlc', 'family_sharing', 'is_early_access', 'has_workshop', 'is_esports'];

async function main() {
  const { data: games, error: loadError } = await onlyIds(supabase
    .from('games')
    .select('id, name, steam_appid, tags, min_spec, recommended_spec, release_date, korean_support, storage_gb, achievement_count, min_players, max_players, solo_playable, review_positive_percent, review_total, lowest_price, lowest_price_date')
    .not('steam_appid', 'is', null)
    .or(EMPTY_FILTER));
  if (loadError) return console.error(`❌ 게임 목록을 못 불러옴: ${loadError.message}`);

  // 1인 게임 solo_playable 자동 수정 (루프 전에 한 번만)
  await onlyIds(supabase
    .from('games')
    .update({ solo_playable: true })
    .eq('min_players', 1)
    .eq('max_players', 1)
    .eq('solo_playable', false));
  console.log('✅ 1인 게임 solo_playable 자동 수정 완료');
  console.log(`정보가 빈 스팀 게임 ${games.length}개 (약 ${Math.ceil(games.length * 2.5 / 60)}분)\n`);

  let ok = 0;
  let noInfo = 0;
  let limited = 0;
  let failed = 0;

  for (const game of games) {
    let json;
    try {
      json = await steamGet(appdetailsUrl(game.steam_appid));
    } catch (e) {
      if (e instanceof SteamLimitError) {
        console.log(`⏳ 요청 제한: ${game.name} — ${e.message}`);
        limited++;
      } else {
        console.log(`❌ 실패: ${game.name} — ${e.message}`);
        failed++;
      }
      continue;
    }
    if (!json?.[game.steam_appid]?.success) {
      // HTTP 200인데 정보가 없음 (판매 중단·지역 제한 등)
      console.log(`➖ 스팀에 정보 없음: ${game.name} (${game.steam_appid})`);
      noInfo++;
      continue;
    }
    const data = json[game.steam_appid].data;
    const categoryIds = (data.categories || []).map((c) => c.id);

    // 멀티플레이어 여부 판단 (1 멀티, 9 협동, 20 MMO, 24 화면 공유, 27 크로스플랫폼, 36 온라인 대전, 37 화면 공유 대전,
    // 38 온라인 협동, 39 화면 공유 협동, 47 LAN 대전, 48 LAN 협동, 49 대전) — 하나라도 있으면 1인으로 확정하지 않음
    const isMultiplayer = categoryIds.some(id => [1, 9, 20, 24, 27, 36, 37, 38, 39, 47, 48, 49].includes(id));
    const isSinglePlayer = categoryIds.includes(2);

    let minPlayers = null;
    let maxPlayers = null;
    let soloPlayable = null;

    if (isSinglePlayer && !isMultiplayer) {
      minPlayers = 1;
      maxPlayers = 1;
      soloPlayable = true;
    } else if (isMultiplayer && isSinglePlayer) {
      minPlayers = 1;
      soloPlayable = true;
    } else if (isMultiplayer && !isSinglePlayer) {
      soloPlayable = false;
    }

    // 출시일은 한국어 응답에서 먼저 읽고, 못 읽을 때만 영어로 한 번 더 요청
    const releaseDate = parseKoreanDate(data.release_date?.date) ?? await getEnglishReleaseDate(game.steam_appid);
    const [reviews, achievements, lowestPriceData] = await Promise.all([
      getReviewStats(game.steam_appid),
      getAchievementCount(game.steam_appid),
      getLowestPrice(game.id),
    ]);

    const minSpec = parseMinSpecOnly(data.pc_requirements?.minimum);

    const currentTags = game.tags || [];
    const lowSpec = isLowSpec(minSpec);

    const found = {
      min_spec: minSpec,
      recommended_spec: parseMinSpecOnly(data.pc_requirements?.recommended),
      release_date: releaseDate,
      korean_support: parseKoreanSupport(data.supported_languages, data.full_audio_languages),
      storage_gb: parseStorage(data.pc_requirements?.minimum),
      achievement_count: achievements,
      min_players: minPlayers,
      max_players: maxPlayers,
      solo_playable: soloPlayable,
      review_positive_percent: reviews?.percent ?? null,
      review_total: reviews?.total ?? null,
      lowest_price: lowestPriceData?.price ?? null,
      lowest_price_date: lowestPriceData?.date ?? null,
    };
    // 빈 칸만 채운다 (다른 스크립트나 직접 넣은 값은 그대로)
    const update = Object.fromEntries(
      Object.entries(found).filter(([k, v]) => v !== null && v !== undefined && game[k] == null)
    );
    Object.assign(update, {
      has_dlc: (data.dlc?.length ?? 0) > 0,
      family_sharing: parseFamilySharing(data.categories),
      is_early_access: data.genres?.some((g) => g.id === '70') ?? false,
      has_workshop: categoryIds.includes(30),
      is_esports: categoryIds.includes(24),
    });
    if (lowSpec && !currentTags.includes('저사양')) update.tags = [...currentTags, '저사양'];

    const { error } = await supabase.from('games').update(update).eq('id', game.id);

    if (error) {
      console.log(`❌ 저장 실패 (${game.name}): ${error.message}`);
      failed++;
    } else {
      ok++;
      console.log(
        `✅ ${game.name}: 출시일 ${releaseDate ?? 'null'} | 한국어 ${found.korean_support} | 용량 ${found.storage_gb ?? '?'}GB | 솔로 ${soloPlayable} | 채운 칸 ${Object.keys(update).filter((k) => !STEAM_FLAGS.includes(k)).length}개`
      );
    }
  }

  console.log(`\n완료 — 성공 ${ok}개 · 스팀에 정보 없음 ${noInfo}개 · 요청 제한 ${limited}개 · 기타 실패 ${failed}개`);
}

main();
