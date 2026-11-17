// 첫 방문자용 단계별 투어의 진행 규칙 — 화면 없이 판단만 한다 (components/tour/TourRoot이 이 규칙대로 그림)
// 저장값(localStorage jdn_tour_v3)은 JSON {status, step}. 저장소를 못 쓰면 투어를 띄우지 않는다

// 문구의 사이트 이름 자리 — resolveStep이 SITE_NAME(lib/site)으로 바꾼다 (이 파일은 node 시험에서 바로 읽혀 site.ts를 직접 import하지 못함)
export const SITE_TOKEN = '{SITE}';

// 검색창 개편(v3)으로 단계가 전부 바뀌어서 키를 올렸다 — 예전 키(v1·v2)는 읽지 않으므로 기존 방문자도 새 투어를 한 번 다시 본다 (jdn_ 접두사는 그대로)
export const TOUR_KEY = 'jdn_tour_v3';

export type TourPage = 'home' | 'find';
export type TourStep = {
  id: string;
  page: TourPage;
  // data-tour 속성값. 한 단계에 여러 개를 적으면 화면에 보이는 것만 쓴다 (데스크톱 칸 / 휴대폰 알약, 방문자 히어로 / 로그인 사용자 검색창)
  targets: string[];
  title: string;
  desc: string;
  // target: 대상을 직접 누르면 다음 / button: 말풍선 버튼으로만 다음
  action: 'target' | 'button';
  buttonLabel?: string;
  // 설명만 보는 단계 — 대상 요소를 눌러도 아무 일도 안 일어나게 막는다 (검색창 입력·패널이 열려 투어가 끊기지 않게)
  block?: boolean;
  // 대상이 없으면 이 단계만 건너뜀 (없으면 투어 종료)
  optional?: boolean;
  // 대상이 나타나길 기다리는 최대 시간(ms) — 결과 화면처럼 목록을 받은 뒤에 그려지는 대상용 (기본: 필수 8000, 선택 1200)
  wait?: number;
  // "다음" 버튼으로 넘어갈 때 이동할 주소 (다른 화면의 단계로 이어질 때)
  nextHref?: string;
  // action이 target일 때 이 안쪽 요소를 눌렀을 때만 다음으로 (없으면 대상 어디든)
  hitSelector?: string;
  // 로그인 상태에서는 아예 없는 단계 (진행 표시 "n/N"의 N에도 안 센다)
  guestOnly?: boolean;
};

// 결과 화면으로 가는 예시 조건 — 상황 타일 첫 번째("둘이서 밤샘")와 같은 조건이라 근거 배지와 "N명 다 사면"이 모두 나온다
export const TOUR_SAMPLE_HREF = '/find?n=2&how=coop';

export const TOUR_STEPS: TourStep[] = [
  { id: 'welcome', page: 'home', targets: ['hero', 'welcome-member'], title: `${SITE_TOKEN}에 온 걸 환영해요`, desc: '친구랑 할 게임을 인원·가격·할인으로 한 번에 비교해요', action: 'button', buttonLabel: '다음', block: true },
  { id: 'who', page: 'home', targets: ['ab-who', 'ab-pill'], title: '누구랑 할 거예요?', desc: '인원부터 골라요. 그 인원이 같이 할 수 있는 게임만 보여줘요', action: 'button', buttonLabel: '다음', block: true },
  { id: 'how', page: 'home', targets: ['ab-how', 'ab-pill'], title: '어떻게 할래요?', desc: '같이 깨기·서로 붙기처럼 플레이 방식을 골라요', action: 'button', buttonLabel: '다음', block: true },
  { id: 'what', page: 'home', targets: ['ab-what', 'ab-pill'], title: '뭐 할까요?', desc: '장르를 고르거나 게임 이름을 검색해요', action: 'button', buttonLabel: '다음', block: true },
  { id: 'go', page: 'home', targets: ['ab-go', 'ab-pill'], title: '다 고르면 찾기를 눌러요', desc: '안 골라도 괜찮아요. 비워 두면 인기 있는 순으로 보여줘요', action: 'button', buttonLabel: '다음', block: true },
  { id: 'situations', page: 'home', targets: ['situations'], title: '고민될 땐 상황부터 눌러봐요', desc: '"이런 판 어때요?"에서 하나 누르면 그 조건으로 바로 찾아줘요', action: 'target', buttonLabel: '다음', hitSelector: '.ab-sit-card', nextHref: TOUR_SAMPLE_HREF },
  { id: 'evidence', page: 'find', targets: ['evidence'], title: '왜 이 게임인지 알려줘요', desc: '근거 배지로 조건에 맞는 이유를, 아래 줄로 다 같이 사면 얼마인지 봐요', action: 'button', buttonLabel: '다음', block: true, optional: true, wait: 10000 },
  { id: 'login', page: 'find', targets: ['login'], title: 'Steam으로 로그인해 보세요', desc: '찜목록과 내 PC에서 돌아가는 게임 찾기를 쓸 수 있어요', action: 'button', buttonLabel: '끝내기', block: true, optional: true, guestOnly: true },
];
export const TOUR_TOTAL = TOUR_STEPS.length;
// 실제로 보이는 단계 수 — 로그인 상태면 guestOnly 단계가 빠진다 (진행 표시용)
export const tourTotal = (loggedIn: boolean) => TOUR_STEPS.filter((s) => !(loggedIn && s.guestOnly)).length;

