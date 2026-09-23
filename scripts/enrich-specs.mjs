import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function stripHtml(html) {
  if (!html) return null;
  return html.replace(/<br\s*\/?>/gi, ' / ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function parseKoreanSupport(languages) {
  if (!languages) return '한국어 없음';
  const lower = languages.toLowerCase();
  if (!lower.includes('korean')) return '한국어 없음';
  return '자막';
}

function parseFamilySharing(categories) {
  const ids = (categories || []).map((c) => c.id);
  return !ids.includes(62);
}

function parseStorage(requirements) {
  if (!requirements) return null;
  const text = stripHtml(requirements) || '';
  const match = text.match(/(\d+(?:\.\d+)?)\s*(GB|MB)/i);
  if (!match) return null;
  const num = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  return unit === 'GB' ? num : Math.round(num / 1024 * 10) / 10;
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
      percent: qs.total_reviews > 0 ? Math.round((qs.total_positive / qs.total_reviews) * 100) : 0,
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

async function getLowestPrice(steamAppid) {
  try {
    const lookupRes = await fetch(
      `https://api.isthereanydeal.com/games/lookup/v1?key=${process.env.ITAD_API_KEY}&appid=${steamAppid}`
    );
    const lookup = await lookupRes.json();
    if (!lookup.found) return null;

    const histRes = await fetch(
      `https://api.isthereanydeal.com/games/history/v2?key=${process.env.ITAD_API_KEY}&id=${lookup.game.id}&country=KR`
    );
    const hist = await histRes.json();
    if (!Array.isArray(hist) || hist.length === 0) return null;

    const steamOnly = hist.filter((h) => h.shop?.name === 'Steam');
    if (steamOnly.length === 0) return null;

    const lowest = steamOnly.reduce((min, h) =>
      h.deal.price.amount < min.deal.price.amount ? h : min
    );
    return {
      price: lowest.deal.price.amount,
      date: lowest.timestamp?.slice(0, 10) ?? null,
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

    const [reviews, achievements, lowestPriceData] = await Promise.all([
      getReviewStats(game.steam_appid),
      getAchievementCount(game.steam_appid),
      getLowestPrice(game.steam_appid),
    ]);

    const update = {
      min_spec: stripHtml(data.pc_requirements?.minimum),
      release_date: (() => {
        try {
          const d = new Date(data.release_date?.date);
          return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
        } catch { return null; }
      })(),
      korean_support: parseKoreanSupport(data.supported_languages),
      storage_gb: parseStorage(data.pc_requirements?.minimum),
      has_dlc: (data.dlc?.length ?? 0) > 0,
      family_sharing: parseFamilySharing(data.categories),
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
        `✅ ${game.name}: 출시일 ${update.release_date} | 한국어 ${update.korean_support} | 용량 ${update.storage_gb}GB | 역대최저 ${lowestPriceData?.price ?? '없음'}`
      );
    }

    await new Promise((r) => setTimeout(r, 1200));
  }
}

main();