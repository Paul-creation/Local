// 담당: Paul(메인 배너·디자인)
// 메인 상단 이벤트 영역. 날짜가 맞는 이벤트가 있으면 그걸, 없으면 그 달의 기본 이벤트를 보여준다.
// 태그는 DB(games.tags)에 실제로 있는 한국어 태그 이름만 쓴다. 여러 개면 하나라도 맞는 게임이 나온다.

// 배너 카드 색 — 이벤트 색의 아주 어두운 배경 (라이트에서는 아주 옅은 배경). 실제 색은 globals.css .home-event[data-tone]
export type EventTone = 'horror' | 'blue' | 'red' | 'green' | 'pink' | 'gold' | 'purple' | 'teal' | 'orange';

export type HomeEvent = {
  tone: EventTone;
  title: string;
  description: string;
  tags: string[];
  // 'streamer' = 스트리머 기획전: 태그 검색 대신 스트리머가 같이 플레이한 게임 카드를 보여준다 (lib/streamerTheme).
  // 설명(description)은 데이터 기준 문구로 바뀌고, 게임이 하나도 없으면 fallback 이벤트를 대신 보여준다
  kind?: 'streamer';
  fallback?: HomeEvent;
};

export type DatedEvent = HomeEvent & {
  start: string; // 'YYYY-MM-DD' (한국 시간, 이 날 포함)
  end: string;   // 'YYYY-MM-DD' (한국 시간, 이 날 포함)
};

// 기간이 정해진 이벤트 — 겹치면 위에 있는 것이 먼저
export const EVENTS: DatedEvent[] = [
  {
    start: '2026-10-24', end: '2026-10-31',
    tone: 'horror', title: '할로윈 주간, 같이 무서워하기',
    description: '불 끄고 친구랑 소리 지르면서 하는 공포 게임 모음',
    tags: ['호러', '서바이벌 호러', '심리 공포', '좀비'],
  },
];

// 달마다 기본 이벤트 (index 0 = 1월)
export const MONTHLY_EVENTS: HomeEvent[] = [
  { tone: 'blue', title: '새해엔 새로운 모험', description: '올해 첫 게임은 넓은 세상을 누비는 오픈월드로', tags: ['오픈월드', '어드벤처', 'RPG'] },
  { tone: 'red', title: '설 연휴, 온 가족이 한 화면에서', description: '한 화면에서 나눠 하는 로컬 협동·캐주얼 게임', tags: ['로컬 협동', '분할 화면', '캐주얼', '가족친화'] },
  { tone: 'green', title: '새 학기엔 가볍게 한 판', description: '노트북으로도 잘 돌아가는 가벼운 게임', tags: ['저사양', '캐주얼', '퍼즐'] },
  { tone: 'pink', title: '봄맞이 힐링 게임', description: '느긋하게 농사짓고 꾸미는 포근한 게임', tags: ['농장 시뮬레이션', '생활 시뮬레이션', '귀여운', 'Cozy', 'Relaxing'] },
  { tone: 'gold', title: '5월은 실력 겨루기', description: '친구랑 붙어보는 대전·경쟁 게임', tags: ['온라인 대전', '경쟁', 'e스포츠', '격투'] },
  { tone: 'purple', title: '머리 쓰는 6월', description: '퍼즐 풀고 전략 짜는 두뇌 게임', tags: ['퍼즐', '전략', '미스터리', '탐정'] },
  { tone: 'teal', title: '여름방학엔 긴 RPG', description: '시간 넉넉할 때 빠져드는 스토리 RPG', tags: ['RPG', 'JRPG', '스토리 풍부', '액션 RPG'] },
  { tone: 'green', title: '한여름 밤의 생존', description: '좀비와 자연을 버티는 생존 게임', tags: ['생존', '오픈월드 생존', '좀비', '서바이벌 호러'] },
  { tone: 'gold', title: '추석 연휴엔 다 같이', description: '모이면 바로 시작하는 협동 게임', tags: ['온라인 협동', '로컬 협동', '파티 게임', '캐주얼'] },
  { tone: 'horror', title: '10월은 공포 게임의 달', description: '혼자는 무섭고, 같이 하면 더 무서운 공포 게임', tags: ['호러', '심리 공포'] },
  {
    kind: 'streamer', tone: 'blue', title: '스트리머들이 같이 밤새운 협동 게임', description: '', tags: [],
    fallback: { tone: 'orange', title: '쌀쌀할 땐 집에서 협동', description: '따뜻한 방에서 친구랑 온라인 협동', tags: ['온라인 협동', '로컬 협동'] },
  },
  { tone: 'red', title: '연말엔 파티 게임', description: '송년회에서 다 같이 웃으면서 하는 게임', tags: ['파티 게임', '코미디', '로컬 협동', '분할 화면'] },
];

// 서버와 브라우저가 같은 날짜를 보도록 한국 시간 기준 'YYYY-MM-DD'
function todayInKorea(now: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

// label: 배너 위 작은 글씨 — 기간 이벤트는 "기간 한정", 달 기본 이벤트는 "N월의 테마"
// previewMonth: 관리자 미리보기(/theme-preview?month=11)용 — 그 달의 기본 이벤트를 날짜와 상관없이 보여준다
export function getCurrentEvent(now: Date = new Date(), previewMonth?: number): HomeEvent & { label: string } {
  if (previewMonth) return { ...MONTHLY_EVENTS[previewMonth - 1], label: `${previewMonth}월의 테마` };
  const today = todayInKorea(now);
  const dated = EVENTS.find((e) => e.start <= today && today <= e.end);
  if (dated) return { ...dated, label: '기간 한정' };
  const month = Number(today.slice(5, 7));
  return { ...MONTHLY_EVENTS[month - 1], label: `${month}월의 테마` };
}

// "보러 가기" — 기존 URL 상태 방식(/?r=1&tags=...) 그대로
export function eventHref(event: HomeEvent) {
  return `/?${new URLSearchParams({ r: '1', tags: event.tags.join(',') }).toString()}`;
}
