// 첫 방문자용 단계별 투어의 진행 규칙 — 화면 없이 판단만 한다 (components/tour/TourRoot이 이 규칙대로 그림)
// 저장값(localStorage jdn_tour_v1)은 JSON {status, step}. 저장소를 못 쓰면 투어를 띄우지 않는다

export const TOUR_KEY = 'jdn_tour_v1';

export type TourPage = 'home' | 'detail';
export type TourStep = {
  id: string;
  page: TourPage;
  // data-tour 속성값 (slot 단계는 비워 둠)
  targets: string[];
  title: string;
  desc: string;
  // target: 대상을 직접 누르면 다음 / button: 말풍선 버튼으로만 다음 (마지막 단계는 둘 다)
  action: 'target' | 'button';
  buttonLabel?: string;
  // 상세의 "화면 위에서부터 하나씩" 단계 — 스탯 타일·가격 카드 중 화면에서 위에 있는 순서대로 slot번째를 보여준다 (resolveStep)
  slot?: number;
};

export const TOUR_STEPS: TourStep[] = [
  { id: 'people', page: 'home', targets: ['people-tabs'], title: '친구 몇 명이서 할 거예요?', desc: '위에서 인원을 눌러보세요', action: 'target' },
  { id: 'card', page: 'home', targets: ['first-card'], title: '하나 골라볼까요?', desc: '카드를 눌러 자세히 봐요', action: 'target' },
  { id: 'info1', page: 'detail', targets: [], title: '', desc: '', action: 'button', buttonLabel: '다음', slot: 0 },
  { id: 'info2', page: 'detail', targets: [], title: '', desc: '', action: 'button', buttonLabel: '다음', slot: 1 },
  { id: 'compare', page: 'detail', targets: ['compare-add'], title: '친구랑 고민되면 담아서 비교해요', desc: '버튼을 누르거나 아래 끝내기를 눌러요', action: 'target', buttonLabel: '끝내기' },
];
export const TOUR_TOTAL = TOUR_STEPS.length;

export const TOUR_FINALE = { title: '준비 끝!', desc: '뭘 할지 모르겠으면 홈에서 AI 추천을 눌러보세요' };
export const FINALE_MS = 3000;

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
  if (/^\/games\/[^/]+\/?$/.test(pathname)) return 'detail';
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
export const advance = (step: number): number | 'finale' => (step + 1 >= TOUR_TOTAL ? 'finale' : step + 1);

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

export const INFO_ITEMS = [
  { target: 'stat-tiles', title: '인원·평가·플레이 시간은 여기서 봐요' },
  { target: 'price-card', title: '지금 가격이랑 역대 최저가예요' },
];
// 화면에 있는 INFO_ITEMS를 위쪽 좌표 순으로 (모바일에서 가격 카드가 위면 순서가 바뀜, 문구는 대상을 따라간다)
export function orderInfo(tops: Record<string, number | undefined>) {
  return INFO_ITEMS.filter((p) => typeof tops[p.target] === 'number').sort((a, b) => (tops[a.target] as number) - (tops[b.target] as number));
}
export const stepTargetNames = (i: number) => (TOUR_STEPS[i].slot === undefined ? TOUR_STEPS[i].targets : INFO_ITEMS.map((p) => p.target));

export type StepContent = { names: string[]; title: string; desc: string; action: 'target' | 'button'; buttonLabel?: string };
// 지금 단계에 보여줄 내용 — 대상이 없어 비는 slot 단계는 null(건너뜀)
export function resolveStep(i: number, tops: Record<string, number | undefined>): StepContent | null {
  const s = TOUR_STEPS[i];
  if (s.slot === undefined) return { names: s.targets, title: s.title, desc: s.desc, action: s.action, buttonLabel: s.buttonLabel };
  const item = orderInfo(tops)[s.slot];
  return item ? { names: [item.target], title: item.title, desc: '', action: s.action, buttonLabel: s.buttonLabel } : null;
}
