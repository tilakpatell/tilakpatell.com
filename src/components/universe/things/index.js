// The things in space played in the scene: what's near enough to act on and
// the key that does it, an ion storm draining the shields, a pulsar's beam
// scrambling the HUD, a comet's tail paying for flying it, a wormhole's
// throat throwing you far away. The rules are rules.js's; this reads the
// sectors the Expanse has loaded and the ship, and says what happened. It
// never stores anything: what's been paid is for the visit.
//
// createThingPlay({ sectors, pay, say, travelling, universe, reduced }) → { update(state, dt, t), press(state) → boolean,
//   near() → { id, kind, verb } | null, ledger }
//   sectors() → an iterable of loaded sectors; pay(what, n) the scene's earning (EARN keys);
//   say(text) a note on screen; travelling() → true mid-trip (a wormhole throws only by hand)
//   update reads and writes the scene's state: shield, hitAt (the regen waits after a drain as
//   after a hit, but a drain is no hit: no laser, no shake), static (the HUD's scramble), ship
//   (a wormhole's throw), clock

import { THING_KINDS, rowAt, tailOf, thingRow, traitsOf, wormholeExit } from '../../expanse/shared/gen';
import { THINGS } from '../words';
import { beamDirs } from './layout';
import { SCRAMBLE, TAIL, act, actionOf, createLedger, inBeam, stormDrain, wormholeThrows } from './rules';

const LOOK = 0.25; // seconds between looks for what's near enough to act on
const LATTICE_ACTS = new Set(THING_KINDS.map((k, i) => (actionOf(k.kind) ? i : -1)).filter((i) => i >= 0));
const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function createThingPlay({ sectors, pay, say = () => {}, travelling = () => false, universe, reduced = false, stow = null } = {}) {
  const ledger = createLedger();
  let looked = 0;
  let near = null; // { id, kind, row, reach }
  let inTail = null;
  let tailFor = 0;

  // the nearest thing you can act on, within its reach (actionOf's `near`, in its sizes)
  const look = (ship) => {
    near = null;
    let best = Infinity;
    for (const s of sectors()) {
      const o = s.origin;
      if (Math.max(Math.abs(ship[0] - o[0]), Math.abs(ship[1] - o[1]), Math.abs(ship[2] - o[2])) > 62000) continue;
      for (const rows of Object.values(s.extras ?? {}))
        for (const r of rows) {
          const a = actionOf(r.kind);
          if (!a) continue;
          const d = len(rowAt(r, 0), ship) - r.size * a.near;
          if (d < 0 && d < best) {
            best = d;
            near = { id: r.id, kind: r.kind, row: r, sector: s };
          }
        }
      const th = s.things;
      for (let i = 0; i < (th?.count ?? 0); i++) {
        if (!LATTICE_ACTS.has(th.kind[i])) continue;
        const a = actionOf(THING_KINDS[th.kind[i]].kind);
        const at = [o[0] + th.at[i * 3], o[1] + th.at[i * 3 + 1], o[2] + th.at[i * 3 + 2]];
        const d = len(at, ship) - th.size[i] * a.near;
        if (d < 0 && d < best) {
          best = d;
          near = { id: null, kind: THING_KINDS[th.kind[i]].kind, sector: s, i };
        }
      }
    }
    if (near && !near.row) {
      near.row = thingRow(near.sector, near.i);
      near.id = near.row.id;
    }
  };

  return {
    ledger,
    near: () => (near ? { id: near.id, kind: near.kind, verb: actionOf(near.kind).verb, name: near.row.name } : null),
    update(state, dt, t) {
      const s = state.ship;
      if (!s || state.crash) return;
      const ship = [s.x, s.y, s.z];
      looked -= dt;
      if (looked <= 0) {
        looked = LOOK;
        const was = near?.id ?? null;
        look(ship);
        // (a new thing in reach: the key, said once)
        if (near && near.id !== was) say(THINGS.prompt(actionOf(near.kind).verb, near.row.name));
      }
      let draining = false;
      let tail = null;
      for (const sec of sectors()) {
        const ex = sec.extras ?? {};
        for (const r of ex.storm ?? []) if (len(rowAt(r, t), ship) < r.size) draining = true;
        for (const r of ex.pulsar ?? [])
          if (len(r.at, ship) < 25 * r.size && inBeam(beamDirs(traitsOf(r), t), r.at, ship, r.size)) {
            if (!(state.static > 0) && !(state.beamSaid > state.clock)) say(THINGS.beam(r.kind));
            state.beamSaid = state.clock + SCRAMBLE * 4; // (said once a pass, not every sweep)
            // (the HUD scrambles a moment; for a visitor who asks for less motion, the note alone)
            if (!reduced) state.static = Math.max(state.static ?? 0, SCRAMBLE);
          }
        for (const r of ex.wormhole ?? [])
          if (wormholeThrows(r, ship, { travelling: travelling() })) {
            const exit = wormholeExit(r, universe);
            state.ship = { ...s, x: exit.at[0], y: exit.at[1], z: exit.at[2], heading: exit.heading, speed: 0 };
            say(THINGS.thrown(exit.key));
            return;
          }
        for (const r of ex.comet ?? []) {
          const head = rowAt(r, t);
          const { dir, length } = tailOf(r, t);
          const L = length * r.size;
          const v = [ship[0] - head[0], ship[1] - head[1], ship[2] - head[2]];
          const along = v[0] * dir[0] + v[1] * dir[1] + v[2] * dir[2];
          if (along <= 0 || along > L) continue;
          const side = Math.hypot(v[0] - dir[0] * along, v[1] - dir[1] * along, v[2] - dir[2] * along);
          if (side < 4 * r.size * (0.3 + 0.7 * (along / L))) tail = r;
        }
      }
      if (draining) {
        const was = state.shield;
        state.shield = stormDrain(state.shield, dt);
        if (state.shield < was) state.hitAt = state.clock; // (the regen waits, as after a hit)
      }
      // a comet's tail: TAIL.secs inside it pays, once a comet a visit
      if (tail && inTail === tail.id) tailFor += dt;
      else {
        inTail = tail?.id ?? null;
        tailFor = 0;
      }
      if (tail && tailFor >= TAIL.secs && !ledger.paid(tail.id)) {
        const n = ledger.pay(tail.id, TAIL.times, 1);
        if (n) {
          pay('found', n);
          say(THINGS.tail);
        }
      }
    },
    press(state) {
      if (!near || !state.ship) return false;
      const traits = traitsOf(near.row);
      const r = act(ledger, { kind: near.kind, id: near.id, traits });
      if (!r) return false;
      // (mining and salvage go into the hold, the market's, when there is one;
      // its own line said: what it took, the hold full, or the field worked out)
      const id = near.id ?? `${near.sector?.id}:t${near.i}`;
      const stowed = stow?.({ kind: near.kind, id, sector: near.sector, worked: r.pay > 0, name: near.row?.name ?? null }) ?? null;
      if (stowed) {
        say(stowed);
        return true;
      }
      if (r.pay) pay('found', r.pay);
      say(THINGS.did({ ...r, kind: near.kind, name: near.row?.name }));
      return true;
    },
  };
}
