// A fixed step for anything that decides rather than draws: Fiedler's
// accumulator, so a brain thinks at the same rate on a 144 Hz screen as on a
// 30 Hz phone and a replay with the same seed goes the same way. A frame's
// time goes into the accumulator and comes out in whole steps; a long frame
// (a tab coming back, a stall while a model loads) runs at most `max` steps
// and drops the rest, never fast-forwarding through the time it was away,
// because catching up would spend the next frame catching up too. Pure, no
// three.js and no clock of its own: the caller hands it each frame's dt.
//
//   createFixedStep({ hz = 30, max = 4 }) → { step(dt, fn) → n, alpha() → 0..1, reset() }
//     step: fn(1 / hz) called n times (0..max); dt in seconds, a negative or
//       missing one counts as 0
//     alpha: how far into the next step the leftover time is, for a drawing
//       layer that interpolates between the last two steps
//     reset: empties the accumulator (call it on visibilitychange)

// Float sums of a step's dt (0.1 + 0.1 + 0.1) land a hair short of the
// step; this lets them count as the whole step they are meant to be.
const EPS = 1e-9;

export function createFixedStep({ hz = 30, max = 4 } = {}) {
  const stepDt = 1 / hz;
  let acc = 0;

  return {
    step(dt, fn) {
      if (dt > 0) acc += dt;
      let n = 0;
      while (n < max && acc + EPS >= stepDt) {
        acc -= stepDt;
        n++;
        fn(stepDt);
      }
      // Clamped: what's left over a whole step is time the loop couldn't keep
      // up with; keep only the fraction so alpha still reads true.
      if (acc + EPS >= stepDt) acc %= stepDt;
      if (acc < 0 || acc + EPS >= stepDt) acc = 0;
      return n;
    },
    alpha: () => Math.min(1, acc / stepDt),
    reset() {
      acc = 0;
    },
  };
}
