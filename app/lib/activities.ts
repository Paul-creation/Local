// 가능한 활동 분류표 (v2) — 키·한국어 라벨·정의·체크 기준을 여기 한 곳에서만 정의 (브라우저·서버·스크립트 모두 import 가능, 비밀 값 넣지 말 것)
// - 모드(협력·대전·싱글)와 장르(스토리·RPG·로그라이크·전략)는 활동이 아니라서 넣지 않음. 모드는 has_online_coop·has_pvp·solo_playable 칸으로 표현
// - 저장: games.activities_confirmed / activities_unsure (키 배열), activities_evidence (키별 근거). 기존 games.activities(자유 문구)는 그대로 둠
// - 체크 기준(check): 플레이어가 직접 하는 행동이고, 스팀 설명·태그 같은 입력에 드러날 때만 yes

export const ACTIVITY_GROUPS = ['이동', '생활', '제작', '탐험', '전투', '경영', '사회', '기타'] as const;
export type ActivityGroup = (typeof ACTIVITY_GROUPS)[number];

export type ActivityDef = {
  key: string;
  label: string;
  group: ActivityGroup;
  def: string; // 한 줄 정의
  check: string; // 이게 있으면 체크
};

export const ACTIVITIES = [
  { key: 'drive', label: '운전', group: '이동', def: '차량을 직접 조작해 몬다', check: '자동차·트럭·버기 등을 직접 운전(레이싱 포함, 자동 주행이나 탑승만이면 제외)' },
  { key: 'fly', label: '비행', group: '이동', def: '비행체나 비행 능력으로 난다', check: '비행기·헬기·글라이더·비행 탈것을 직접 조작하거나 날 수 있음' },
  { key: 'ride', label: '탑승', group: '이동', def: '동물·탈것에 올라타 이동한다', check: '말·펫·호버보드 등에 탑승해 이동(차량 운전은 drive)' },
  { key: 'train', label: '기차', group: '이동', def: '열차를 놓거나 운전한다', check: '철도 부설이나 열차 운행이 게임 기능' },
  { key: 'sail', label: '항해', group: '이동', def: '배를 몰고 항해한다', check: '보트·함선을 조작하거나 바다를 건넘' },
  { key: 'swim_dive', label: '수영·잠수', group: '이동', def: '수영·잠수로 이동하고 탐사한다', check: '수영이나 잠수로 이동·탐사하는 구간이 있음' },
  { key: 'parkour', label: '파쿠르', group: '이동', def: '달리기·점프·클라이밍 이동 자체가 재미다', check: '클라이밍·그래플링·월런 등 이동 조작이 핵심 메커니즘' },

  { key: 'cook', label: '요리', group: '생활', def: '재료로 요리한다', check: '레시피나 조리 시스템이 있음(먹기만 하면 제외)' },
  { key: 'farm', label: '농사', group: '생활', def: '작물이나 가축을 키운다', check: '농사·목축 시스템이 있음' },
  { key: 'fish', label: '낚시', group: '생활', def: '낚시를 한다', check: '낚시 미니게임이나 낚시 시스템이 있음' },
  { key: 'hunt', label: '사냥', group: '생활', def: '야생동물·몬스터를 사냥해 자원을 얻는다', check: '사냥으로 고기·소재를 얻는 구조(단순 전투는 pve_fight)' },
  { key: 'gather', label: '채집', group: '생활', def: '필드에서 자원을 캐거나 모은다', check: '채집·채굴·벌목 행동이 있음' },
  { key: 'pets_tame', label: '길들이기', group: '생활', def: '동물·몬스터를 길들이거나 키운다', check: '포획·사육·펫 키우기 시스템이 있음' },
  { key: 'decorate', label: '꾸미기', group: '생활', def: '집·방·캐릭터 공간을 꾸민다', check: '인테리어·장식 배치 시스템이 있음(구조물 건설은 build)' },

  { key: 'craft', label: '제작', group: '제작', def: '재료로 도구·장비를 만든다', check: '제작 메뉴나 작업대가 있음' },
  { key: 'build', label: '건축', group: '제작', def: '구조물·기지를 직접 짓는다', check: '자유 건축이나 구조물 배치 시스템이 있음' },
  { key: 'automate', label: '자동화', group: '제작', def: '생산·물류를 자동화한다', check: '컨베이어·파이프·로직으로 생산 라인을 구성' },
  { key: 'program', label: '프로그래밍', group: '제작', def: '코드나 회로를 짠다', check: '프로그래밍·논리 회로 설계가 플레이의 일부' },
  { key: 'mod_edit', label: '맵 제작', group: '제작', def: '맵·콘텐츠를 직접 만들고 공유한다', check: '게임이 에디터·제작 도구를 직접 제공(모드 설치나 Steam Workshop 이용만이면 제외)' },

  { key: 'explore', label: '탐험', group: '탐험', def: '열린 공간을 돌아다니며 발견한다', check: '오픈월드나 탐사가 핵심 재미' },
  { key: 'puzzle', label: '퍼즐', group: '탐험', def: '퍼즐·수수께끼를 푼다', check: '퍼즐 풀이가 진행의 핵심' },
  { key: 'stealth', label: '잠입', group: '탐험', def: '들키지 않고 움직인다', check: '은신·잠입 메커니즘이 있음' },
  { key: 'collect', label: '수집', group: '탐험', def: '수집품·도감을 채운다', check: '수집이 진행의 중심(카드·몬스터·장비 도감 등)' },

  { key: 'pve_fight', label: '전투', group: '전투', def: '몬스터·적과 싸운다', check: '적과 싸우는 전투가 있음(협동·단독 불문)' },
  { key: 'boss_raid', label: '보스전', group: '전투', def: '보스·레이드를 공략한다', check: '보스전이나 레이드 콘텐츠가 명시되어 있음(리듬·퍼즐 게임의 연출상 보스 스테이지는 제외)' },
  { key: 'pvp', label: '대인전', group: '전투', def: '사람끼리 겨룬다', check: '플레이어 대 플레이어 모드가 있음' },
  { key: 'shoot', label: '사격', group: '전투', def: '총기로 쏜다', check: '총기가 핵심 전투 수단' },
  { key: 'defend', label: '방어', group: '전투', def: '거점·타워를 지킨다', check: '웨이브 방어나 타워 디펜스가 있음' },

  { key: 'manage', label: '운영·경영', group: '경영', def: '가게·도시·팀을 운영한다', check: '경영·운영 시뮬레이션 루프가 있음' },
  { key: 'trade', label: '거래', group: '경영', def: '사고팔거나 교역한다', check: '플레이어 상점·무역·경매 등 거래 시스템이 있음' },

  { key: 'role_split', label: '역할 분담', group: '사회', def: '역할을 나눠 협력한다', check: '직업·역할 분담이 승패나 진행에 영향(탱/힐/딜, 운전수/사수 등)' },
  { key: 'deduction', label: '추리·속이기', group: '사회', def: '정체를 숨기거나 거짓말쟁이를 찾는 마피아형만 해당. 범인 추리·수사는 해당 아님(dialogue_choice나 puzzle로 판단)', check: '마피아·어몽어스형처럼 정체를 숨기거나 거짓말쟁이를 찾는 규칙이 있음(범인 추리·수사 스토리는 제외)' },
  { key: 'voice_chat', label: '음성 소통', group: '사회', def: '말로 소통하는 것이 게임의 핵심이다', check: '근접 음성이나 말로 하는 협력이 게임 기능에 포함' },
  { key: 'minigame', label: '미니게임', group: '사회', def: '가벼운 파티 미니게임을 즐긴다', check: '짧은 규칙의 미니게임 모음이 있음' },
  { key: 'social_hang', label: '사교', group: '사회', def: '같이 어울리며 논다', check: '소셜 공간·이모트·모임 활동이 게임 기능에 포함' },
  { key: 'dialogue_choice', label: '대화·선택지', group: '사회', def: '대화에서 선택지를 고르고 그에 따라 결과·전개가 달라진다', check: '선택형 대화나 분기 결과가 게임 기능으로 있음(단순 대사 넘기기는 제외)' },

  { key: 'sports', label: '스포츠', group: '기타', def: '스포츠 종목을 플레이한다', check: '축구·농구·골프 등 실제 스포츠나 스포츠형 경기를 함(레이싱은 drive)' },
  { key: 'music', label: '음악·리듬', group: '기타', def: '음악에 맞춰 연주하거나 박자를 맞춘다', check: '리듬 게임이나 악기 연주가 핵심 플레이' },
  { key: 'photo', label: '사진', group: '기타', def: '사진을 찍거나 촬영한다', check: '카메라로 찍는 행동이 목표이거나 주요 기능' },
  { key: 'horror_scare', label: '공포·스릴', group: '기타', def: '무서운 상황을 함께 겪는다', check: '공포 연출이나 호러 분위기가 플레이 경험의 중심' },
] as const satisfies readonly ActivityDef[];

export type ActivityKey = (typeof ACTIVITIES)[number]['key'];
export const ACTIVITY_KEYS = ACTIVITIES.map((a) => a.key) as ActivityKey[];

const BY_KEY = new Map<string, ActivityDef>(ACTIVITIES.map((a) => [a.key, a]));
export const isActivityKey = (v: unknown): v is ActivityKey => typeof v === 'string' && BY_KEY.has(v);
export const activityLabel = (key: string) => BY_KEY.get(key)?.label ?? key;

// 키별 근거 (games.activities_evidence jsonb의 한 칸)
// basis: input = 입력(스팀 설명·태그 등)에 직접 근거가 있음, knowledge = 모델 지식뿐
// 저장: input+strong → confirmed, knowledge+strong → unsure, weak → activities_evidence에만 기록
// strength: strong = 근거가 그 키를 직접 뒷받침, weak = 간접·부족(어디에도 노출하지 않고 근거로만 기록)
export type ActivityEvidence = { basis: 'input' | 'knowledge'; strength: 'strong' | 'weak'; quote: string; note: string };
