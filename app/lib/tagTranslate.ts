export const TAG_TRANSLATE: Record<string, string> = {
  // 장르/플레이스타일
  'Action Roguelike': '액션 로그라이크',
  'Action RPG': '액션 RPG',
  'RPG': 'RPG',
  'MMORPG': 'MMORPG',
  'FPS': 'FPS',
  'VR': 'VR',
  'e-sports': 'e스포츠',

  // 게임 방식
  'Hack and Slash': '핵앤슬래시',
  'Extraction Shooter': '익스트랙션 슈터',
  'Third-Person Shooter': '3인칭 슈터',
  'Top-Down Shooter': '탑다운 슈터',
  'Twin Stick Shooter': '트윈스틱 슈터',
  'Top-Down': '탑다운',
  'Social Deduction': '소셜 디덕션',
  'Party Game': '파티 게임',

  // 서브장르
  'Souls-like': '소울라이크',
  'Rogue-lite': '로그라이트',
  'Survival Horror': '서바이벌 호러',
  'Psychological Horror': '심리 공포',
  'Dark Fantasy': '다크 판타지',

  // 시스템
  'Open World Survival Craft': '오픈월드 생존',
  'Base-Building': '기지 건설',
  'Automation': '자동화',
  'Farming Sim': '농장 시뮬',
  'Life Sim': '생활 시뮬',
  'Creature Collector': '크리처 수집',
  'Character Customization': '캐릭터 커스텀',
  'Moddable': '모드 지원',
  'Choices Matter': '선택이 중요',

  // 배경/테마
  'Crime': '범죄',
  'Western': '서부',
  'Naval Combat': '해전',
  'Tanks': '탱크',
  'Combat': '전투',
  'Heist': '강도',
  'Hunting': '사냥',
  'Atmospheric': '분위기 있는',
  'Cinematic': '영화적',
  'Memes': '밈',
  'Transportation': '운송',

  // 스포츠
  'Football (Soccer)': '축구',
  'Basketball': '농구',

  // 멀티플레이
  'Online Co-Op': '온라인 협동',
  'Massively Multiplayer': '대규모 멀티',
  'Controller': '컨트롤러',

  // 아트
  'Pixel Graphics': '픽셀 그래픽',
  '2D Fighter': '2D 격투',
  '2D Platformer': '2D 플랫포머',

  // 스토리
  'Story Rich': '스토리 풍부',
  'Comedy': '코미디',
  'Dating Sim': '연애 시뮬',
  'Loot': '루팅',
};

export function translateTag(tag: string): string {
  return TAG_TRANSLATE[tag] || tag;
}