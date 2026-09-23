import { createClient } from '@supabase/supabase-js';

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

function parseStorage(requirements) {
  if (!requirements) return null;
  const text = requirements.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
  const match = text.match(/(\d+(?:\.\d+)?)\s*(GB|MB)/i);
  if (!match) return null;
  const num = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  return unit === 'GB' ? num : Math.round((num / 1024) * 10) / 10;
}

async function getEnglishReleaseDate(appid) {
  try {
    const res = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=kr&l=english`
    );
    const json = await res.json();
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

async function main() {
  const { data: games } = await supabase.from('games').select('id, name, steam_appid');
  if (!games) return;

  for (const game of games) {
    const res = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${game.steam_appid}&cc=kr&l=korean`
    );
    const json = await res.json();
    if (!json[game.steam_appid]?.success) {
      console.log(`실패: ${game.name}`);
      continue;
    }
    const data = json[game.steam_appid].data;

    const [releaseDate, reviews, achievements, lowestPriceData] = await Promise.all([
      getEnglishReleaseDate(game.steam_appid),
      getReviewStats(game.steam_appid),
      getAchievementCount(game.steam_appid),
      getLowestPrice(game.id),
    ]);

    const update = {
      min_spec: parseMinSpecOnly(data.pc_requirements?.minimum),
      recommended_spec: parseMinSpecOnly(data.pc_requirements?.recommended),
      release_date: releaseDate,
      korean_support: parseKoreanSupport(data.supported_languages, data.full_audio_languages),
      storage_gb: parseStorage(data.pc_requirements?.minimum),
      has_dlc: (data.dlc?.length ?? 0) > 0,
      is_early_access: data.genres?.some((g) => g.id === '70') ?? false,
      achievement_count: achievements,
      ...(reviews && {
        review_positive_percent: reviews.percent,
        review_total: reviews.total,
      }),
      ...(lowestPriceData && {
        lowest_price: lowestPriceData.price,
        lowest_price_date: lowestPriceData.date,
      }),
    };

    const { error } = await supabase.from('games').update(update).eq('id', game.id);

    if (error) {
      console.error(`실패 (${game.name}):`, error.message);
    } else {
      console.log(
        `✅ ${game.name}: 출시일 ${releaseDate ?? 'null'} | 한국어 ${update.korean_support} | 용량 ${update.storage_gb ?? '?'}GB | 역대최저 ₩${lowestPriceData?.price?.toLocaleString() ?? '없음'}`
      );
    }

    await new Promise((r) => setTimeout(r, 1200));
  }
}

main();