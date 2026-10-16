// A Star Destroyer's hangar run, in any battle: fly up into the belly hangar
// of one of the other side's Star Destroyers (not the flagship: its
// reactor's an objective of the battle's own), up its shaft and astern to
// its reactor, shoot it out, and get out before the ship breaks up round
// you. A run (run.js) is laid in each as you come near it, and only in
// your enemy's: whether you attack or hold the system, your shots on its
// reactor count for your side (ctx.mineAs), and your own side's ships have
// no run in them to blow up.
//
// createHangars(ctx) → { update(dt, t, live), hit, targets, markers(live), dispose() }

import { tunnelPath } from '../nodes/tunnel';
import { createRun } from './run';
import { GCW } from '../gcw';

const NEAR = 110; // within this of a Star Destroyer, its run's laid
// the shaft, in a ship 30 long (scaled to its size): up through the belly, then astern
// (the run's frame: +z up into the hull, +y toward the stern)
const SHAFT = [
  [0, 0, 0],
  [0, 0, 0.6],
  [0, 1, 1.2],
  [0, 4.5, 1.4],
  [0.6, 8, 1.3],
  [0, 10.5, 1.2],
];

export function createHangars(ctx) {
  const runs = new Map(); // capital → run
  // (the other side's, yours sworn: nobody's while you're nobody's)
  const ships = () => {
    const you = ctx.battle.you.team;
    return you === null ? [] : ctx.battle.capitals.filter((c) => c.team === 1 - you && c.kind === 'destroyer' && c.role !== 'flagship');
  };

  const lay = (cap) => {
    const k = cap.size / 30;
    const i = ctx.battle.capitals.indexOf(cap);
    const up = [cap.up.x, cap.up.y, cap.up.z];
    // (flush with the belly: lower and the shaft hangs out under the hull)
    const mouth = [cap.pos.x - cap.up.x * cap.size * 0.04, cap.pos.y - cap.up.y * cap.size * 0.04, cap.pos.z - cap.up.z * cap.size * 0.04];
    return createRun(ctx, {
      id: 5.2e6 + i,
      key: `core-${i}`,
      team: 1 - cap.team, // (the side it's the enemy of: theirs to take)
      name: 'its reactor',
      wayIn: 'Hangar: fly in to its reactor',
      mouth,
      inward: up,
      up: [-cap.fwd.x, -cap.fwd.y, -cap.fwd.z],
      path: tunnelPath(`${ctx.on.id}-hangar-${i}`, { ctrl: SHAFT.map((p) => p.map((v) => v * k)), steps: 40 }),
      radius: 0.55 * k,
      chamber: 2.2 * k,
      look: 'isd',
      hp: 30,
      escape: 12,
      speed: 6,
      drawWithin: NEAR,
      markWithin: 90,
      open: () => cap.alive && cap.dying <= 0,
      solidsOff: (off) => ctx.setHull(cap.id, !off),
      enter: () => ctx.event('gcw-hangar'),
      onBlown: (mine) => {
        ctx.battle.wreck(cap.id);
        ctx.event('gcw-isd');
        if (mine || ctx.tookPart()) ctx.points(GCW.points.objective * 2);
      },
    });
  };

  const all = () => [...runs.values()];
  return {
    update(dt, t, live) {
      const out = {};
      const list = ships();
      // (sworn to the other side since: the old side's runs go, unless one's still going off)
      for (const [cap, run] of runs)
        if (!list.includes(cap) && !run.inside && run.state !== 'blown') {
          run.dispose();
          runs.delete(cap);
        }
      for (const cap of list) {
        let run = runs.get(cap);
        const near = live && Math.hypot(live.x - cap.pos.x, live.y - cap.pos.y, live.z - cap.pos.z) < NEAR;
        // laid as you come near (and dropped once you've gone, unless it's still going off)
        if (!run && near && cap.alive && cap.dying <= 0 && !cap.moved) runs.set(cap, (run = lay(cap)));
        if (run && !near && !run.inside && run.state !== 'blown') {
          run.dispose();
          runs.delete(cap);
          continue;
        }
        if (!run) continue;
        const r = run.update(dt, t, live);
        if (r.ship) out.ship = r.ship;
        if (r.hurt) out.hurt = (out.hurt ?? 0) + r.hurt;
        if (r.speedCap) out.speedCap = r.speedCap;
        if (r.kill) out.kill = true;
        if (run.state === 'done') {
          run.dispose();
          runs.delete(cap);
        }
      }
      return out;
    },
    hit(from, to, damage) {
      for (const run of all()) {
        const h = run.hit(from, to, damage);
        if (h) return h;
      }
      return null;
    },
    get targets() {
      return all().flatMap((r) => r.targets);
    },
    markers: (live) => all().flatMap((r) => r.markers(live)),
    get inside() {
      return all().some((r) => r.inside);
    },
    dispose() {
      for (const run of all()) run.dispose();
      runs.clear();
    },
  };
}
