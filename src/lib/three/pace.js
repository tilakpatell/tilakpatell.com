// Keeping a scene smooth when it gets busy: how sharp to draw it, judged
// frame by frame.
//
// It watches the time between frames. A frame that came late (well past the
// display's own beat, and slower than about 45 a second) is a missed one; when
// a run of frames has too many, the scene is drawn a step less sharp at once,
// and again a moment later if that wasn't enough. Once frames have come on
// time for a while it goes back up a step, and if that brings the misses back
// straight away it waits twice as long before trying again (so it settles
// rather than see-sawing). One slow frame (a hiccup) never moves it, and
// neither does a pause (a tab in the background, the scene resting).
//
// The display's beat is read from the frames themselves (the quicker ones),
// and a fast screen isn't chased past what looks smooth. A beat that seems to
// have slowed is believed only slowly: from the frames alone, a graphics chip
// that can only manage 30 a second on a 60 Hz screen looks just like a laptop
// on battery capped at 30, and the first wants helping straight away; the
// second, at worst, is drawn a little softer for its first half a minute.
//
// At its softest with frames still late for `floorRuns` runs in a row (a
// few seconds), it calls `onFloor` once: by default lib/detail's
// `strained`, which holds a strong graphics card at the high detail level
// from then on, since ultra's textures and geometry turned out to be more
// than this machine could carry.
//
// createPace({ steps, window, missed, settle, wait, longest, floorRuns, onFloor }) →
//   { frame(now) → the new scale when it changes, else null, scale, level, reset() }
// `now` is the frame's timestamp (ms); the scale is one of `steps`, sharpest first.

import { strained } from '../detail';

export const STEPS = [1, 0.85, 0.72, 0.6, 0.5];

export function createPace({ steps = STEPS, window = 20, missed: tooMany = 0.25, settle = 600, wait = 4000, longest = 60000, floorRuns = 5, onFloor = strained } = {}) {
  let stuck = 0; // runs at the last step with frames still late (floorRuns once told)
  let level = 0;
  let last = 0;
  let beat = 1000 / 60; // the display's own, as read from the frames
  const recent = []; // the latest frame times, for reading the beat
  let n = 0; // frames in this run
  let late = 0; // missed among them
  let runStart = 0;
  let clean = 0; // ms of runs with nothing missed since the last change
  let changedAt = -Infinity;
  let upAt = -Infinity;
  let hold = wait; // ms of clean running before going back up a step

  const reset = () => {
    last = 0;
    n = 0;
    late = 0;
    clean = 0;
  };

  return {
    get scale() {
      return steps[level];
    },
    get level() {
      return level;
    },
    reset,
    frame(now) {
      const dt = now - last;
      const first = !last;
      last = now;
      // the first frame, or one after a pause: nothing to judge
      if (first || dt <= 0 || dt > 250) {
        n = 0;
        late = 0;
        runStart = now;
        return null;
      }
      recent.push(dt);
      if (recent.length > 60) recent.shift();
      n += 1;
      if (dt > Math.max(beat * 1.5, (1000 / 60) * 1.25) + 1) late += 1;
      if (n < window) return null;

      // the end of a run: what the beat is (a quick quarter of the latest
      // frames), and whether to change
      const sorted = recent.slice().sort((a, b) => a - b);
      const quick = Math.min(50, Math.max(4, sorted[Math.floor(sorted.length / 4)]));
      beat = quick < beat ? quick : beat + (quick - beat) * 0.05;
      const share = late / n;
      const took = now - runStart;
      n = 0;
      late = 0;
      runStart = now;
      if (share >= tooMany) {
        clean = 0;
        if (level >= steps.length - 1) {
          // as soft as it goes and still late: say so, once (lib/detail
          // holds a strong graphics card back at high next time)
          stuck += 1;
          if (stuck === floorRuns) onFloor?.();
          return null;
        }
        if (now - changedAt < settle) return null;
        // straight back down after going up: wait longer next time
        if (now - upAt < 5000) hold = Math.min(longest, hold * 2);
        level += 1;
        changedAt = now;
        return steps[level];
      }
      if (stuck < floorRuns) stuck = 0;
      if (share > 0) {
        clean = 0;
        return null;
      }
      clean += took;
      if (level === 0 || clean < hold) return null;
      level -= 1;
      clean = 0;
      changedAt = upAt = now;
      return steps[level];
    },
  };
}
