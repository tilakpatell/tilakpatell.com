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
// CADENCE.climb of the 60 fps budget for CADENCE.climbMs, or for
// CADENCE.blindClimbMs with no GPU clock (WebGL 2, the classic renderer),
// where the work at 30 is only the main thread's and says little of the
// chip; a climb that fails (a drop within CADENCE.failMs of it) doubles the
// next wait, to CADENCE.maxClimbMs at most, so 60 is tried again now and
// then and never see-saws. A pin is held. On a 120 or 144 Hz screen (the
// display's own beat, `beatMs`: lib/three/loop's `beat`) the steps are
// every beat, an even 60, an even 30, each by that beat; on 60 Hz they are
// every beat and every second, as ever.
//
// readFps(win) → 30 | 60 | null
// cadenceFor({ fps }) → 1 | 2
// createCadence({ fps, …CADENCE }) → { every, frame(now, { interval, cpuMs, gpuMs, floored, beatMs }) → the new cadence | null }

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
  blindClimbMs: 30000, // the climb's wait with no GPU clock to say what the chip has left
  failMs: 10000, // a drop this soon after a climb says the climb failed
  maxClimbMs: 300000,
  window: 30, // frames the medians are taken over
  pauseMs: 250, // a frame this long is a pause, not a frame (pace.js's cut)
  _source: 'the every-chip-plays design (2026-10-13): 60 where the chip holds it, an even 30 where it cannot',
};

const median = (xs) => {
  const s = xs.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// the cadences a beat can step through: every beat, an even 60, an even 30
export function ladder(beatMs = CADENCE.budgetMs) {
  const b = beatMs > 0 ? beatMs : CADENCE.budgetMs;
  return [...new Set([1, Math.max(1, Math.round(1000 / 60 / b)), Math.max(2, Math.round(1000 / 30 / b))])].sort((a, z) => a - z);
}

export function createCadence({ fps = null, budgetMs = CADENCE.budgetMs, slowMs = CADENCE.slowMs, dropMs = CADENCE.dropMs, climbMs = CADENCE.climbMs, blindClimbMs = CADENCE.blindClimbMs, failMs = CADENCE.failMs, maxClimbMs = CADENCE.maxClimbMs, climb = CADENCE.climb, warmMs = CADENCE.warmMs, window = CADENCE.window, pauseMs = CADENCE.pauseMs } = {}) {
  const pinned = fps === 30 || fps === 60;
  let every = cadenceFor({ fps });
  let first = null;
  let dropSince = null; // when the frames first called for a lower cadence
  let climbSince = null; // and for a higher one
  let climbedAt = null; // the last climb
  let backoff = 1; // the climb's wait multiplied, after each climb that failed
  const ints = []; // the drawn frames' intervals
  const works = []; // and their work, the longer of the main thread's and the chip's
  const push = (xs, x) => {
    xs.push(x);
    if (xs.length > window) xs.shift();
  };
  const settle = (next) => {
    every = next;
    dropSince = null;
    climbSince = null;
    ints.length = 0;
    works.length = 0;
    return every;
  };
  return {
    get every() {
      return every;
    },
    frame(now, { interval = 0, cpuMs = 0, gpuMs = null, floored = false, beatMs = budgetMs } = {}) {
      const steps = ladder(beatMs);
      if (pinned) {
        // (a pinned 60 is every beat: 60 at the least, and a 120 or 144 Hz
        // screen's own rate where the chip keeps up, the owner's word that
        // faster is fine; a pinned 30 is the even 30's rung)
        const want = fps === 30 ? steps.at(-1) : 1;
        return want === every ? null : settle(want);
      }
      first ??= now;
      if (now - first < warmMs) return null;
      if (!(interval > 0) || interval > pauseMs) return null;
      const work = Math.max(cpuMs ?? 0, gpuMs ?? 0);
      push(ints, interval);
      if (work > 0 && work <= pauseMs) push(works, work);
      const full = (xs) => xs.length >= window / 2;
      const beat = beatMs > 0 ? beatMs : budgetMs;
      const lower = steps.find((x) => x > every) ?? null;
      const higher = [...steps].reverse().find((x) => x < every) ?? null;
      // (a frame the chip draws slowly is the resolution's to fix first; one
      // with no clock to say is the pace's, until it has floored)
      const gpuBound = gpuMs == null || gpuMs >= cpuMs;
      // (not keeping this cadence: under 50 fps at every beat of a 60 Hz screen, slowMs)
      const late = Math.max(slowMs * (every * beat) / budgetMs, every * beat * 1.2);
      const wantsDown = lower !== null && full(ints) && median(ints) > late && (floored || !gpuBound);
      const wantsUp = !wantsDown && higher !== null && full(works) && median(works) < climb * higher * beat;
      if (wantsDown) {
        climbSince = null;
        dropSince ??= now;
        if (now - dropSince < dropMs) return null;
        // (down again this soon after a climb: the climb failed, and the next waits twice as long)
        backoff = climbedAt !== null && now - climbedAt < failMs ? Math.min(backoff * 2, maxClimbMs / climbMs) : 1;
        return settle(lower);
      }
      dropSince = null;
      if (!wantsUp) {
        climbSince = null;
        return null;
      }
      climbSince ??= now;
      const clocked = gpuMs != null;
      if (now - climbSince < Math.min(maxClimbMs, (clocked ? climbMs : blindClimbMs) * backoff)) return null;
      climbedAt = now;
      return settle(higher);
    },
  };
}
