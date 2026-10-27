'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import './tour.css';
import {
  TOUR_KEY, TOUR_LEGACY_KEY, TOUR_STEPS, TOUR_TOTAL, TOUR_FINALE, FINALE_MS,
  INFO_ITEMS, decide, advance, serializeState, placeBubble, resolveStep, stepTargetNames,
  type Box, type Placement, type StepContent, type TourState,
} from '../../lib/tour';

// 첫 방문자 투어 — 서버에서는 아무것도 그리지 않고(렌더 결과 null), 브라우저에서 규칙(lib/tour)이 허락할 때만 position: fixed로 겹쳐 띄운다
// 진행 상태는 localStorage(jdn_tour_v1)에 저장해 카드 → 상세 이동 뒤에도 이어간다. 저장소를 못 쓰면 시작하지 않는다
// c: 이 단계에 실제로 보여줄 내용(lib/tour resolveStep) — 상세 slot 단계는 화면 위에서부터 순서가 정해짐
type StepView = { kind: 'step'; step: number; c: StepContent };
type View = StepView | { kind: 'finale' } | null;
type Layout = { key: string; step: number; holes: Box[]; place: Placement; vw: number; vh: number };

const HOLE_PAD = 6;
const HOLE_R = 10;

const read = (): { ok: boolean; raw: string | null; legacy: string | null } => {
  try { return { ok: true, raw: window.localStorage.getItem(TOUR_KEY), legacy: window.localStorage.getItem(TOUR_LEGACY_KEY) }; } catch { return { ok: false, raw: null, legacy: null }; }
};
const write = (s: TourState): boolean => {
  try { window.localStorage.setItem(TOUR_KEY, serializeState(s)); return true; } catch { return false; }
};
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
// 대상의 화면 위치 — display: contents(홈 히어로의 .home-only)는 자기 박스가 없어서 자식들을 합친 영역을 쓴다. 보이지 않으면 null
const rectOf = (el: HTMLElement): DOMRect | null => {
  if (el.getClientRects().length > 0) return el.getBoundingClientRect();
  const rs = Array.from(el.children).map((c) => c.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
  if (rs.length === 0) return null;
  const l = Math.min(...rs.map((r) => r.left)), t = Math.min(...rs.map((r) => r.top));
  return new DOMRect(l, t, Math.max(...rs.map((r) => r.right)) - l, Math.max(...rs.map((r) => r.bottom)) - t);
};
const findTarget = (name: string): HTMLElement | null =>
  Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)).find((el) => rectOf(el)) ?? null;
const findNames = (names: string[]) => names.map(findTarget).filter((e): e is HTMLElement => !!e);
const findTargets = (step: number) => findNames(stepTargetNames(step));
const namesOf = (v: StepView) => v.c.names;
const viewKey = (v: StepView) => String(v.step);
const toBox = (r: DOMRect): Box => ({ left: r.left, top: r.top, width: r.width, height: r.height });
const FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';

function holePath(h: Box): string {
  const x = h.left - HOLE_PAD, y = h.top - HOLE_PAD, w = h.width + HOLE_PAD * 2, hh = h.height + HOLE_PAD * 2;
  const r = Math.min(HOLE_R, w / 2, hh / 2);
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + hh - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + hh}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + hh - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

