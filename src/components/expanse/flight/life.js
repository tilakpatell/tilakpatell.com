// A planet's life streamed in round the ship: cells of the shared grid
// (LIFE_CELL) loaded within LIFE_RADIUS, one a frame, and let go of a band
// further out (runtime/chunkGrid.js), each cell's roster the same every
// visit (lib/land/flight/roster.js), as the galaxy surface's population.js
// does it: the dead stay dead for the visit, an animal that walked into
// the next cell is kept by that cell, never doubled and never lost, and what
// a let-go actor had done is kept for when its cell comes back.
//
// Bodies move every frame along what their brains last said (cheap); the
// brains themselves (./brains.js, ./air.js) think round-robin within
// LIFE_MS of the frame, with no awake actor waiting more than FAIR frames
// for its turn, and only within AWAKE metres of the ship (further off, a
// herd stands where it is, in the fog). A brain that throws is removed for
// the visit with one warning a kind; the frame goes on. A dead world makes
// nothing at all. Pure: no three.js.
//
//   createLife({ spec, life, tier, field, rand, now, warn, onHit, brainFor }) →
//     { update(ship, dt) → { make: actors, drop: ids, moved: ids, shots, news: lines for the HUD },
//       actors: Map, died(id), isDead(id), stats() }

import { createChunkGrid } from '../../../runtime/chunkGrid';
import { isDead as deadWorld } from '../../../lib/land/flight/lifeTables';
import { rosterFor } from '../../../lib/land/flight/roster';
import { LIFE_CELL, cellKeyOf } from '../../../lib/land/flight/routes';
import { seeded } from '../../../lib/seeded';
import { brainFor as groundBrain } from './brains';
import { airBrain, placeAir, prepareRoute } from './air';
import { forwardOf } from './flightRules';

export const LIFE_RADIUS = 2; // cells
export const LIFE_MS = { low: 1, mid: 2, high: 3, ultra: 4 }; // a frame, for the brains
const AWAKE = 2500; // m: further off, nobody thinks
export const FAIR = 5; // frames an awake actor may wait for its turn, at most
const RESAMPLE = 2; // m a body walks before the ground under it is asked again
const MAX_DAMAGE = 30; // a hit's (the spec's clamp)
const HIT = 0.25; // the chance a shot at point blank hits, falling to nothing at its range

