// scripts/enrich-videos.mjs
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

async function searchTrailer(gameName) {
  try {
    const query = encodeURIComponent(`${gameName} official trailer`);
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&maxResults=1&key=${YOUTUBE_API_KEY}`
    );
    const json = await res.json();
    const videoId = json.items?.[0]?.id?.videoId;
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  } catch { return null; }
}

async function main() {
  const { data: games } = await supabase
    .from('games')
    .select('id, name')
    .is('video_url', null);

  if (!games) return;

  for (const game of games) {
    const url = await searchTrailer(game.name);
    if (url) {
      await supabase.from('games').update({ video_url: url }).eq('id', game.id);
      console.log(`✅ ${game.name}: ${url}`);
    } else {
      console.log(`❌ ${game.name}: 영상 없음`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

main();