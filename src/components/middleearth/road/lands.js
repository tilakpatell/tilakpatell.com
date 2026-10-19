// The stages’ lands under the ride: the one you are in, the one before and
// the one after, each built (terrain.js’s heights, ground.js’s mesh) and
// placed in the current stage’s frame, the rest dropped. The stage you are
// in is built at once when it is not ready (an address, a jump); its
// neighbours a few milliseconds a frame, so a seam never costs a frame.
//
//   createLands({ scene, house, tier, budget (ms a frame), wide (m across), scatter, sky }) → {
//     at(index),            the ride is in stage `index`: re-place, build, drop
//     step(),               a frame’s slice of the building
//     water(dt, light),     the built stages’ rivers flowing, in the day’s light
//     heightAt(x, z),       the ground under a point in the current frame
//     ready(index), groupOf(index), landOf(index), watersOf(index), stats, dispose() }
//
// `stats`: each stage built, { id, ms, slices, worst } (ms the whole of its
// building, slices the frames it took, worst the longest of them), for the
// evidence and the measure.

import * as THREE from 'three';
import { STAGES } from './stages/index';
import { FRAME_BACK, SEAM, landJob, riverLevel, run } from './terrain';
import { groundJob } from './ground';
import { createWater } from './water';
import { placements, rngOf, rowsFor } from './scatter';
import { fieldAt } from '../../../lib/land/layers.js';

const RES = { low: 4, mid: 2, high: 2, ultra: 2 };

export function createLands({ scene, house = null, tier = 'high', budget = 6, wide = 1024, scatter = null, sky = null } = {}) {
  const built = new Map(); // index → { land, ground, group }
  const jobs = new Map(); // index → generator
  let current = -1;
  const stats = [];
  const clocks = new Map(); // index → { ms, slices, worst }
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  function* stageJob(i) {
    const id = STAGES[i].id;
    const land = yield* landJob(id, { res: RES[tier] ?? 2, wide });
    // (the first stage has land behind it, the last ahead; the rest abut at their seams)
    const from = i === 0 ? -FRAME_BACK : 0;
    const to = i === STAGES.length - 1 ? land.end + FRAME_BACK : land.end;
    const ground = yield* groundJob(land, { house, tier, from, to });
    const group = new THREE.Group();
    group.name = `road:${id}`;
    group.add(ground.mesh);
    // its rivers, each a ribbon down its channel, banks and all
    const waters = (land.rivers ?? []).map((r) => {
      const bank = r.bank ?? r.width / 2;
      return createWater({ along: { line: r.line, width: r.width + 2 * bank, level: riverLevel(land.field, r) }, kind: 'river', sky, ground: land.field });
    });
    for (const w of waters) group.add(w.mesh);
    yield;
    // what grows on it, placed once (its stage’s seed, so a stage is the same every ride)
    const items = scatter ? placements(rowsFor(id), land, land.road, rngOf(1000 + i), { tier }) : [];
    return { land, ground, group, items, waters };
  }
  const finish = (i, value) => {
    const c = clocks.get(i) ?? { ms: 0, slices: 0, worst: 0 };
    stats.push({ id: STAGES[i].id, ms: Math.round(c.ms), slices: c.slices, worst: Math.round(c.worst * 10) / 10 });
    clocks.delete(i);
    jobs.delete(i);
    built.set(i, value);
    scene.add(value.group);
    place();
  };
  // each built stage at its offset from the current one, along +z
  const place = () => {
    for (const [i, b] of built) {
      let z = 0;
      if (i > current) for (let k = current; k < i; k++) z += built.get(k)?.land.end ?? STAGES[k].length;
      else for (let k = i; k < current; k++) z -= built.get(k)?.land.end ?? STAGES[k].length;
      if (b.group.position.z !== z || !b.placed) scatter?.set(STAGES[i].id, b.items, z);
      b.placed = true;
      b.group.position.z = z;
      b.group.visible = Math.abs(i - current) <= 1;
    }
  };
  const drop = (i) => {
    const b = built.get(i);
    if (b) {
      scene.remove(b.group);
      b.ground.dispose();
      for (const w of b.waters) w.dispose();
      scatter?.free(STAGES[i].id);
      built.delete(i);
    }
    jobs.delete(i);
  };

  return {
    at(index) {
      if (index === current) return;
      current = index;
      for (const i of [...built.keys(), ...jobs.keys()]) if (Math.abs(i - index) > 1) drop(i);
      if (!built.has(index)) {
        const t0 = now();
        const value = run(jobs.get(index) ?? stageJob(index));
        const ms = now() - t0 + (clocks.get(index)?.ms ?? 0);
        clocks.set(index, { ms, slices: (clocks.get(index)?.slices ?? 0) + 1, worst: Math.max(now() - t0, clocks.get(index)?.worst ?? 0) });
        finish(index, value);
      }
      for (const i of [index + 1, index - 1]) if (i >= 0 && i < STAGES.length && !built.has(i) && !jobs.has(i)) jobs.set(i, stageJob(i));
      place();
    },
    step() {
      const t0 = now();
      // (the one ahead first: it is the one walked into)
      for (const i of [current + 1, current - 1]) {
        const job = jobs.get(i);
        if (!job) continue;
        const s0 = now();
        let done = null;
        while (now() - t0 < budget) {
          const r = job.next();
          if (r.done) {
            done = r;
            break;
          }
        }
        const c = clocks.get(i) ?? { ms: 0, slices: 0, worst: 0 };
        const took = now() - s0;
        clocks.set(i, { ms: c.ms + took, slices: c.slices + 1, worst: Math.max(c.worst, took) });
        if (done) finish(i, done.value);
        if (now() - t0 >= budget) return;
      }
    },
    water(dt, light) {
      for (const b of built.values()) {
        if (!b.group.visible) continue;
        for (const w of b.waters) {
          w.set(light);
          w.update(dt);
        }
      }
    },
    heightAt(x, z) {
      // (in the current frame: past its end it is the next stage’s, before its start the last’s)
      const here = built.get(current);
      if (!here) return fieldAt(SEAM, x, 0);
      if (z > here.land.end) {
        const next = built.get(current + 1);
        return next ? next.land.field(x, z - here.land.end) : fieldAt(SEAM, x, 0);
      }
      if (z < 0 && current > 0) {
        const prev = built.get(current - 1);
        return prev ? prev.land.field(x, z + prev.land.end) : fieldAt(SEAM, x, 0);
      }
      return here.land.field(x, z);
    },
    ready: (i) => built.has(i),
    // (a built stage’s group, which its scene is put in so it moves with it; and its land)
    groupOf: (i) => built.get(i)?.group ?? null,
    landOf: (i) => built.get(i)?.land ?? null,
    // (its rivers’ water, in its land’s order: the Ford’s scene raises the Bruinen’s)
    watersOf: (i) => built.get(i)?.waters ?? [],
    stats,
    get current() {
      return built.get(current) ?? null;
    },
    dispose() {
      for (const i of [...built.keys()]) drop(i);
      jobs.clear();
    },
  };
}
