// One quality level for the runtime: the device's tier and its budget
// (lib/device), the pace that softens the picture when frames come late
// (lib/three/pace), and a floor under it: when the pace has been at its
// last step for `floorAfter` ms of frames and the frames are still late
// there (the pace's `stuck`), the level goes one past the steps, once, so a
// module can shed its own effects (what a scene's `onSlow` meant). Each
// world starts afresh (the runtime calls reset() and hold() as it starts it):
// back at the sharpest, and its first few seconds of frames let go by
// unjudged (`hold(ms)`, from the first frame after it), since an arrival's
// hitches (models arriving, shaders linking, the page's HUD going up) say
// nothing of how the world will run. The pixel ratio to draw at is
// the screen's own (`dpr`), or the budget's least where that's more
// (`minRatio`: a 1× screen draws at 1.25 on the high tier, 1.5 with a
// strong card, as lib/device's pixelRatio has it for every renderer),
// never past the budget's most, under a module's cap where it has one
// (`ratioUnder`), × scale; the runtime sets it on the renderer, and
// nothing else does. The visitor's sharpness (the settings panel,
// lib/device's `sharpness()`) scales the screen's ratio instead, still
// under the budget's: a sharpness they picked is taken as given, so the
// least applies only to the one picked for them; a quality level picked
// while a world is up swaps the budget (`retune`).
//
// The budget row is the level's (lib/device's detail: an ultra desktop
// starts on the ultra row, more samples and a bigger shadow map), the tier
// still the tier.
//
// createQuality({ tier, detail, pace, floorAfter, dpr, minRatio, sharp }) → { tier,
//   budget, level, scale, ratio, ratioUnder(cap, { unscaled }), on(fn) → undo,
//   frame(now) → the new level or null, reset(), hold(ms), retune(level),
//   setSharpness(k), setLevel(step) }
// (`setLevel`: a calibrated step of the pace, held as its ceiling:
// lib/three/calibrate)
//
// headroomAt(level, { tier, pixels }) → { scale, shed } (fidelity lane U):
// what a lit post chain (lib/three/light/post.js's `headroom`) draws at a
// pace level, for a module that softens through its own chain. The first
// steps lower the internal resolution (RESOLUTION_STEPS, upscaled back to
// the screen by FSR1 or TAAU) before any pass is shed; past the last
// resolution step each level sheds one more of post.js's SHED groups. On a
// drawing buffer of 4K or more, ultra starts under the screen at 0.77 and
// high at 0.67 (UHD_START: the fidelity design's "Lane U").

import { BUDGETS, device, sharpness } from '../lib/device';
import { STEPS, createPace } from '../lib/three/pace';

// the internal resolutions the pace steps down through before shedding passes
export const RESOLUTION_STEPS = [1, 0.77, 0.67, 0.5];
// a 4K drawing buffer's pixels, and where ultra and high start on one
export const UHD = 3840 * 2160;
export const UHD_START = { ultra: 0.77, high: 0.67 };

export function headroomAt(level = 0, { tier = null, pixels = 0 } = {}) {
  const start = pixels >= UHD ? (UHD_START[tier] ?? 1) : 1;
  const steps = [start, ...RESOLUTION_STEPS.filter((s) => s < start)];
  const l = Math.max(0, Math.floor(level));
  if (l < steps.length) return { scale: steps[l], shed: 0 };
  return { scale: steps.at(-1), shed: l - steps.length + 1 };
}

export function createQuality({ tier, detail, pace = createPace(), floorAfter = 2500, dpr = Infinity, minRatio = null, sharp = sharpness() } = {}) {
  // (a tier given alone is its own level: the tests, a forced tier)
  detail ??= tier ?? device().detail;
  tier ??= device().tier;
  let budget = BUDGETS[detail] ?? BUDGETS[tier] ?? BUDGETS.high;
  let k = sharp;
  // the screen's ratio, or the budget row's least where that's more (its
  // own row's unless given); a sharpness the visitor set scales the
  // screen's alone
  const least = () => minRatio ?? budget.minRatio ?? 0;
  const screen = () => (k === 1 ? Math.max(dpr, least()) : dpr * k);
  const sharpest = (cap) => Math.min(cap ?? Infinity, budget.ratio, screen());
  const last = STEPS.length - 1;
  const listeners = new Set();
  let level = 0;
  let scale = 1;
  let atLastSince = null; // when the pace reached its last step
  let floored = false;
  let holdFor = 0; // ms of frames to let go by unjudged (hold)
  let heldTill = null; // till when: from the first frame after the hold was asked for
  const tell = (l) => {
    for (const fn of listeners) fn(l);
  };
  return {
    tier,
    get budget() {
      return budget;
    },
    get level() {
      return level;
    },
    get scale() {
      return scale;
    },
    get ratio() {
      return sharpest() * scale;
    },
    // (`unscaled`: the level's ratio without the pace's scale, for a module
    // that softens through its own post chain and keeps its canvas as it is)
    ratioUnder(cap = Infinity, { unscaled = false } = {}) {
      return sharpest(cap) * (unscaled ? 1 : scale);
    },
    retune(level) {
      budget = BUDGETS[level] ?? BUDGETS.high;
    },
    setSharpness(next) {
      k = Number.isFinite(next) ? Math.min(2, Math.max(0.5, next)) : 1;
    },
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    frame(now) {
      if (holdFor) {
        heldTill ??= now + holdFor;
        // (none of it goes to the pace: its first frame after this starts its count)
        if (now < heldTill) return null;
        holdFor = 0;
        heldTill = null;
      }
      const changed = pace.frame(now);
      if (changed !== null && !floored) {
        scale = pace.scale;
        if (pace.level !== level) {
          level = pace.level;
          atLastSince = level === last ? now : null;
          tell(level);
          return level;
        }
      } else if (floored) {
        scale = STEPS[last];
      }
      // (only with frames still late at the last step: it used to floor on
      // the clock alone, even once frames there had caught up)
      if (!floored && level === last) {
        if (atLastSince === null) atLastSince = now;
        else if (now - atLastSince >= floorAfter && pace.stuck > 0) {
          floored = true;
          level = STEPS.length;
          tell(level);
          return level;
        }
      }
      return null;
    },
    setLevel(l) {
      pace.set?.(l);
      level = pace.level ?? l;
      scale = pace.scale ?? STEPS[level];
      atLastSince = null;
      tell(level);
    },
    reset() {
      pace.reset();
      level = 0;
      scale = 1;
      atLastSince = null;
      floored = false;
    },
    hold(ms) {
      holdFor = ms;
      heldTill = null;
    },
  };
}
