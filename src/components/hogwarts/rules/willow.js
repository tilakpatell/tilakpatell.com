// The Whomping Willow’s temper (the design’s §4.3), pure: a tree that
// sways while nothing comes near, and when something comes within reach
// draws back the limb nearest it, strikes along it, and rests before it
// will strike again; a strike that lands throws you clear and costs a
// point; and a knock on the knot at its root (a stone dropped on it,
// Wingardium Leviosa’s way) holds it still for ten seconds. The Tentacula
// in the greenhouse is the same temper in a pot (`TENTACULA`): a short
// reach, a quick snap, a nudge rather than a throw.
//
//   WILLOW, TENTACULA: { reach, windup, strike, rest, frozen, throw, arc, limbs: [{ yaw, length }] }
//   newWillow(kind = WILLOW) → state { mode, t, limb, aim, frozen, swats, hits, ev }
//   stepWillow(state, dt, { you: [x, z] | null, knot: bool }, kind) → state
//     (`you` from the trunk; `knot`: something struck the knot this frame);
//     state.ev: this step’s events, [{ type: 'windup' | 'strike' | 'hit' | 'miss' | 'frozen' | 'thawed', … }],
//     a hit with `throw` [dx, dz] (metres, away from the trunk) and `points` −1
//   limbAngles(state, t, kind) → each limb’s yaw and lift now (radians): the idle sway and the strike, for the drawing
//   nearestLimb(kind, bearing) → the limb whose rest bearing is nearest
//
// Modes: 'idle' (swaying), 'windup' (the limb drawn back), 'strike' (it
// comes round along its arc to where you were when it began), 'rest' (it
// won’t strike again yet), 'frozen' (the knot struck: no strikes, no sway).

const TAU = Math.PI * 2;

// the limbs round the trunk: their bearings (yaw from +z) and lengths
const ring = (n, length, jitter) => Array.from({ length: n }, (_, i) => ({ yaw: (i / n) * TAU + jitter * Math.sin(i * 2.7), length: length * (0.86 + 0.14 * Math.cos(i * 1.9)) }));

export const WILLOW = { reach: 12, windup: 0.55, strike: 0.38, rest: 2.4, frozen: 10, throw: 6, arc: 0.55, points: -1, limbs: ring(9, 12, 0.3) };
export const TENTACULA = { reach: 2.6, windup: 0.25, strike: 0.18, rest: 1.6, frozen: 10, throw: 1.2, arc: 0.7, points: 0, limbs: ring(5, 2.4, 0.4) };

export function newWillow() {
  return { mode: 'idle', t: 0, limb: -1, aim: 0, frozen: 0, swats: 0, hits: 0, ev: [] };
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function nearestLimb(kind, bearing) {
  let best = 0;
  let bestD = Infinity;
  kind.limbs.forEach((l, i) => {
    const d = Math.abs(wrap(l.yaw - bearing));
    if (d < bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

export function stepWillow(state, dt, { you = null, knot = false } = {}, kind = WILLOW) {
  const s = { ...state, ev: [] };
  const d = you ? Math.hypot(you[0], you[1]) : Infinity;
  const bearing = you ? Math.atan2(you[0], you[1]) : 0;
  // a knock on the knot stills it, whatever it was doing, for its time again
  if (knot) {
    if (s.mode !== 'frozen') s.ev.push({ type: 'frozen' });
    s.mode = 'frozen';
    s.t = 0;
    s.frozen = kind.frozen;
    s.limb = -1;
    return s;
  }
  s.t += dt;
  if (s.mode === 'frozen') {
    s.frozen = Math.max(0, s.frozen - dt);
    if (s.frozen === 0) {
      s.mode = 'rest';
      s.t = 0;
      s.ev.push({ type: 'thawed' });
    }
    return s;
  }
  if (s.mode === 'idle') {
    if (d <= kind.reach) {
      s.mode = 'windup';
      s.t = 0;
      s.limb = nearestLimb(kind, bearing);
      s.aim = bearing;
      s.ev.push({ type: 'windup', limb: s.limb });
    }
    return s;
  }
  if (s.mode === 'windup') {
    // (it keeps its eye on you as it draws back; the strike goes where you were as it began)
    if (you) s.aim = bearing;
    if (s.t >= kind.windup) {
      s.mode = 'strike';
      s.t = 0;
      s.swats += 1;
      s.ev.push({ type: 'strike', limb: s.limb, aim: s.aim });
    }
    return s;
  }
  if (s.mode === 'strike') {
    if (s.t >= kind.strike) {
      // the limb comes through its arc: you’re struck if you’re still in its reach and on its line
      const on = you && d <= kind.reach + 0.5 && Math.abs(wrap(bearing - s.aim)) <= kind.arc;
      if (on) {
        s.hits += 1;
        const k = d > 1e-6 ? 1 / d : 0;
        const away = d > 1e-6 ? [you[0] * k, you[1] * k] : [Math.sin(s.aim), Math.cos(s.aim)];
        s.ev.push({ type: 'hit', limb: s.limb, throw: [away[0] * kind.throw, away[1] * kind.throw], points: kind.points });
      } else s.ev.push({ type: 'miss', limb: s.limb });
      s.mode = 'rest';
      s.t = 0;
    }
    return s;
  }
  // rest: then idle again, ready
  if (s.t >= kind.rest) {
    s.mode = 'idle';
    s.t = 0;
    s.limb = -1;
  }
  return s;
}

// Each limb’s yaw off its rest and its lift (radians, up from its droop)
// now: a slow sway of its own phase when idle; the struck limb drawn back
// on the windup, swept along its arc toward the aim on the strike and
// coming back to rest after; nothing moving at all while frozen
export function limbAngles(state, time, kind = WILLOW) {
  const still = state.mode === 'frozen';
  return kind.limbs.map((l, i) => {
    let yaw = still ? 0 : 0.08 * Math.sin(time * 0.7 + i * 1.3) + 0.04 * Math.sin(time * 1.9 + i);
    let lift = still ? 0 : 0.06 * Math.sin(time * 0.9 + i * 2.1);
    if (i === state.limb) {
      const off = wrap(state.aim - l.yaw);
      if (state.mode === 'windup') {
        const k = Math.min(1, state.t / kind.windup);
        yaw -= Math.sign(off || 1) * 0.6 * k;
        lift += 0.5 * k;
      } else if (state.mode === 'strike') {
        const k = Math.min(1, state.t / kind.strike);
        const e = k * k * (3 - 2 * k);
        yaw += -Math.sign(off || 1) * 0.6 * (1 - e) + off * e;
        lift += 0.5 * (1 - e) - 0.25 * Math.sin(Math.PI * e);
      }
    }
    return { yaw, lift };
  });
}