export function createLife({ spec, life, tier = 'mid', field, rand = Math.random, now = () => performance.now(), warn = console.warn, onHit = null, brainFor = null, budget = LIFE_MS[tier] ?? 2 } = {}) {
  const actors = new Map();
  const dead = new Set();
  const broken = new Set();
  const warned = new Set();
  const kept = new Map(); // id → { cell, home cell, spec, b }: an actor let go of, as it was
  const groups = new Map(); // group id → Set of actors
  const pending = []; // ids to drop at the next update (died, broken)
  const grid = createChunkGrid({ size: LIFE_CELL, radius: LIFE_RADIUS, inFlight: 1, hysteresis: 1 });
  let order = [];
  let orderDirty = true;
  let cursor = 0;
  let frame = 0;
  let t = 0;
  let last = { stepped: 0, ms: 0, awake: 0 };
  const nothing = deadWorld(life);
  const made = brainFor ?? ((a) => (a.air ? airBrain(a) : groundBrain(a, a.r0)));

  const join = (a) => {
    actors.set(a.id, a);
    if (a.group) {
      if (!groups.has(a.group)) groups.set(a.group, new Set());
      groups.get(a.group).add(a);
    }
    orderDirty = true;
  };
  const leave = (a) => {
    actors.delete(a.id);
    groups.get(a.group)?.delete(a);
    if (groups.get(a.group)?.size === 0) groups.delete(a.group);
    orderDirty = true;
  };
  // let go of: what it had done, kept for its cell's return (ships keep nothing: the clock places them)
  const letGo = (a) => {
    if (!a.air) kept.set(a.id, { cell: a.cell, home: a.homeCell, spec: a.spec, b: { ...a.b } });
    leave(a);
  };

  const makeGround = (g, key, was) => {
    const a = {
      id: g.id,
      kind: g.kind,
      model: g.model,
      role: g.role,
      row: life.ground[g.row],
      spec: g,
      group: g.group,
      home: g.home,
      lift: g.lift ?? 0,
      homeCell: was?.home ?? key,
      cell: was?.cell ?? key,
      b: was ? { ...was.b } : { x: g.at[0], y: g.at[1], z: g.at[2], yaw: g.yaw },
      intent: null,
      r0: seeded(g.id.length * 7919 + g.at[0])(),
    };
    a.sampled = [a.b.x, a.b.z];
    a.brain = made(a);
    a.lastStep = frame;
    join(a);
    return a;
  };

  const makeAir = (s, route, key) => {
    const row = life.air[s.row];
    const a = { id: s.id, kind: s.kind, model: s.model, role: 'air', air: true, row, spec: s, route, group: route.id, t0: s.t0, speed: row.speed, homeCell: key, cell: key, b: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 }, intent: null };
    placeAir(a, t);
    a.brain = made(a);
    a.lastStep = frame;
    join(a);
    return a;
  };

  const build = (key, make) => {
    const roster = rosterFor(spec, life, key, tier, field);
    const routes = new Map(roster.routes.map((r) => [r.id, prepareRoute(r)]));
    for (const g of roster.ground) {
      if (dead.has(g.id) || broken.has(g.id) || actors.has(g.id)) continue;
      const was = kept.get(g.id);
      // (it walked off into another cell: that cell has it)
      if (was && was.cell !== key) continue;
      kept.delete(g.id);
      make.push(makeGround(g, key, was));
    }
    // and those that walked in from elsewhere
    for (const [id, was] of kept) {
      if (was.cell !== key || was.home === key || actors.has(id) || dead.has(id) || broken.has(id)) continue;
      kept.delete(id);
      make.push(makeGround(was.spec, was.home, was));
    }
    for (const s of roster.air) if (!dead.has(s.id) && !broken.has(s.id) && !actors.has(s.id)) make.push(makeAir(s, routes.get(s.route), key));
  };

  const prey = (a) => {
    let best = null;
    let bd = 300;
    for (const o of actors.values()) {
      if (o.role !== 'herd') continue;
      const d = Math.hypot(o.b.x - a.b.x, o.b.z - a.b.z);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  };

  const forget = (id) => {
    const a = actors.get(id);
    if (a) leave(a);
    kept.delete(id);
    pending.push(id);
  };

  return {
    actors,
    isDead: (id) => dead.has(id),
    died(id) {
      dead.add(id);
      forget(id);
    },
    stats: () => ({ cells: grid.loaded.size, actors: actors.size, air: [...actors.values()].filter((a) => a.air).length, kept: kept.size, dead: dead.size, broken: broken.size, ...last }),
    update(ship, dt) {
      const out = { make: [], drop: pending.splice(0), moved: [], shots: [], news: [] };
      if (nothing || !ship) return out;
      frame++;
      t += dt;
      const [fx, , fz] = forwardOf(ship);
      const { ask, drop } = grid.update({ x: ship.x, z: ship.z, heading: [fx, fz] });
      if (drop.length) {
        const gone = new Set(drop);
        for (const a of [...actors.values()])
          if (gone.has(a.cell)) {
            letGo(a);
            out.drop.push(a.id);
          }
        // (kept actors whose own cell they're in, far off: made again as the roster has them)
        for (const [id, was] of kept) if (was.cell === was.home && gone.has(was.cell) && Math.hypot(ship.x - was.b.x, ship.z - was.b.z) > LIFE_CELL * 6) kept.delete(id);
      }
      for (const key of ask) {
        grid.began(key);
        build(key, out.make);
        grid.done(key, grid.gen);
      }

      // the bodies, every frame
      for (const a of [...actors.values()]) {
        if (a.air) {
          if (a.fly) a.fly(a, dt, t, ship, field);
          else placeAir(a, t);
          continue;
        }
        const i = a.intent;
        if (i && i.speed > 0) {
          a.b.x += i.dir.x * i.speed * dt;
          a.b.z += i.dir.z * i.speed * dt;
          a.b.yaw = Math.atan2(i.dir.x, i.dir.z);
        } else if (i?.face != null) a.b.yaw = i.face;
        if (Math.hypot(a.b.x - a.sampled[0], a.b.z - a.sampled[1]) > RESAMPLE) {
          a.b.y = field.heightAt(a.b.x, a.b.z) + a.lift;
          a.sampled = [a.b.x, a.b.z];
        }
        const key = cellKeyOf(a.b.x, a.b.z);
        if (key !== a.cell) {
          a.cell = key;
          out.moved.push(a.id);
          // into a cell that isn't loaded: kept for it
          if (!grid.loaded.has(key)) {
            letGo(a);
            out.drop.push(a.id);
          }
        }
      }

      // the brains, round-robin on the budget
      if (orderDirty) {
        order = [...actors.keys()];
        orderDirty = false;
        cursor %= Math.max(1, order.length);
      }
      const ground = field.heightAt(ship.x, ship.z);
      const shipAlt = ship.y - ground;
      const start = now();
      const awake = order.filter((id) => {
        const a = actors.get(id);
        return a && (a.air || Math.hypot(a.b.x - ship.x, a.b.z - ship.z) < AWAKE);
      });
      const least = Math.ceil(awake.length / FAIR);
      let stepped = 0;
      for (let n = 0; n < awake.length; n++) {
        if (stepped >= least && now() - start >= budget) break;
        const id = awake[(cursor + n) % awake.length];
        const a = actors.get(id);
        if (!a) continue;
        const lag = (frame - a.lastStep) * dt || dt;
        a.lastStep = frame;
        stepped++;
        try {
          const mates = a.group ? [...groups.get(a.group)] : [a];
          a.intent = a.brain?.step({ ship, shipAlt, mates, prey, rand, t, field }, lag) ?? null;
        } catch (e) {
          broken.add(a.id);
          leave(a);
          out.drop.push(a.id);
          if (!warned.has(a.kind)) {
            warned.add(a.kind);
            warn(`[life] ${a.kind}'s brain threw, removed for the visit:`, e?.message ?? e);
          }
          continue;
        }
        if (a.intent?.say) out.news.push(a.intent.say);
        const f = a.intent?.fire;
        if (f) {
          const from = [a.b.x, a.b.y + 1.5, a.b.z];
          const d = Math.hypot(f.at[0] - from[0], f.at[1] - from[1], f.at[2] - from[2]);
          const range = a.row?.hostile?.range ?? 300;
          out.shots.push({ from, at: f.at, n: f.n, by: a.id });
          for (let k = 0; k < f.n; k++) if (onHit && rand() < HIT * Math.max(0, 1 - d / range)) onHit(Math.min(MAX_DAMAGE, f.damage), a.id);
        }
      }
      cursor = awake.length ? (cursor + stepped) % awake.length : 0;
      // (asleep, nobody walks)
      for (const a of actors.values()) if (!a.air && a.lastStep < frame - FAIR) a.intent = null;
      last = { stepped, awake: awake.length, ms: now() - start };
      return out;
    },
  };
}
