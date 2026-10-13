// The dynamic-resolution controller (GPU-first lane N2): how far under the
// screen a `'nodes'` world draws inside its post chain, set by what the
// graphics chip itself says the frame took (lib/three/gpuTime's
// `timestamp-query` clock), with the shape and the numbers of Unreal's
// r.DynamicRes.* controller. The screen's size never changes: only the
// chain's internal scale moves (quality.js's headroomAt reads `level`),
// so the temporal history is never thrown away. Pure.
//
// What it does with each frame's GPU time:
// - a frame with no reading (`null`: the clock not back yet) is ignored; one
//   over 250 ms is a pause (the tab hidden), dropped as pace.js drops it;
// - each is kept as its cost a unit of area (ms ÷ scale²), so the history's
//   median predicts the time at any step (cost × step²), and a change of
//   scale does not empty it;
// - `panic` frames in a row over the budget drop a step at once;
// - otherwise, with `history` frames kept and `minPeriod` since the last
//   change, a median over the target (the budget less its headroom) goes
//   down to the sharpest step whose prediction fits (or the floor), and
//   one under 0.8 of it goes up a step when the step's own prediction
//   fits (so a climb never lands on a step it would leave at once);
// - a change smaller than `threshold` of the scale is not made (the next
//   step past it is taken instead).
//
// createDynres({ budgetMs, headroom, threshold, minPeriod, history, panic,
//   floor, ceiling, steps }) → { frame(gpuMs) → the new scale | null, scale,
//   level, floored, frames, set(level), reset() }
// dynresFor({ tier, fps }) → the options for a tier and a pinned rate
// `level` is the index into `steps` (RESOLUTION_STEPS: 1, .77, .67, .5), the
// level headroomAt takes; steps outside floor…ceiling are never used.

// Epic's documentation, "Dynamic Resolution" (r.DynamicRes.FrameTimeBudget,
// .TargetedGPUHeadRoomPercentage, .ChangePercentageThreshold,
// .MinResolutionChangePeriod, .HistorySize, .MaxConsecutiveOverbudgetGPUFrameCount),
// as the research note (docs/research/2026-10-11-ue5-on-webgpu-gpu-first-renderer.md)
// and the spec's §4 "N2" set them; the floor from TSR's feed and FSR2's
// Balanced tier (1 ÷ 1.7 = 0.59): under 0.58 reads as soft
export const DYNRES = {
  budgetMs: 16.7,
  headroom: 0.1,
  threshold: 0.05,
  minPeriod: 8,
  history: 16,
  panic: 3,
  floor: 0.67,
  ceiling: 1,
  _source: 'Epic, “Dynamic Resolution” (r.DynamicRes.*); the GPU-first spec §4 “N2”',
};
// a 30 fps budget (a phone's tier, or a visitor who pins 30) and its floor
export const DYNRES_30 = { budgetMs: 33.3, _source: '1000 ÷ 30, the spec’s §4 “N2”' };
export const FLOOR_T0 = { floor: 0.58, _source: 'the spec’s §4 “N2”: 0.58 on T0' };
// (a frame this long is a pause, not a frame: pace.js's own cut)
export const PAUSE_MS = 250;
// the median under this share of the target before a climb
export const CLIMB = 0.8;
// the internal steps (quality.js's RESOLUTION_STEPS; repeated so this stays pure of quality.js's imports)
export const STEPS = [1, 0.77, 0.67, 0.5];

// (T0 is lane N6's phone tier; the low tier of today keeps its own ways: the spec's §6)
const isT0 = (tier) => tier === 'T0';

export function dynresFor({ tier = null, fps = null } = {}) {
  return {
    // (T0 aims at 60 too, under its lower floor: the cadence takes it to 30 when it cannot)
    budgetMs: fps === 30 ? DYNRES_30.budgetMs : DYNRES.budgetMs,
    floor: isT0(tier) ? FLOOR_T0.floor : DYNRES.floor,
  };
}

const median = (xs) => {
  const s = xs.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function createDynres({ budgetMs = DYNRES.budgetMs, headroom = DYNRES.headroom, threshold = DYNRES.threshold, minPeriod = DYNRES.minPeriod, history = DYNRES.history, panic = DYNRES.panic, floor = DYNRES.floor, ceiling = DYNRES.ceiling, steps = STEPS } = {}) {
  const top = Math.min(1, ceiling);
  // the steps it may use, sharpest first, with their index in `steps`
  const usable = steps.map((s, i) => [s, i]).filter(([s]) => s <= top + 1e-9 && s >= floor - 1e-9);
  if (!usable.length) usable.push([steps.at(-1), steps.length - 1]);
  const target = budgetMs * (1 - headroom);
  const costs = []; // ms ÷ scale², the latest `history`
  let at = 0; // index into usable
  let since = 0; // frames since the last change
  let over = 0; // frames in a row over the budget

  const scale = () => usable[at][0];
  const go = (next) => {
    at = next;
    since = 0;
    over = 0;
    return scale();
  };
  // the next usable step down (or up) from here at least `threshold` away
  const away = (dir) => {
    for (let i = at + dir; i >= 0 && i < usable.length; i += dir) if (Math.abs(usable[i][0] - scale()) >= threshold * scale()) return i;
    return null;
  };

  const reset = () => {
    at = 0;
    costs.length = 0;
    since = 0;
    over = 0;
  };

  return {
    get scale() {
      return scale();
    },
    get level() {
      return usable[at][1];
    },
    // (at the floor: nothing left to lower)
    get floored() {
      return at === usable.length - 1;
    },
    get frames() {
      return costs.length;
    },
    set(level) {
      const i = usable.findIndex(([, l]) => l >= level);
      go(i < 0 ? usable.length - 1 : i);
    },
    reset,
    frame(ms) {
      if (ms == null || !Number.isFinite(ms) || ms <= 0) return null;
      if (ms > PAUSE_MS) {
        over = 0;
        return null;
      }
      const s = scale();
      costs.push(ms / (s * s));
      if (costs.length > history) costs.shift();
      since += 1;
      over = ms > budgetMs ? over + 1 : 0;
      if (over >= panic) {
        const down = away(1);
        over = 0;
        return down === null ? null : go(down);
      }
      if (costs.length < history || since < minPeriod) return null;
      const cost = median(costs);
      const now = cost * s * s;
      if (now > target) {
        let pick = null;
        for (let i = away(1); i !== null && i < usable.length; i++) {
          pick = i;
          if (cost * usable[i][0] ** 2 <= target) break;
        }
        return pick === null ? null : go(pick);
      }
      if (now < CLIMB * target) {
        const up = away(-1);
        if (up !== null && cost * usable[up][0] ** 2 <= target) return go(up);
      }
      return null;
    },
  };
}
