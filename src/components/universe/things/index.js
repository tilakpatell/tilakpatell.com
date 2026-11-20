// The things in space played in the scene: what's near enough to act on and
// the key that does it, an ion storm draining the shields, a pulsar's beam
// scrambling the HUD, a comet's tail paying for flying it, a wormhole's
// throat throwing you far away. The rules are rules.js's; this reads the
// sectors the Expanse has loaded and the ship, and says what happened. It
// stores only the planets you've surveyed: what's been paid is for the visit.
//
// createThingPlay({ sectors, pay, say, travelling, universe, reduced, stow, store }) → { update(state, dt, t), press(state) → boolean,
//   near() → { id, kind, verb } | null, surveys() → the planets surveyed (ids, newest last), ledger }
//   store: a localStorage-like store for the surveys' log (lib/space/planetPlay.js), or none
// A generated planet in orbit range is played too (lib/space/planetPlay.js): surveyed, its anomaly
// probed, its secret moon searched, its hazard braved low in its orbit.
//   sectors() → an iterable of loaded sectors; pay(what, n) the scene's earning (EARN keys);
//   say(text) a note on screen; travelling() → true mid-trip (a wormhole throws only by hand)
//   update reads and writes the scene's state: shield, hitAt (the regen waits after a drain as
//   after a hit, but a drain is no hit: no laser, no shake), static (the HUD's scramble), ship
//   (a wormhole's throw), clock

import { THING_KINDS, moonAt, orbitAt, rowAt, tailOf, thingRow, traitsOf, wormholeExit } from '../../expanse/shared/gen';
import { planetTraits, traitFacts } from '../places/cards';
import { LOW, ORBIT, PLAY, addSurvey, hazardDrain, loadSurveys, saveSurveys, surveyPay, verbAt } from '../../../lib/space/planetPlay.js';
import { THINGS } from '../words';
import { beamDirs } from './layout';
import { SCRAMBLE, STORM, TAIL, act, actionOf, createLedger, inBeam, jetDirs, stormDrain, wormholeThrows } from './rules';

const LOOK = 0.25; // seconds between looks for what's near enough to act on
const LATTICE_ACTS = new Set(THING_KINDS.map((k, i) => (actionOf(k.kind) ? i : -1)).filter((i) => i >= 0));
const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function createThingPlay({ sectors, pay, say = () => {}, travelling = () => false, universe, reduced = false, stow = null, store = null } = {}) {
  const ledger = createLedger();
  // (the planets round the ship: their traits, made when one is first in orbit range)
  const traitCache = new Map();
  const traitsAt = (p, sys) => {
    let t = traitCache.get(p.id);
    if (!t) {
      t = planetTraits(p, sys);
      if (traitCache.size > 128) traitCache.delete(traitCache.keys().next().value);
      traitCache.set(p.id, t);
    }
    return t;
  };
  let surveys = loadSurveys(store);
  let hazardAt = null; // { id, name, hazard } of the planet whose low orbit you're in
  let braveFor = 0;
  let looked = 0;
  let near = null; // { id, kind, row, reach }
  let inTail = null;
  let tailFor = 0;

  // the nearest thing you can act on, within its reach (actionOf's `near`, in its sizes)
  const look = (ship, t = 0) => {
    near = null;
    hazardAt = null;
    let best = Infinity;
    for (const s of sectors()) {
      // a planet you're in orbit round: survey it, probe it, search its secret moon, brave it
      for (const sys of s.systems ?? [])
        for (const p of sys.planets ?? []) {
          const at = p.centre ? orbitAt(p, t) : p.at;
          const d = len(at, ship);
          if (d > p.radius * (ORBIT + 4) + 400) continue;
          const tr = traitsAt(p, sys);
          if (d < p.radius * LOW && hazardDrain(tr.hazard) > 0) hazardAt = { id: p.id, name: p.name, hazard: tr.hazard };
          const verb = verbAt(tr, ledger, p.id);
          if (verb && d - p.radius * ORBIT < 0 && d - p.radius * ORBIT < best) {
            best = d - p.radius * ORBIT;
            near = { id: p.id, kind: 'planet', verb, row: p, traits: tr, sector: s };
          }
          const m = tr.secret && p.moonList?.[tr.secret.moon];
          if (m && !ledger.paid(`${p.id}:search`)) {
            const dm = len(moonAt(m, p, t), ship) - m.radius * PLAY.search.near;
            if (dm < 0 && dm < best) {
              best = dm;
              near = { id: p.id, kind: 'secret', verb: 'search', row: m, traits: tr, sector: s };
            }
          }
        }
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

  const verbOf = (n) => n.verb ?? actionOf(n.kind).verb;

  const pressPlanet = () => {
    const { id, traits: tr, row } = near;
    if (near.verb === 'survey') {
      const n = ledger.pay(`${id}:survey`, surveyPay(tr), 1);
      if (!n) return false;
      pay('found', n);
      surveys = addSurvey(surveys, id);
      saveSurveys(store, surveys);
      say(THINGS.surveyed(row.name, traitFacts(tr).map(([k, v]) => `${k}: ${v}`)));
    } else if (near.verb === 'probe') {
      const n = ledger.pay(`${id}:probe`, PLAY.probe.pay, 1);
      if (!n) return false;
      pay('found', n);
      say(THINGS.probed(row.name, tr.anomaly.id));
    } else {
      const n = ledger.pay(`${id}:search`, PLAY.search.pay, 1);
      if (!n) return false;
      pay('found', n);
      say(THINGS.searched(row.name, tr.secret.kind));
    }
    near = null;
    return true;
  };

  return {
    ledger,
    near: () => (near ? { id: near.id, kind: near.kind, verb: verbOf(near), name: near.row.name } : null),
    surveys: () => surveys,
    update(state, dt, t) {
      const s = state.ship;
      if (!s || state.crash) return;
      const ship = [s.x, s.y, s.z];
      looked -= dt;
      if (looked <= 0) {
        looked = LOOK;
        const was = near?.id ?? null;
        look(ship, t);
        // (a new thing in reach: the key, said once)
        if (near && near.id !== was) say(THINGS.prompt(verbOf(near), near.row.name));
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
        // (in a quasar's jet the shields drain, as in an ion storm, out to its jets' length)
        for (const r of ex.quasar ?? []) {
          const tr = traitsOf(r);
          if (inBeam(jetDirs(tr), r.at, ship, r.size, 0.08 * tr.jet * 1.25)) {
            draining = true;
            if (!(state.jetSaid > state.clock)) say(THINGS.jet);
            state.jetSaid = state.clock + 8;
          }
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
      // (low over a planet with a hazard: the shields drain by how bad it is, and staying through
      // PLAY.brave.secs of it pays once)
      if (hazardAt) {
        const k = hazardDrain(hazardAt.hazard);
        const was = state.shield;
        if (state.shield > STORM.floor) state.shield = Math.max(STORM.floor, state.shield - STORM.drain * k * dt);
        if (state.shield < was) state.hitAt = state.clock;
        braveFor += dt;
        if (braveFor >= PLAY.brave.secs && !ledger.paid(`${hazardAt.id}:brave`)) {
          const n = ledger.pay(`${hazardAt.id}:brave`, PLAY.brave.per * hazardAt.hazard.level, 1);
          if (n) {
            pay('found', n);
            say(THINGS.braved(hazardAt.name));
          }
        }
      } else braveFor = 0;
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
      if (near.kind === 'planet' || near.kind === 'secret') return pressPlanet();
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
