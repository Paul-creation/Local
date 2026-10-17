// 활동 제보 공통 로직 (브라우저·서버 모두 import 가능 — 비밀 값 넣지 말 것)
// - missing: 빠진 활동 → 승인하면 activities_confirmed에 추가 (확인 중에 있었으면 거기서 뺌)
// - wrong: 틀린 활동 → 승인하면 confirmed에서 빼서 unsure로 옮김, unsure에 있던 것이면 그냥 뺌
// 자동 반영은 하지 않고 관리자 승인으로만 적용
// import 없는 순수 함수 (테스트가 직접 불러옴). 분류표 순서는 호출하는 쪽이 ACTIVITY_KEYS로 넘김
export const REPORT_KINDS = { missing: '빠진 활동', wrong: '틀린 활동' } as const;
export type ReportKind = keyof typeof REPORT_KINDS;
export const isReportKind = (v: unknown): v is ReportKind => typeof v === 'string' && v in REPORT_KINDS;
export const MIN_REPORTERS = 3;

export function applyApproval(kind: ReportKind, key: string, confirmed: string[], unsure: string[], keyOrder: readonly string[]) {
  const order = (keys: string[]) => keyOrder.filter((k) => keys.includes(k));
  if (kind === 'missing') {
    return { confirmed: order([...confirmed, key]), unsure: order(unsure.filter((k) => k !== key)) };
  }
  const wasConfirmed = confirmed.includes(key);
  return {
    confirmed: order(confirmed.filter((k) => k !== key)),
    unsure: order(wasConfirmed ? [...unsure, key] : unsure.filter((k) => k !== key)),
  };
}

// 제보를 지금 상태에 대해 낼 수 있는지: 빠진 활동은 확정에 없어야 하고, 틀린 활동은 지금 보이는 칩(확정·확인 중)이어야 함
export const reportable = (kind: ReportKind, key: string, confirmed: string[], unsure: string[]) =>
  kind === 'missing' ? !confirmed.includes(key) : confirmed.includes(key) || unsure.includes(key);

type Row = { game_id: string; activity_key: string; kind: ReportKind; created_at: string };
export type ReportGroup = { gameId: string; key: string; kind: ReportKind; count: number; latest: string };

// 게임·키·종류별로 묶고 제보자 수(행 수 — 같은 사람 중복은 DB 유니크로 막힘)가 MIN_REPORTERS 이상인 묶음을 위로
export function groupReports(rows: Row[]): ReportGroup[] {
  const map = new Map<string, ReportGroup>();
  for (const r of rows) {
    const id = `${r.game_id}:${r.activity_key}:${r.kind}`;
    const g = map.get(id) || { gameId: r.game_id, key: r.activity_key, kind: r.kind, count: 0, latest: r.created_at };
    g.count++;
    if (r.created_at > g.latest) g.latest = r.created_at;
    map.set(id, g);
  }
  const hot = (g: ReportGroup) => (g.count >= MIN_REPORTERS ? 1 : 0);
  return [...map.values()].sort((a, b) => hot(b) - hot(a) || b.count - a.count || b.latest.localeCompare(a.latest));
}
