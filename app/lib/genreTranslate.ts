export const GENRE_KO: Record<string, string> = {
  'Adventure': '어드벤처', 'Indie': '인디', 'Puzzle': '퍼즐', 'Simulator': '시뮬레이션',
  'Tactical': '전략', 'Platform': '플랫포머', 'Survival': '생존', 'Shooter': '슈팅',
  'Sport': '스포츠', 'Racing': '레이싱', 'Role-playing (RPG)': 'RPG', 'Strategy': '전략',
  'Fighting': '격투', 'Arcade': '아케이드', 'Family': '가족', 'Point-and-click': '포인트앤클릭',
  'Music': '음악', 'Visual Novel': '비주얼노벨', 'Card & Board Game': '카드/보드게임',
  'Action': '액션', 'Fantasy': '판타지', 'Science fiction': 'SF', 'Horror': '호러',
  'Thriller': '스릴러', 'Historical': '역사', 'Stealth': '잠입', 'Comedy': '코미디',
  'Business': '경영', 'Drama': '드라마', 'Sandbox': '샌드박스', 'Educational': '교육',
  'Kids': '어린이', 'Open world': '오픈월드', 'Warfare': '전쟁', 'Party': '파티',
  'Mystery': '미스터리', 'Romance': '로맨스',  'open world survival craft': '오픈월드 생존', 'online co-op': '온라인 협동',
  'psychological horror': '심리적 공포', 'third-person shooter': '3인칭 슈팅',
  'action roguelike': '액션 로그라이크', 'rogue-lite': '로그라이트',
  'extraction shooter': '추출 슈팅', 'atmospheric': '분위기 있는',
  'character customization': '캐릭터 커스텀', 'naval combat': '해상 전투',
  'base-building': '기지 건설', 'automation': '자동화', 'tanks': '탱크',
  'memes': '밈', 'farming sim': '농사 시뮬', 'pixel graphics': '픽셀아트',
  'life sim': '생활 시뮬', 'e-sports': 'e스포츠',
};

export function translateGenres(list: string[] = []): string[] {
  return list.map((g) => GENRE_KO[g.trim()] || g.trim());
}