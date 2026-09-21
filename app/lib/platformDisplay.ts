export const PLATFORM_DISPLAY: Record<string, { label: string; icon: string }> = {
  steam: { label: 'Steam (PC)', icon: '🖥️' },
  ps4: { label: 'PlayStation 4', icon: '🎮' },
  ps5: { label: 'PlayStation 5', icon: '🎮' },
  xbox: { label: 'Xbox', icon: '🎮' },
  switch: { label: 'Nintendo Switch', icon: '🕹️' },
  vr: { label: 'VR (SteamVR / Oculus)', icon: '🥽' },
};

export function getPlatformInfo(code: string) {
  return PLATFORM_DISPLAY[code] || { label: code.toUpperCase(), icon: '🎮' };
}