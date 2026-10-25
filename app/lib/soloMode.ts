// 혼자 플레이 가능 여부 — solo_mode(story·possible·none)가 기준, 없을 때만 solo_playable로 대신한다
export type SoloMode = 'story' | 'possible' | 'none';
export const SOLO_MODES: readonly SoloMode[] = ['story', 'possible', 'none'];

export function soloPlayableFromMode(mode: SoloMode): boolean {
  return mode !== 'none';
}

export function isSoloPlayable(g: { solo_mode?: string | null; solo_playable?: boolean | null }): boolean | null {
  if (g.solo_mode === 'story' || g.solo_mode === 'possible') return true;
  if (g.solo_mode === 'none') return false;
  return g.solo_playable ?? null;
}