export const TOUR_FINALE = { title: '준비 끝!' };
export const FINALE_MS = 2000;

export type TourState = { status: 'running' | 'done' | 'skipped'; step: number };

export function parseState(raw: string | null | undefined): TourState | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (v && (v.status === 'running' || v.status === 'done' || v.status === 'skipped')) {
      const step = Number.isInteger(v.step) && v.step >= 0 && v.step < TOUR_TOTAL ? v.step : 0;
      return { status: v.status, step };
    }
  } catch { /* 깨진 값은 아래에서 끝난 것으로 본다 */ }
  return { status: 'done', step: 0 };
}
export const serializeState = (s: TourState) => JSON.stringify(s);

const BOT = /bot|crawl|spider|slurp|bing|yeti|daum|facebookexternalhit|lighthouse|prerender/i;
export const isBot = (ua: string) => !ua || BOT.test(ua);

export function pageOf(pathname: string): TourPage | null {
  if (pathname === '/') return 'home';
  if (pathname === '/find' || pathname === '/find/') return 'find';
  return null;
}

export type Decision = { kind: 'none' } | { kind: 'start' } | { kind: 'resume'; step: number } | { kind: 'end' };

// raw: 저장된 값(없으면 null). 첫 방문 + 홈(주소에 검색 조건 없음) + 봇 아님 → 시작
// 진행 중이면 지금 페이지가 그 단계의 페이지일 때만 이어가고, 아니면(다른 페이지로 갔으면) 종료
export function decide(raw: string | null, pathname: string, search: string, ua: string): Decision {
  const st = parseState(raw);
  if (!st) return pathname === '/' && !search && !isBot(ua) ? { kind: 'start' } : { kind: 'none' };
  if (st.status !== 'running') return { kind: 'none' };
  return pageOf(pathname) === TOUR_STEPS[st.step].page ? { kind: 'resume', step: st.step } : { kind: 'end' };
}

// 다음 단계 번호, 마지막이면 'finale'
export function advance(step: number, loggedIn = false): number | 'finale' {
  let to = step + 1;
  while (to < TOUR_TOTAL && loggedIn && TOUR_STEPS[to].guestOnly) to++;
  return to >= TOUR_TOTAL ? 'finale' : to;
}

export type Box = { left: number; top: number; width: number; height: number };
export type Placement = { left: number; top: number; side: 'below' | 'above' | 'over'; tailX: number | null };

// 말풍선 자리 — 대상 아래가 기본, 화면 밖이면 위, 둘 다 안 되면 대상 위에 겹쳐 아래쪽에 두고 꼬리는 없음
export function placeBubble(a: Box, b: { w: number; h: number }, vw: number, vh: number, margin = 16, gap = 18, bottomReserve = 72): Placement {
  const clampX = (x: number) => Math.max(margin, Math.min(x, vw - b.w - margin));
  const wide = a.width > b.w + 120;
  const anchorX = wide ? a.left + Math.min(a.width / 2, 80) : a.left + a.width / 2;
  const left = clampX(wide ? a.left : anchorX - b.w / 2);
  const tailX = Math.max(22, Math.min(anchorX - left, b.w - 22));
  const below = a.top + a.height + gap;
  if (below + b.h <= vh - 8) return { left, top: below, side: 'below', tailX };
  const above = a.top - gap - b.h;
  if (above >= 8) return { left, top: above, side: 'above', tailX };
  return { left: clampX((vw - b.w) / 2), top: Math.max(8, vh - b.h - bottomReserve), side: 'over', tailX: null };
}

export const stepTargetNames = (i: number) => TOUR_STEPS[i].targets;

export type StepContent = { names: string[]; title: string; desc: string; action: 'target' | 'button'; buttonLabel?: string; block: boolean };
// 지금 단계에 보여줄 내용
export function resolveStep(i: number, siteName: string): StepContent {
  const s = TOUR_STEPS[i];
  return { names: s.targets, title: s.title.replaceAll(SITE_TOKEN, siteName), desc: s.desc.replaceAll(SITE_TOKEN, siteName), action: s.action, buttonLabel: s.buttonLabel, block: !!s.block };
}
