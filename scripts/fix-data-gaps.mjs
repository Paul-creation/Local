// scripts/fix-data-gaps.mjs
// 스팀 게임의 빈칸 채우기: 한국어 지원, 무료 여부·가격, 부족한 태그 (AI 사용 없음, 비용 0)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseKoreanSupport(languages, fullAudioLanguages) {
  if (!languages) return '한국어 없음';
  const stripped = languages.replace(/<[^>]+>/g, '');
  const hasKorean = stripped.includes('한국어') || stripped.toLowerCase().includes('korean');
  if (!hasKorean) return '한국어 없음';
  const audio = (fullAudioLanguages || '').replace(/<[^>]+>/g, '');
  const hasKoreanAudio = audio.includes('한국어') || audio.toLowerCase().includes('korean');
  return hasKoreanAudio ? '자막+더빙' : '자막';
}

const GENRE_TAG = {
  Action: '액션', Adventure: '어드벤처', Casual: '캐주얼', RPG: 'RPG',
  Simulation: '시뮬레이션', Strategy: '전략', Sports: '스포츠', Racing: '레이싱',
  'Massively Multiplayer': 'MMO',
};
const CATEGORY_TAG = {
  'Online Co-op': '온라인 협동', 'Shared/Split Screen Co-op': '로컬 협동',
  'Online PvP': '온라인 대전', 'Shared/Split Screen PvP': '로컬 대전', MMO: 'MMO',
};

async function main() {
  const { data: games, error } = await supabase
    .from('games')
    .select('id, name, steam_appid, tags, korean_support, is_free, price_history(price)')
    .not('steam_appid', 'is', null);
  if (error) return console.error('조회 실패:', error.message);

  const targets = games.filter((g) => {
    const hasPrice = (g.price_history || []).some((p) => p.price >= 100);
    return !g.korean_support || (g.tags || []).length < 3 || (!g.is_free && !hasPrice);
  });
  console.log(`스팀 게임 ${games.length}개 중 빈칸 있는 ${targets.length}개 처리\n`);

  const stats = { korean: 0, free: 0, price: 0, tags: 0, noStore: 0 };

  for (const game of targets) {
    let data = null;
    try {
      const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${game.steam_appid}&cc=kr&l=english`);
      const json = await res.json();
      data = json?.[game.steam_appid]?.success ? json[game.steam_appid].data : null;
    } catch {}

    if (!data) {
      console.log(`➖ 스토어 정보 없음 (한국 판매 중단 가능): ${game.name}`);
      stats.noStore++;
      await sleep(1500);
      continue;
    }

    const update = {};
    const notes = [];

    if (!game.korean_support) {
      update.korean_support = parseKoreanSupport(data.supported_languages, data.full_audio_languages);
      notes.push(`한국어 ${update.korean_support}`);
      stats.korean++;
    }

    if (data.is_free && !game.is_free) {
      update.is_free = true;
      notes.push('무료로 수정');
      stats.free++;
    }

    const hasPrice = (game.price_history || []).some((p) => p.price >= 100);
    if (!data.is_free && !hasPrice && data.price_overview?.currency === 'KRW') {
      const final = data.price_overview.final / 100;
      if (final >= 100) {
        await supabase.from('price_history').insert({
          game_id: game.id,
          price: final,
          discount_percent: data.price_overview.discount_percent || 0,
        });
        notes.push(`가격 ₩${final.toLocaleString('ko-KR')}`);
        stats.price++;
      }
    }

    const tags = [...(game.tags || [])];
    if (tags.length < 3) {
      const extra = [
        ...(data.categories || []).map((c) => CATEGORY_TAG[c.description]),
        ...(data.genres || []).map((g) => GENRE_TAG[g.description]),
      ].filter(Boolean);
      for (const t of extra) {
        if (tags.length >= 3) break;
        if (!tags.includes(t)) tags.push(t);
      }
      if (tags.length > (game.tags || []).length) {
        update.tags = tags;
        notes.push(`태그 ${tags.join(', ')}`);
        stats.tags++;
      }
    }

    if (Object.keys(update).length) {
      const { error: upErr } = await supabase.from('games').update(update).eq('id', game.id);
      if (upErr) console.error(`❌ 저장 실패 (${game.name}):`, upErr.message);
    }
    console.log(`${notes.length ? '✅' : '·'} ${game.name}${notes.length ? ' — ' + notes.join(' | ') : ''}`);
    await sleep(1500);
  }

  console.log(`\n완료 — 한국어 ${stats.korean} · 무료 수정 ${stats.free} · 가격 ${stats.price} · 태그 ${stats.tags} · 스토어 정보 없음 ${stats.noStore}`);
}

main();
