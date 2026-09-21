export type PlatformCategory = 'pc' | 'playstation' | 'xbox' | 'switch' | 'vr';

const CATEGORY_MAP: Record<string, PlatformCategory> = {
  steam: 'pc',
  pc: 'pc',
  ps4: 'playstation',
  ps5: 'playstation',
  xbox: 'xbox',
  switch: 'switch',
  vr: 'vr',
};

export const CATEGORY_LABEL: Record<PlatformCategory, string> = {
  pc: 'PC',
  playstation: 'PlayStation',
  xbox: 'Xbox',
  switch: 'Nintendo Switch',
  vr: 'VR',
};

export function getPlatformCategories(codes: string[] = []): PlatformCategory[] {
  const set = new Set<PlatformCategory>();
  codes.forEach((c) => {
    const cat = CATEGORY_MAP[c.toLowerCase()];
    if (cat) set.add(cat);
  });
  return Array.from(set);
}