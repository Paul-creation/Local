// 히어로 표지 벽 배치 — 밝은 표지와 어두운 표지를 번갈아 놓아 어느 폭에서 봐도 왼쪽·오른쪽 밝기가 비슷하게 하고, 협동 게임과 명작도 번갈아 놓는다
// 밝기는 세로 표지를 20×30으로 줄여 흑백 평균을 낸 값(0~255), 2026-10-25 측정. 목록에 없는 표지는 DEFAULT_LUM으로 본다
export const HERO_LUM: Record<string, number> = {
  'Overcooked! 2': 131, 'Grounded': 108, 'Raft': 148, 'Valheim': 46, 'Split Fiction': 131, 'HELLDIVERS™ 2': 76, 'Dead by Daylight': 57, 'Sea of Thieves: 2026 Edition': 131, 'Deep Rock Galactic': 89, 'PEAK': 134,
  'Palworld / 팰월드': 147, 'Among Us': 52, 'Monster Hunter Wilds': 106, 'Rust': 62, "Don't Starve Together": 65, 'R.E.P.O.': 42, 'Lethal Company': 69, 'Phasmophobia': 44, 'PUBG: BATTLEGROUNDS': 96, 'It Takes Two': 156,
  "Baldur's Gate 3": 75, 'Cyberpunk 2077': 113, 'ELDEN RING': 63, 'Stardew Valley': 129, 'Portal 2': 125, 'Red Dead Redemption 2': 86, "No Man's Sky": 127, 'Terraria': 106, '더 위쳐 3: 와일드 헌트 - 컴플리트 에디션': 111, 'Portal': 92,
  'Left 4 Dead 2': 96, 'NieR:Automata™': 134, 'Sekiro™: Shadows Die Twice - GOTY Edition': 51, 'Hollow Knight': 103, '클레르 옵스퀴르: 33 원정대': 69, 'Half-Life 2': 76, 'The Elder Scrolls V: Skyrim Special Edition': 32, 'Fallout 4': 186, 'RimWorld': 87, 'DARK SOULS™ III': 98,
  'Divinity: Original Sin 2 - Definitive Edition': 56, 'Factorio': 86, 'Hades': 78, 'Hades II': 64, '인슈라오디드 (Enshrouded)': 111, 'ARC Raiders': 64, 'Team Fortress 2': 126, 'Apex 레전드™': 89, '톰 클랜시의 레인보우식스 시즈': 71, 'War Thunder': 103, 'EA SPORTS FC™ 27': 125,
};
const DEFAULT_LUM = 100;
const lumOf = (name: string) => HERO_LUM[name] ?? DEFAULT_LUM;

// 어두운 것·밝은 것을 번갈아 (가장 어두운 것, 가장 밝은 것, 둘째로 어두운 것, ...) — 앞쪽 몇 장만 봐도 평균이 전체 평균에 가깝다
function zigzag<T extends { name: string }>(rows: T[]): T[] {
  const sorted = [...rows].sort((a, b) => lumOf(a.name) - lumOf(b.name) || a.name.localeCompare(b.name));
  const out: T[] = [];
  let lo = 0; let hi = sorted.length - 1;
  while (lo <= hi) { out.push(sorted[lo++]); if (lo <= hi) out.push(sorted[hi--]); }
  return out;
}

export function arrangeHeroWall<T extends { name: string }>(coop: T[], singles: T[]): T[] {
  const a = zigzag(coop); const b = zigzag(singles);
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) { if (a[i]) out.push(a[i]); if (b[i]) out.push(b[i]); }
  return out;
}

// 폭 width(px)에서 보이는 열(타일 160 + 간격 4)을 반으로 갈라 왼쪽·오른쪽 평균 밝기를 돌려준다 (타일은 위에서 아래로 3장씩 한 열)
export function halfLums(names: string[], width: number): { left: number; right: number } {
  const cols = Math.min(Math.ceil(names.length / 3), Math.ceil(width / 164));
  const half = Math.ceil(cols / 2);
  const avg = (from: number, to: number) => { const t = names.slice(from * 3, to * 3); return t.reduce((s, n) => s + lumOf(n), 0) / t.length; };
  return { left: avg(0, half), right: avg(half, cols) };
}
