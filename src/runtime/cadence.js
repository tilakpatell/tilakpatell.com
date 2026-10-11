// The frame cadence a world is drawn at (GPU-first lane N2): every display
// beat, or every second one for a visitor who pins 30 (`?fps=30`, or
// localStorage 'tp-fps', which lane N6's settings line writes) or on
// lane N6's phone tier (T0), so the frames land 33.3 ms apart exactly on a
// 60 Hz screen (lib/three/loop's cadence). A pin of 60 on T0 is taken as
// given. The low tier of today keeps every beat (the spec's §6).
//
// readFps(win) → 30 | 60 | null
// cadenceFor({ tier, fps }) → 1 | 2

export const FPS_KEY = 'tp-fps';
export const PINS = [30, 60];

export function readFps(win = typeof window !== 'undefined' ? window : undefined) {
  const pick = (v) => (PINS.includes(Number(v)) ? Number(v) : null);
  try {
    const asked = new URLSearchParams(win?.location?.search ?? '').get('fps');
    if (asked != null) return pick(asked);
    return pick(win?.localStorage?.getItem(FPS_KEY));
  } catch {
    return null;
  }
}

export function cadenceFor({ tier = null, fps = null } = {}) {
  if (fps === 30) return 2;
  if (fps === 60) return 1;
  return tier === 'T0' ? 2 : 1;
}
