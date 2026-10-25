// The player's targeting, one per map (the universe's scene.js and the
// galaxy's): what the guns are locked on to, where to shoot to meet it,
// whether a shot now bends all the way onto it, whether the nose follows
// it, the bend and the nudge themselves, a tap's pick, and the camera's
// lean toward it. targeting.js holds the rules; this is them run each
// frame the way both scenes ran them. Pure (no three.js, no DOM).
//
// It writes its answers onto the scene's own `state` (lock, cycle,
// lockTarget, trackable, lead, hot), where they always were: the HUD,
// powers.aim, the other pilots' tags and the browser checks read them
// there, and a tap, a pose or a check may write state.lock itself.
//
//   createSight(state) → {
//     update(ship, cands, dt, o) → ticked (a new lock this frame: the tick's sound)
//       cands: this frame's targets ({ id, at, vel, size, threat? }); o, kept by the scene:
//       { speed (a shot's, the ship's own added), life (its seconds), help() → { assist },
//         tracks(target) → bool (does the nose follow it), foes? (every foe, ungated, for find) }
//     inReach()                       the lead within a shot's life
//     aim(dir, ship, strength) → dir  a shot's direction, bent onto the lead while in reach
//     nudge(ship, stick, strength) → { turn, climb } | null   the stick's nudge toward it
//     find(id) → target | null        among the foes, then this frame's targets
//     pickAt(x, y, project, reach = 48) → id | null   the target nearest a tap, in front
//     lean(bias, ship, dt, reduced)   the camera's lean toward the lock, eased (bias: [x, y, z])
//     cands, foes                     the last update's lists
//   }
//   shotReach(w, ship, out = {}) → out   a weapon's { speed, life }, for `o`

import { AIM, assist, assistAmount, dirTo, intercept, nose, track, trackNudge } from './targeting';

// milliseconds after a shot the nose follows whatever the guns are on
export const TRACK_AFTER_SHOT = 1500;

// a weapon's shot as the sight reads it (the scene's `o`, written in place):
// its speed, the ship's own forward speed added, and its seconds in flight
export function shotReach(w, ship, out = {}) {
  out.speed = AIM.bolt * w.speed + Math.max(0, ship.speed);
  out.life = AIM.life * w.life;
  return out;
}

const NONE = Object.freeze([]);

export function createSight(state) {
  let life = 0;
  let foes = NONE;
  const pt = { x: 0, y: 0, z: 0 }; // (a tap's projection, kept)
  // the T ring (targeting.js's track): kept from press to press while the
  // lock is the one the sight wrote, started again once it's lost or written
  // from outside (a tap, a pose, a check)
  const ring = [];
  let mine = null;
  const sight = {
    cands: NONE,
    foes: NONE,
    update(ship, cands, dt, o) {
      sight.cands = cands;
      foes = sight.foes = o.foes ?? cands;
      life = o.life;
      const was = state.lock?.id ?? null;
      if (state.lock !== mine) ring.length = 0;
      state.lock = cands.length || state.lock ? track(ship, cands, state.lock, dt, { cycle: state.cycle, ring }) : null;
      mine = state.lock;
      if (!state.lock) ring.length = 0;
      state.cycle = 0;
      const tgt = state.lock ? (cands.find((c) => c.id === state.lock.id) ?? null) : null;
      state.lockTarget = tgt;
      // (the nose follows only what the scene says it should, or one picked by hand)
      state.trackable = Boolean(tgt && (o.tracks(tgt) || state.lock.manual));
      state.lead = tgt ? intercept(ship, o.speed, tgt.at, tgt.vel) : null;
      // (hot: a shot now would bend all the way onto it; help is read once the lock is set, as powers.aim reads it)
      state.hot = Boolean(state.lead && state.lead.t <= life && assistAmount(nose(ship), dirTo(ship, state.lead), o.help().assist) >= 1);
      return Boolean(tgt && tgt.id !== was);
    },
    inReach() {
      return Boolean(state.lead && state.lead.t <= life);
    },
    aim(dir, ship, strength) {
      return sight.inReach() ? assist(dir, dirTo(ship, state.lead), strength) : dir;
    },
    nudge(ship, stick, strength) {
      return state.trackable && sight.inReach() ? trackNudge(ship, state.lead, strength, stick) : null;
    },
    find(id) {
      if (id === null || id === undefined) return null;
      return foes.find((c) => c.id === id) ?? sight.cands.find((c) => c.id === id) ?? null;
    },
    pickAt(px, py, project, reach = 48) {
      let best = null;
      for (const c of sight.cands) {
        project(c.at.x, c.at.y, c.at.z, pt);
        const d = Math.hypot(px - pt.x, py - pt.y);
        if (pt.z > 0.3 && d <= reach && (!best || d < best.d)) best = { id: c.id, d };
      }
      return best?.id ?? null;
    },
    lean(bias, ship, dt, reduced) {
      const tgt = state.lockTarget;
      let bx = 0;
      let by = 0;
      let bz = 0;
      if (tgt && !reduced) {
        const vx = tgt.at.x - ship.x;
        const vy = tgt.at.y - ship.y;
        const vz = tgt.at.z - ship.z;
        const l = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
        const k = Math.min(0.3, l * 0.08) / l;
        bx = vx * k;
        by = vy * k;
        bz = vz * k;
      }
      const ease = 1 - Math.exp(-dt * 3);
      bias[0] += (bx - bias[0]) * ease;
      bias[1] += (by - bias[1]) * ease;
      bias[2] += (bz - bias[2]) * ease;
    },
  };
  return sight;
}
