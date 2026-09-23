import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function mapAgeRating(data) {
  const age = Number(data.required_age) || 0;
  const hasContentWarning = (data.content_descriptors?.ids || []).length > 0;
  if (age >= 18) return '청소년이용불가 (18세 이상)';
  if (age >= 15) return '15세이용가';
  if (age >= 12) return '12세이용가';
  if (hasContentWarning) return '연령 등급 정보 불명확 (폭력성 등 콘텐츠 포함 가능)';
  return '전체이용가';
}

function stripHtml(html) {
  if (!html) return null;
  return html.replace(/<br\s*\/?>/gi, ' / ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

async function getReviewStats(appid) {
  try {
    const res = await fetch(
      `https://store.steampowered.com/appreviews/${appid}?json=1&filter=summary&language=all&purchase_type=all`
    );
    const json = await res.json();
    const qs = json.query_summary;
    if (!qs || !qs.total_reviews) return null;
    return {
      positive_percent: Math.round((qs.total_positive / qs.total_reviews) * 100),
      total: qs.total_reviews,
    };
  } catch {
    return null;
  }
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
    const minSpec = stripHtml(data.pc_requirements?.minimum);
    const reviewStats = await getReviewStats(game.steam_appid);

    const update = {
      min_spec: minSpec,
      ...(reviewStats && {
        review_positive_percent: reviewStats.positive_percent,
        review_total: reviewStats.total,
      }),
    };

    const { error } = await supabase.from('games').update(update).eq('id', game.id);

    if (error) {
      console.error(`실패 (${game.name}):`, error.message);
    } else {
      console.log(
        `${game.name}: 최소사양 + 리뷰 ${reviewStats ? `${reviewStats.positive_percent}% (${reviewStats.total.toLocaleString()}개)` : '없음'}`
      );
    }

    await new Promise((r) => setTimeout(r, 1000));
  }
}

main();