export default function TourRoot() {
  const pathname = usePathname();
  const [view, setView] = useState<View>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const gen = useRef(0); // 진행 중인 기다림을 취소하는 번호표

  // 대상이 화면에 나타날 때까지 기다림 (extras: 같이 있어야 하는 대상)
  const waitFor = useCallback(async (step: number, my: number, extras: string[], timeout: number): Promise<boolean> => {
    for (let t = 0; t < timeout; t += 150) {
      if (my !== gen.current) return false;
      if (findTargets(step).length > 0 && extras.every((x) => findTarget(x))) return true;
      await sleep(150);
    }
    return false;
  }, []);

  // 대상이 화면 밖(일부라도 잘림)일 때만 부드럽게 스크롤해 대상이 화면 위쪽 1/3에 오게 하고, 멈출 때까지 기다림
  const bringIntoView = useCallback(async (els: HTMLElement[], my: number) => {
    if (els.length === 0) return;
    const rect = rectOf(els[0])!;
    const vh = window.innerHeight;
    if (rect.top >= 70 && rect.bottom <= vh) return;
    const want = rect.height > vh * 0.6 ? 90 : Math.round(vh / 3);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollBy({ top: rect.top - want, behavior: reduce ? 'auto' : 'smooth' });
    let last = -1, still = 0;
    for (let t = 0; t < 1500 && still < 150; t += 50) {
      await sleep(50);
      if (my !== gen.current) return;
      if (window.scrollY === last) still += 50; else { still = 0; last = window.scrollY; }
    }
  }, []);

  const finish = useCallback((status: 'done' | 'skipped', step: number, finale: boolean) => {
    gen.current++;
    write({ status, step });
    setView(finale ? { kind: 'finale' } : null);
  }, []);

  // step부터 보여줄 수 있는 첫 단계를 찾아 띄움 — 대상이 없는 optional 단계는 건너뛰고, 필수 단계의 대상이 없으면 종료
  const enter = useCallback(async (step: number, my: number, first: boolean) => {
    let at = step;
    for (;;) {
      const def = TOUR_STEPS[at];
      const start = first && at === step; // 시작할 때는 인원 탭과 첫 카드까지 있어야 함 (추천이 비어 있으면 시작 안 함)
      const ok = await waitFor(at, my, start ? ['people-tabs', 'first-card'] : [], start || !def.optional ? 8000 : 1200);
      if (my !== gen.current) return;
      let c = null;
      if (ok) {
        // 홈 맨 처음 단계와 상세에 처음 들어온 단계는 스크롤 맨 위(0)에서 시작
        if (at === 0 || (def.page === 'detail' && TOUR_STEPS[at - 1].page !== 'detail')) window.scrollTo({ top: 0, behavior: 'instant' });
        const tops: Record<string, number> = {};
        for (const p of INFO_ITEMS) { const e = findTarget(p.target); if (e) tops[p.target] = rectOf(e)!.top; }
        c = resolveStep(at, tops);
      }
      if (c) {
        if (!write({ status: 'running', step: at }) && first) return;
        await bringIntoView(findNames(c.names), my);
        if (my === gen.current) setView({ kind: 'step', step: at, c });
        return;
      }
      if (!def.optional) { if (!first) write({ status: 'done', step: at }); return; }
      const to = advance(at);
      if (to === 'finale') { finish('done', at, true); return; }
      at = to;
    }
  }, [waitFor, bringIntoView, finish]);

  // 시작·이어가기: 페이지가 바뀔 때마다 저장된 상태로 판단
  useEffect(() => {
    const my = ++gen.current;
    const r = read();
    if (!r.ok) return;
    const d = decide(r.raw, window.location.pathname, window.location.search, navigator.userAgent, r.legacy);
    if (d.kind === 'end') { write({ status: 'done', step: 0 }); return; }
    if (d.kind === 'none') return;
    void (async () => {
      if (d.kind === 'start') await sleep(600); // 홈 첫 렌더가 끝난 뒤
      if (my === gen.current) await enter(d.kind === 'start' ? 0 : d.step, my, d.kind === 'start');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gen은 화면 노드가 아니라 번호표라 정리 시점의 값이 맞다
    return () => { gen.current++; };
  }, [pathname, enter]);

  const next = useCallback((step: number) => {
    const to = advance(step);
    if (to === 'finale') return finish('done', step, true);
    gen.current++;
    setView(null);
    if (TOUR_STEPS[to].page !== TOUR_STEPS[step].page) { write({ status: 'running', step: to }); return; } // 새 페이지에서 pathname 효과가 이어감
    void enter(to, gen.current, false);
  }, [enter, finish]);

  const sv = view?.kind === 'step' ? view : null;
  const step = sv ? sv.step : -1;

  // 클릭·Esc·Tab
  useEffect(() => {
    if (step < 0) return;
    const names = namesOf(sv!);
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const t = e.target as Element | null;
      if (!t || t.closest('.jdn-tour')) return;
      const hit = TOUR_STEPS[step].id === 'people' ? t.closest('[data-tour="people-tabs"] button') : sv!.c.action === 'target' && names.some((n) => t.closest(`[data-tour="${n}"]`));
      if (hit) next(step);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); finish('skipped', step, false); return; }
      if (e.key !== 'Tab') return;
      const list: HTMLElement[] = [];
      for (const el of sv!.c.block ? [] : findNames(names)) { // 설명만 보는 단계는 대상으로 Tab이 못 가게
        if (el.matches(FOCUSABLE)) list.push(el);
        else list.push(...Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((x) => x.getClientRects().length > 0));
      }
      list.push(...Array.from(bubbleRef.current?.querySelectorAll<HTMLElement>('button') ?? []));
      if (skipRef.current) list.push(skipRef.current);
      if (list.length === 0) return;
      e.preventDefault();
      const i = list.indexOf(document.activeElement as HTMLElement);
      const to = e.shiftKey ? (i <= 0 ? list.length - 1 : i - 1) : (i < 0 || i === list.length - 1 ? 0 : i + 1);
      list[to].focus();
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    bubbleRef.current?.focus({ preventScroll: true });
    return () => { document.removeEventListener('click', onClick, true); document.removeEventListener('keydown', onKey, true); };
  }, [sv, step, next, finish]);

  // 설명만 보는 단계: 대상 안의 입력·버튼이 눌리거나 포커스를 받지 않게 (구멍 밖은 아래 투명 막이 막는다)
  useEffect(() => {
    if (!sv || !sv.c.block) return;
    const els = findNames(sv.c.names);
    els.forEach((e) => { e.inert = true; });
    return () => els.forEach((e) => { e.inert = false; });
  }, [sv]);

  // 대상 위치를 따라가며 구멍·말풍선 자리 갱신 (스크롤·크기 변화·목록 교체 모두 매 프레임 확인). 대상이 1.5초 넘게 없으면 종료
  useEffect(() => {
    if (step < 0) return;
    const names = namesOf(sv!);
    const vkey = viewKey(sv!);
    let raf = 0, last = '', missing = 0;
    const tick = (now: number) => {
      const els = findNames(names);
      if (els.length === 0) {
        missing ||= now;
        if (now - missing > 1500) { finish('done', step, false); return; }
      } else {
        missing = 0;
        const b = bubbleRef.current;
        if (b && b.offsetWidth > 0) {
          const rects = els.map((e) => toBox(rectOf(e)!));
          const vw = document.documentElement.clientWidth, vh = window.innerHeight;
          const place = placeBubble(rects[0], { w: b.offsetWidth, h: b.offsetHeight }, vw, vh);
          const key = JSON.stringify([rects, place, vw, vh]);
          if (key !== last) { last = key; setLayout({ key: vkey, step, holes: rects, place, vw, vh }); }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sv, step, finish]);

  // 마무리 말풍선: 2초 뒤 또는 아무 데나 누르면 닫힘
  const finale = view?.kind === 'finale';
  useEffect(() => {
    if (!finale) return;
    const close = () => setView(null);
    const timer = setTimeout(close, FINALE_MS);
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('keydown', close, true);
    return () => { clearTimeout(timer); document.removeEventListener('pointerdown', close, true); document.removeEventListener('keydown', close, true); };
  }, [finale]);

  if (!view) return null;
  if (view.kind === 'finale') {
    return (
      <div className="jdn-tour">
        <div className="jdn-tour-bubble jdn-tour-finale" role="dialog" aria-live="polite" aria-label={TOUR_FINALE.title}>
          <div className="jdn-tour-float">
            <p className="jdn-tour-title">{TOUR_FINALE.title}</p>
          </div>
        </div>
      </div>
    );
  }

  const def = view.c;
  const lay = layout && layout.key === viewKey(view) ? layout : null;
  return (
    <div className="jdn-tour">
      {lay && (
        <svg className="jdn-tour-mask" aria-hidden="true">
          {def.block && <rect width="100%" height="100%" fill="transparent" style={{ pointerEvents: 'all' }} />}
          <path fillRule="evenodd" fill="rgba(0,0,0,.65)" d={`M0 0H${lay.vw}V${lay.vh}H0Z${lay.holes.map(holePath).join('')}`} />
        </svg>
      )}
      <div
        ref={bubbleRef}
        className="jdn-tour-bubble"
        role="dialog"
        aria-live="polite"
        aria-labelledby="jdn-tour-title"
        tabIndex={-1}
        style={lay ? { transform: `translate(${lay.place.left}px, ${lay.place.top}px)` } : { visibility: 'hidden' }}
      >
        <div className="jdn-tour-float">
          {lay && lay.place.tailX !== null && lay.place.side !== 'over' && (
            <span className={`jdn-tour-tail is-${lay.place.side}`} style={{ transform: `translateX(${lay.place.tailX - 8}px) rotate(45deg)` }} aria-hidden="true" />
          )}
          <div className="jdn-tour-head">
            <span className="jdn-tour-badge">{view.step + 1} / {TOUR_TOTAL}</span>
            <span className="jdn-tour-bars" aria-hidden="true">
              {TOUR_STEPS.map((s, i) => <i key={s.id} className={i <= view.step ? 'on' : undefined} />)}
            </span>
          </div>
          <p id="jdn-tour-title" className="jdn-tour-title">{def.title}</p>
          {def.desc && <p className="jdn-tour-desc">{def.desc}</p>}
          {def.buttonLabel && <button type="button" className="jdn-tour-next" onClick={() => next(view.step)}>{def.buttonLabel}</button>}
        </div>
      </div>
      <button ref={skipRef} type="button" className="jdn-tour-skip" onClick={() => finish('skipped', view.step, false)}>건너뛰기</button>
    </div>
  );
}
