// 담당: 친구(검색·태그·비교)
// 검색창에 태그를 직접 입력하는 규칙 — "좀비, 협동" → 좀비+협동(온라인·로컬) 태그 / "엘든링 협동" → 이름 엘든링 + 협동 태그
// 입력을 쉼표·공백으로 나누고, 태그 이름(한국어)·영문 이름·별칭과 맞는 단어는 태그로, 나머지는 게임 이름 검색어로
// 비교는 searchMatch와 같은 규칙(소문자, 띄어쓰기·기호 무시). "온라인 협동"처럼 띄어 쓴 태그도 이어 붙여 맞춰 본다
import { normalizeSearch } from './searchMatch';
import { TAG_TRANSLATE } from './tagTranslate';

// 영문 태그 → 한국어 태그. Supabase tag_map 표를 옮긴 것 (브라우저에서는 tag_map을 읽을 수 없음)
// tag_map에 번역을 추가하면 여기에도 넣어야 영문으로 입력했을 때 알아본다
const TAG_MAP_EN: Record<string, string> = {
  'World War II': '2차 세계대전',
  'Third-Person Shooter': '3인칭 슈팅',
  'e-sports': 'e스포츠',
  'Sci-fi': 'SF',
  'Swordplay': '검술',
  '2D Fighter': '격투',
  'Management': '경영',
  'Economy': '경제',
  'Difficult': '고난도',
  'Gore': '고어',
  'Classic': '고전',
  'Golf': '골프',
  'Mini Golf': '골프',
  'Colony Sim': '군락 시뮬레이션',
  'Cute': '귀여운',
  'Base-Building': '기지 건설',
  'Trains': '기차',
  'Farming Sim': '농장 시뮬레이션',
  'Ninja': '닌자',
  'Dark Fantasy': '다크 판타지',
  'Dungeon Crawler': '던전 탐험',
  'Gambling': '도박',
  '1980s': '레트로',
  'Rogue-lite': '로그라이트',
  'Robots': '로봇',
  'Local Multiplayer': '로컬 협동',
  '4 Player Local': '로컬 협동',
  'Local Co-Op': '로컬 협동',
  'Rhythm': '리듬',
  'Magic': '마법',
  'Multiple Endings': '멀티 엔딩',
  'Metroidvania': '메트로배니아',
  'Martial Arts': '무술',
  'Trading': '무역',
  'Mystery': '미스터리',
  'Crime': '범죄',
  "Beat 'em up": '벨트스크롤 액션',
  'Board Game': '보드게임',
  'Atmospheric': '분위기 있는',
  'Split Screen': '분할 화면',
  'Bullet Time': '불릿 타임',
  'Visual Novel': '비주얼 노벨',
  'Flight': '비행',
  'Cyberpunk': '사이버펑크',
  'Life Sim': '생활 시뮬레이션',
  'Survival Horror': '서바이벌 호러',
  'Choices Matter': '선택이 중요한',
  'Choose Your Own Adventure': '선택형 어드벤처',
  'Souls-like': '소울라이크',
  'Investigation': '수사',
  'Underwater': '수중',
  'Thriller': '스릴러',
  'Story Rich': '스토리 풍부',
  'Mythology': '신화',
  'Psychological Horror': '심리 공포',
  'Arcade': '아케이드',
  'Action RPG': '액션 RPG',
  'Action Roguelike': '액션 로그라이크',
  'Action-Adventure': '액션 어드벤처',
  'Dark': '어두운 분위기',
  'Female Protagonist': '여성 주인공',
  'Open World Survival Craft': '오픈월드 생존',
  'Online Co-Op': '온라인 협동',
  'Cooking': '요리',
  'Extraction Shooter': '익스트랙션 슈팅',
  'Submarine': '잠수함',
  'Strategy RPG': '전략 RPG',
  'Tactical RPG': '전술 RPG',
  'Combat Racing': '전투 레이싱',
  'Political Sim': '정치 시뮬레이션',
  'Cartoon': '카툰',
  'Character Action Game': '캐릭터 액션',
  'Character Customization': '캐릭터 커스터마이징',
  'Comedy': '코미디',
  'Tower Defense': '타워 디펜스',
  'Bullet Hell': '탄막',
  'Detective': '탐정',
  'Turn-Based': '턴제',
  'Turn-Based Strategy': '턴제 전략',
  'Turn-Based Tactics': '턴제 전술',
  'Turn-Based Combat': '턴제 전투',
  'Parkour': '파쿠르',
  'Party': '파티 게임',
  'Party Game': '파티 게임',
  'Fantasy': '판타지',
  'Puzzle-Platformer': '퍼즐 플랫포머',
  'Point & Click': '포인트 앤 클릭',
  'Precision Platformer': '플랫포머',
  '3D Platformer': '플랫포머',
  '2D Platformer': '플랫포머',
  'Pixel Graphics': '픽셀 그래픽',
  'Hack and Slash': '핵앤슬래시',
};

