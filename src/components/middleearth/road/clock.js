// The clock: how far along the Road the visitor is, step by step. Pure.
//
//   newClock({ s, auto, reduced }) → { s, mode, held, auto, speed, pausedUntil, t, holdLeft, reduced }
//   step(state, dt, input, ctx) → state
//     input: { walk, run, back, toggleAuto, next } (booleans, the frame’s)
//     ctx: { total (metres), holdAt(s) → seconds | 0, nextBeat(s) → s | null, pace? }
//   rideSeconds(stages, holdsOf) → seconds: the ledger, every stage at a walk plus its holds
//
// Auto-walk (on by default, Space) walks at the same pace as a held W and
// holds at a beat for the beat’s seconds while its scene plays; a visitor
// walking on through it doesn’t wait, as a scene would play on behind
// them. Any key held pauses auto for PAUSE_AFTER_INPUT, so a hand that
// lets go isn’t carried off at once. Under reduced motion nothing moves on
// its own: Next steps from beat to beat, each a still. `pace` is the
// travel mode’s share of the speeds (a climb halves them).

export const WALK = 2.5; // m/s: a film’s walk, not a hike
export const RUN = 6.0;
export const BACK = 1.5;
export const PAUSE_AFTER_INPUT = 6; // s
// each travel mode’s share of the speeds (stages/index.js’s MODES): a climb
// halves them, a horse at a gallop more than doubles them, the eagles fly
// at 40 m/s; the ledger counts every stage at the walk, so a faster mode
// only shortens the ride it promises
export const PACE = { walk: 1, horse: 2.4, climb: 0.5, boat: 1, carried: 0.6, eagle: 16, ship: 0.6 };

export function newClock({ s = 0, auto = true, reduced = false } = {}) {
  return { s, mode: 'idle', held: false, auto: auto && !reduced, speed: 0, pausedUntil: 0, t: 0, holdLeft: 0, reduced };
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function step(state, dt, input, ctx) {
  const t = state.t + dt;
  const auto = input.toggleAuto && !state.reduced ? !state.auto : state.auto;
  const held = Boolean(input.walk || input.run || input.back);
  const pausedUntil = held ? t + PAUSE_AFTER_INPUT : state.pausedUntil;
  const pace = ctx.pace ?? 1;
  const next = { ...state, t, auto, held, pausedUntil };

  if (state.reduced && input.next) {
    const to = ctx.nextBeat(state.s);
    return { ...next, s: to ?? 1, mode: 'still', speed: 0, holdLeft: 0 };
  }
  if (held) {
    const speed = (input.run ? RUN : input.walk ? WALK : -BACK) * pace;
    const mode = input.run ? 'run' : input.walk ? 'walk' : 'back';
    // (a hand on the keys ends any hold: the scene plays on behind them)
    return { ...next, s: clamp01(state.s + (speed * dt) / ctx.total), speed, mode, holdLeft: 0 };
  }
  if (!auto || t < pausedUntil) return { ...next, speed: 0, mode: state.mode === 'still' ? 'still' : 'idle' };
  if (state.holdLeft > 0) return { ...next, speed: 0, mode: 'hold', holdLeft: Math.max(0, state.holdLeft - dt) };

  const speed = WALK * pace;
  let s = clamp01(state.s + (speed * dt) / ctx.total);
  const beat = ctx.nextBeat(state.s);
  if (beat != null && s >= beat) {
    const hold = ctx.holdAt(beat);
    if (hold > 0) return { ...next, s: beat, speed: 0, mode: 'hold', holdLeft: hold };
  }
  return { ...next, s, speed, mode: 'walk' };
}

export const rideSeconds = (stages, holdsOf) => stages.reduce((a, st) => a + st.length / WALK + holdsOf(st), 0);
