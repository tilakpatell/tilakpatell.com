// The frame cadence a world is drawn at (GPU-first lane N2): every display
// beat, or every second one for a visitor who pins 30 (`?fps=30`, or
// localStorage 'tp-fps', which lane N6's settings line writes), so the
// frames land 33.3 ms apart exactly on a 60 Hz screen (lib/three/loop's
// cadence).
//
// Every other world starts at every beat, T0 too (the owner's word on
// 2026-10-13: 30 to 60 fps, as near 60 as the chip holds) and
// createCadence settles it: under 50 fps for CADENCE.dropMs with nothing
// left to lower (the resolution at its floor, or a frame bound by the main
// thread, which no resolution helps), every second beat, an even 30 rather
// than a ragged 40; back to every beat once the frame's own work (the GPU
// clock's time or the main thread's, whichever is longer) has been under
// CADENCE.climb of the 60 fps budget for CADENCE.climbMs. A pin is held.
//
// readFps(win) → 30 | 60 | null
// cadenceFor({ fps }) → 1 | 2
// createCadence({ fps, …CADENCE }) → { every, frame(now, { interval, cpuMs, gpuMs, floored }) → 1 | 2 | null }

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

export function cadenceFor({ fps = null } = {}) {
  return fps === 30 ? 2 : 1;
}

export const CADENCE = {
  budgetMs: 16.7, // a 60 Hz beat
  slowMs: 20, // a median frame over this is under 50 fps: not holding 60
  dropMs: 2000,
  climbMs: 3000,
  climb: 0.8, // of the budget, the work's median before a climb (headroom: no see-saw)
  warmMs: 3000, // a world's first frames carry its arrival (the runtime's WARM_UP)
  window: 30, // frames the medians are taken over
  pauseMs: 250, // a frame this long is a pause, not a frame (pace.js's cut)
  _source: 'the every-chip-plays design (2026-10-13): 60 where the chip holds it, an even 30 where it cannot',
};

const median = (xs) => {
  const s = xs.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function createCadence({ fps = null, budgetMs = CADENCE.budgetMs, slowMs = CADENCE.slowMs, dropMs = CADENCE.dropMs, climbMs = CADENCE.climbMs, climb = CADENCE.climb, warmMs = CADENCE.warmMs, window = CADENCE.window, pauseMs = CADENCE.pauseMs } = {}) {
  const pinned = fps === 30 || fps === 60;
  let every = cadenceFor({ fps });
  let first = null;
  let since = null; // when the frames first called for a change
  const xs = [];
  return {
    get every() {
      return every;
    },
    frame(now, { interval = 0, cpuMs = 0, gpuMs = null, floored = false } = {}) {
      if (pinned) return null;
      first ??= now;
      if (now - first < warmMs) return null;
      // at every beat the frames' interval says whether 60 holds; at every
      // second the interval is 33.3 by construction, so the work says
      const x = every === 1 ? interval : Math.max(cpuMs ?? 0, gpuMs ?? 0);
      if (!(x > 0) || x > pauseMs) return null;
      xs.push(x);
      if (xs.length > window) xs.shift();
      const m = xs.length >= window / 2 ? median(xs) : null;
      // (a frame the chip draws slowly is the resolution's to fix first; one
      // with no clock to say is the pace's, until it has floored)
      const gpuBound = gpuMs == null || gpuMs >= cpuMs;
      const wants = m !== null && (every === 1 ? m > slowMs && (floored || !gpuBound) : m < climb * budgetMs);
      if (!wants) {
        since = null;
        return null;
      }
      since ??= now;
      if (now - since < (every === 1 ? dropMs : climbMs)) return null;
      every = every === 1 ? 2 : 1;
      since = null;
      xs.length = 0;
      return every;
    },
  };
}