// 묶음 태그 — 게임에 붙는 태그는 아니고, 안에 든 태그 중 하나라도 있으면 맞는 것으로 본다
// "협동"은 온라인·로컬 협동 둘 다, "온라인 협동"·"로컬 협동"을 따로 입력하면 각각만
export const TAG_ANY: Record<string, string[]> = {
  '협동': ['온라인 협동', '로컬 협동'],
  '대전': ['온라인 대전', '로컬 대전'],
};

// 태그가 없어도 스팀 카테고리로 채운 플래그(scripts/fill-steam-categories.mjs)가 켜져 있으면 맞는 것으로 본다
type FlagField = 'has_online_coop' | 'has_local_coop' | 'has_pvp';
const TAG_FLAGS: Record<string, FlagField[]> = {
  '협동': ['has_online_coop', 'has_local_coop'],
  '온라인 협동': ['has_online_coop'],
  '로컬 협동': ['has_local_coop'],
  '대전': ['has_pvp'],
};

type TaggedGame = { tags?: string[] | null } & Partial<Record<FlagField, boolean | null>>;

// 게임이 고른 태그(묶음 태그 포함)에 맞는지 — 태그나 해당 플래그 중 하나라도 있으면
export function hasTag(game: TaggedGame, tag: string) {
  return (TAG_ANY[tag] || [tag]).some((t) => game.tags?.includes(t)) || (TAG_FLAGS[tag] || []).some((f) => game[f]);
}

// 사람들이 자주 줄여 쓰거나 다르게 부르는 이름 → 태그
const EXTRA_ALIASES: Record<string, string> = {
  '코옵': '협동', 'coop': '협동', 'co-op': '협동',
  'pvp': '대전', 'versus': '대전',
  '공포': '호러', 'horror': '호러',
  'zombie': '좀비', 'zombies': '좀비',
  'open world': '오픈월드', '오픈 월드': '오픈월드',
  'survival': '생존', 'simulation': '시뮬레이션', '시뮬': '시뮬레이션',
  'puzzle': '퍼즐', 'strategy': '전략', 'casual': '캐주얼', 'sandbox': '샌드박스',
  '로그라이크': 'Rogue-like', 'roguelike': 'Rogue-like',
  'space': '우주', 'fps': 'FPS', 'rpg': 'RPG', 'jrpg': 'JRPG',
};

// 한 태그가 몇 단어까지 띄어 써질 수 있는지 (예: "Open World Survival Craft")
const MAX_WORDS = 4;

export type TagLookup = Map<string, string>; // 정규화한 이름 → 실제 태그

// tags: DB에 실제로 있는 태그 — 없는 태그로 가는 별칭은 버린다 (결과 0개 방지)
export function buildTagLookup(tags: Iterable<string>): TagLookup {
  const present = new Set(tags);
  // 묶음 태그는 안에 든 태그가 하나라도 있을 때만
  for (const [group, members] of Object.entries(TAG_ANY)) if (members.some((t) => present.has(t))) present.add(group);
  const lookup: TagLookup = new Map();
  const add = (name: string, tag: string) => {
    const key = normalizeSearch(name);
    if (key && present.has(tag) && !lookup.has(key)) lookup.set(key, tag);
  };
  for (const t of present) add(t, t); // 태그 이름 그대로가 별칭보다 먼저
  for (const [name, tag] of Object.entries(EXTRA_ALIASES)) add(name, tag);
  for (const [en, ko] of Object.entries(TAG_MAP_EN)) add(en, ko);
  for (const [en, ko] of Object.entries(TAG_TRANSLATE)) add(en, ko);
  return lookup;
}

export function splitWords(input: string) {
  return input.split(/[,\s]+/).filter(Boolean);
}

// 앞에서부터 가장 긴 묶음(여러 단어)부터 태그인지 보고, 태그가 아닌 단어는 원래 순서대로 이름 검색어로 남긴다
export function parseSearchInput(input: string, lookup: TagLookup) {
  const words = splitWords(input);
  const tags: string[] = [];
  const rest: string[] = [];
  for (let i = 0; i < words.length; ) {
    let span = 0;
    for (let n = Math.min(MAX_WORDS, words.length - i); n >= 1; n--) {
      const tag = lookup.get(normalizeSearch(words.slice(i, i + n).join('')));
      if (tag) {
        if (!tags.includes(tag)) tags.push(tag);
        span = n;
        break;
      }
    }
    if (span) i += span;
    else rest.push(words[i++]);
  }
  return { tags, rest: rest.join(' ') };
}

// 자동완성용 태그 후보 — 마지막 단어로 시작하는 태그 먼저, 그다음 포함하는 태그
export function suggestTags(word: string, lookup: TagLookup, exclude: string[], limit: number) {
  const q = normalizeSearch(word);
  if (!q) return [];
  const rank = new Map<string, number>();
  for (const [key, tag] of lookup) {
    if (exclude.includes(tag)) continue;
    const r = key.startsWith(q) ? 0 : key.includes(q) ? 1 : -1;
    if (r >= 0 && (rank.get(tag) ?? 9) > r) rank.set(tag, r);
  }
  return [...rank].sort((a, b) => a[1] - b[1] || a[0].length - b[0].length).slice(0, limit).map(([tag]) => tag);
}
