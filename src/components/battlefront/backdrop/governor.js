// How much the front end's room draws, held at 60 frames a second by
// measuring (the 2026-10-13 backdrop design, decision 6). A step is a pixel
// ratio (of the level's) and whether it animates; the last is a still, one
// frame a change. Every 60 frames drawn it counts the late ones (an
// interval over 1.4 times the frame aimed at); 6 or more step it down. Five
// clean windows in a row (at most one late) step it up, unless that step
// failed in the last 20 s. Pure.
//
// STEPS: [{ scale, still }]
// startStep({ level, page, reduced }) → the step to start at
// createGovernor({ start, now }) → { frame(dt, target) → a new step | null, step }

export const STEPS = [
  { scale: 1, still: false },
  { scale: 0.8, still: false },
  { scale: 0.65, still: false },
  { scale: 0.5, still: false },
  { scale: 0.5, still: true },
];

const WINDOW = 60;
const LATE = 6;
const CLEAN = 1;
const CLEAN_RUN = 5;
const LATE_OVER = 1.4;
const RETRY_MS = 20000;
const FROM_LEVEL = { ultra: 0, high: 0, mid: 1, low: 3 };

export function startStep({ level = 'high', page = false, reduced = false } = {}) {
  if (reduced) return STEPS.length - 1;
  return Math.min(STEPS.length - 1, (FROM_LEVEL[level] ?? 0) + (page ? 1 : 0));
}

export function createGovernor({ start = 0, now = () => performance.now() } = {}) {
  let step = Math.min(Math.max(0, start), STEPS.length - 1);
  let drawn = 0;
  let late = 0;
  let clean = 0;
  const failed = new Map(); // step → when it was stepped down from
  return {
    get step() {
      return step;
    },
    frame(dt, target) {
      drawn++;
      if (dt > target * LATE_OVER) late++;
      if (drawn < WINDOW) return null;
      const lateNow = late;
      drawn = 0;
      late = 0;
      if (lateNow >= LATE) {
        clean = 0;
        if (step >= STEPS.length - 1) return null;
        failed.set(step, now());
        return ++step;
      }
      clean = lateNow <= CLEAN ? clean + 1 : 0;
      if (clean < CLEAN_RUN) return null;
      clean = 0;
      if (step === 0) return null;
      const when = failed.get(step - 1);
      if (when != null && now() - when < RETRY_MS) return null;
      return --step;
    },
  };
}
