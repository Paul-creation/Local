// 사용자 PC와 게임 요구 사양(app/lib/specParse.ts의 결과)을 비교하는 판정 함수 — 순수 함수, 다른 파일을 가져오지 않는다
// 비교 규칙 (제조사 일치 비교)
// - 요구 사양의 같은 제조사 항목이 있으면 그것과 비교한다 (NVIDIA 사용자 → "NVIDIA GTX 1060"과, AMD 사용자 → "AMD RX 480"과)
// - 같은 제조사 항목이 없으면 적힌 항목 중 가장 높은 등급과 비교한다 (보수적) — Intel 내장·Arc도 같은 규칙
// - 모델명 없는 저사양 표기(low_spec)는 { any: 1 }이라 최저 등급 — 어떤 PC든 충족
// - 읽지 못한 칸(null)은 "판정 불가"이고, 읽은 칸 중 하나라도 모자라면 판정 불가보다 "부족"이 먼저다
// - RAM은 사용자 값이 요구보다 작을 때만 부족. 요구 RAM을 읽지 못했으면 막지 않는다

export type Vendor = 'nvidia' | 'amd' | 'intel';
export type VendorTiers = Partial<Record<Vendor | 'any', number>>;
export type UserPart = { vendor: Vendor; tier: number };
export type UserPc = { cpu: UserPart; gpu: UserPart; ram_gb: number };
export type SpecLike = { cpu: VendorTiers | null; gpu: VendorTiers | null; ram_gb: number | null };
export type LevelResult = { cpu: boolean | null; gpu: boolean | null; ram: boolean | null; result: 'pass' | 'fail' | 'unknown' };
export type Verdict = 'rec' | 'min' | 'insufficient' | 'unknown';
export type GameJudgement = { verdict: Verdict; min: LevelResult | null; rec: LevelResult | null; failed: ('cpu' | 'gpu' | 'ram')[] };

// 사용자 제조사 기준으로 비교할 요구 등급 (없으면 null)
export function requiredTier(req: VendorTiers | null | undefined, vendor: Vendor): number | null {
  if (!req) return null;
  const own = req[vendor];
  if (own != null) return own;
  const all = Object.values(req).filter((n): n is number => typeof n === 'number');
  return all.length ? Math.max(...all) : null;
}

// 부품 하나: true 충족 · false 부족 · null 요구를 읽지 못함
export function partMeets(user: UserPart, req: VendorTiers | null | undefined): boolean | null {
  const need = requiredTier(req, user.vendor);
  return need == null ? null : user.tier >= need;
}

// 사양 한 단계(최소 또는 권장)
export function judgeLevel(user: UserPc, spec: SpecLike): LevelResult {
  const cpu = partMeets(user.cpu, spec.cpu);
  const gpu = partMeets(user.gpu, spec.gpu);
  const ram = spec.ram_gb == null ? null : user.ram_gb >= spec.ram_gb;
  const result = cpu === false || gpu === false || ram === false ? 'fail' : cpu === true && gpu === true ? 'pass' : 'unknown';
  return { cpu, gpu, ram, result };
}

// 게임 하나: 권장 충족 > 최소 충족 > 부족 > 판정 불가
// - 최소 사양을 읽지 못했으면 판정 불가, 최소에서 부족한 부품이 있으면 부족(부족한 부품 목록 포함)
// - 최소를 충족하고 권장도 읽었으며 권장까지 충족하면 권장 충족. 권장이 없거나 읽지 못했거나 모자라면 최소 충족
export function judgeGame(user: UserPc, parsed: { min: SpecLike | null; rec: SpecLike | null } | null | undefined): GameJudgement {
  const min = parsed?.min ? judgeLevel(user, parsed.min) : null;
  const rec = parsed?.rec ? judgeLevel(user, parsed.rec) : null;
  if (!min) return { verdict: 'unknown', min, rec, failed: [] };
  if (min.result === 'fail') return { verdict: 'insufficient', min, rec, failed: (['cpu', 'gpu', 'ram'] as const).filter((k) => min[k] === false) };
  if (min.result === 'unknown') return { verdict: 'unknown', min, rec, failed: [] };
  return { verdict: rec?.result === 'pass' ? 'rec' : 'min', min, rec, failed: [] };
}

// ── 상세 페이지 판정 한 줄용 (3단계) ──
// 권장 충족 / 최소 충족 / 최소 미달 + 두 가지 플래그. 위의 judgeGame과 달리 읽지 못한 칸이 있어도 읽은 칸만으로 판정한다
// - 최소(min): 읽힌 항목(CPU·GPU·RAM)만으로 판정. 하나라도 못 읽었으면 partial 플래그. 세 항목이 전부 안 읽혔거나 min이 없으면 null (줄을 숨김)
// - 권장(rec): rec가 없거나 CPU·GPU·RAM 중 하나라도 못 읽었으면 최소 기준으로만 판정하고 recMissing 플래그 (권장 충족은 나오지 않음)
export type PcPart = 'cpu' | 'gpu' | 'ram';
export type PcVerdict = {
  level: 'rec' | 'min' | 'fail';
  failed: PcPart[]; // level이 fail일 때 미달 항목
  recMissing: boolean; // 권장 사양 정보 부족
  partial: boolean; // 최소 사양 일부만 확인됨
};

const readable = (s: SpecLike) => ({ cpu: s.cpu != null, gpu: s.gpu != null, ram: s.ram_gb != null });
// 최소 사양 세 항목 중 하나라도 읽혔는지 — 사용자 입력과 무관 (false면 판정 줄 자체를 숨긴다)
export const hasJudgeableSpec = (parsed: { min?: SpecLike | null } | null | undefined) => {
  const m = parsed?.min;
  return !!m && (m.cpu != null || m.gpu != null || m.ram_gb != null);
};

export function judgePc(user: UserPc, parsed: { min?: SpecLike | null; rec?: SpecLike | null } | null | undefined): PcVerdict | null {
  const min = parsed?.min;
  if (!min || !hasJudgeableSpec(parsed)) return null;
  const r = readable(min);
  const partial = !(r.cpu && r.gpu && r.ram);
  const rec = parsed?.rec ?? null;
  const recReadable = !!rec && readable(rec).cpu && readable(rec).gpu && readable(rec).ram;
  const level = judgeLevel(user, min);
  const failed = (['cpu', 'gpu', 'ram'] as const).filter((k) => level[k] === false);
  if (failed.length) return { level: 'fail', failed: [...failed], recMissing: !recReadable, partial };
  const recPass = recReadable && judgeLevel(user, rec!).result === 'pass';
  return { level: recPass ? 'rec' : 'min', failed: [], recMissing: !recReadable, partial };
}

const PART_LABEL: Record<PcPart, string> = { cpu: '프로세서', gpu: '그래픽카드', ram: '메모리' };

// 판정 문구 — 본문과 플래그(서브 텍스트 토큰으로 따로 그림)를 나눠 돌려준다
export function verdictText(v: PcVerdict): { main: string; flags: string[] } {
  const main = v.level === 'rec' ? '권장 사양 충족' : v.level === 'min' ? '최소 사양 충족' : `최소 사양 미달 (${v.failed.map((k) => PART_LABEL[k]).join('·')})`;
  const flags = [v.recMissing && '권장 사양 정보 부족', v.partial && '일부 사양만 확인됨'].filter((f): f is string => !!f);
  return { main, flags };
}
