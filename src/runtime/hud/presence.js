// What the quiet flight HUD has out, frame by frame: the thin core is always
// there (the crosshair, the radar, the shields and the speed); the guns, the
// powers and the kills come out for a fight and go six seconds after it, the
// target's card while there's a lock and two seconds after, and the shields'
// warning under 35 %. Stepped by the flight HUD's writer (flight/flightHud.js)
// from the frame's record, and poked by a fight key (FlightHud.jsx). Pure, and
// nothing is made per frame: one record, filled in place.
//
//   createPresence({ fightMs, lockMs, low }) → { step(now, input) → state, poke(now), reset() }
//     input: { threats (the hostiles with an arrow), hit, kill (a shot of yours, this frame),
//              lock (a lock held), shields (0–1, or null with none: on foot) }
//     state: { fight, target, low }
//   FIGHT_MS, LOCK_MS: how long each stays out after its cause; LOW: the shields' warning
// The design: docs/superpowers/specs/2026-11-18-quiet-hud-design.md.

export const FIGHT_MS = 6000;
export const LOCK_MS = 2000;
export const LOW = 0.35;

export function createPresence({ fightMs = FIGHT_MS, lockMs = LOCK_MS, low = LOW } = {}) {
  const state = { fight: false, target: false, low: false };
  // (when each was last seen: -Infinity for never)
  let fought = -Infinity;
  let locked = -Infinity;
  let shields = NaN; // (last frame's, to see them fall: NaN for none)
  const reset = () => {
    fought = -Infinity;
    locked = -Infinity;
    shields = NaN;
    state.fight = false;
    state.target = false;
    state.low = false;
  };
  return {
    state,
    reset,
    poke(now) {
      fought = now;
    },
    step(now, input) {
      const s = input.shields;
      const has = typeof s === 'number' && Number.isFinite(s);
      if (input.threats > 0 || input.hit || input.kill || (has && s < shields)) fought = now;
      if (input.lock) locked = now;
      shields = has ? s : NaN;
      state.fight = now - fought <= fightMs;
      state.target = now - locked <= lockMs;
      state.low = has && s < low;
      return state;
    },
  };
}
