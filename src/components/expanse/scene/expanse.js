// The endless space on the universe map: one 3D space of generated sectors
// (gen/space.js's fullSector) in every direction, the hand-made core
// included (its keep-outs keep generation off the site's own places), with
// no rim, no floating origin and no edge. The map draws round the camera
// every frame (universe/relative.js), so everything here sits where it is
// in the map, however far out.
//
// - Loading: the 3 × 3 × 3 sectors round the camera (runtime/chunkGrid3.js),
//   nearest and ahead first, made in the worker pool (gen/job.js), taken in
//   on the main thread a few at a time within the budget's milliseconds.
// - Drawing: each sector's stars are a slot of the far layer's one draw
//   (universe/farStars.js); the sectors past them, a ring further out, are
//   the starfield beyond, each sector's biggest stars; within the far plane
//   every body is a disc of its true size (discs.js); inside a system's reach
//   it's built whole (near.js), its star lighting what's near it.
// - Swapping: when the camera crosses into a sector, what the new centre
//   needs is staged hidden and shown in one frame once it's all in, the old
//   ones drawing till then; a place with nothing before it (the first, or
//   after a jump) fades in over half a second.
//
// createExpanse(parent, { universe, tier, reduced, workers, far, budget, prepare, onSector, keyed, drawNebula })
//   → { root, update({ camera, ship, t, dt, now, hidden }), loaded(), sector(), sectors(),
//       nearestSystem(at), stars(), solids(), setStep(step, floor), pops(), workMs(), reload(key), dispose() }
// sectorPools(workers, budget) → the runtime's pool with the two sector pools defined
//   (the 3 × 3 × 3's, a worker a thread the budget allows; the beyond's, one, so its
//   cache is one cache), or null where no worker can be made
// localPool() → a worker pool's request/cancel, run here a job a turn (for Node, or where workers can't be made)

import * as THREE from 'three';
import { SECTOR, sectorKey } from '../../../lib/space/address.js';
import { createChunkGrid3 } from '../../../runtime/chunkGrid3';
import { universeBudget } from '../../universe/budget';
import { STARS } from '../../universe/lighting';
import { beyondJob, sectorJob, withMoons } from '../gen/job';
import { spaceTime } from '../gen/orbits';
import { UNIVERSE } from '../gen/seed';
import { createDiscs } from './discs';
import { createNear } from './near';
import { nebula } from './sectors';

export const POOL = 'expanse';
export const BEYOND_POOL = 'expanse-beyond';
const NEAR_SLOTS = 54; // (the far layer's first 54 slots: the 27 shown and the 27 a crossing stages)
const BEYOND_SLOTS = 5; // (and two sets of 5 for the beyond, the one shown and the one staged)
const FADE_IN = 0.5;
const HALF = SECTOR / 2;

const keyOf = (x, y, z) => `${x},${y},${z}`;
const parse = (key) => key.split(',').map(Number);
const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));

export function sectorPools(workers, budget) {
  if (!workers?.define || typeof Worker !== 'function') return null;
  const make = () => new Worker(new URL('./sector.worker.js', import.meta.url), { type: 'module' });
  workers.define(POOL, make, { size: Math.max(1, budget.workers) });
  workers.define(BEYOND_POOL, make, { size: 1 });
  return workers;
}

export function localPool() {
  const live = new Map(); // name:key → { cancelled }
  const run = (msg) => (msg.type === 'beyond' ? beyondJob(msg, cache) : sectorJob(msg)).answer;
  const cache = new Map();
  return {
    request(name, msg) {
      const id = `${name}:${msg.key}`;
      live.get(id) && (live.get(id).cancelled = true);
      const job = { cancelled: false };
      live.set(id, job);
      return new Promise((resolve) =>
        setTimeout(() => {
          if (live.get(id) === job) live.delete(id);
          resolve(job.cancelled ? null : run(msg));
        }, 0),
      );
    },
    cancel(name, key) {
      const job = live.get(`${name}:${key}`);
      if (job) job.cancelled = true;
    },
  };
}

export function createExpanse(parent, { universe = UNIVERSE, tier = 'mid', workers = null, far = null, budget = universeBudget({ tier }), prepare = null, onSector = null, keyed = false, drawNebula = nebula } = {}) {
  const root = new THREE.Group();
  root.name = 'expanse';
  parent.add(root);
  const pool = workers ?? localPool();
  const grid = createChunkGrid3({ size: SECTOR, radius: 1, inFlight: Math.max(1, budget.workers) });
  const discs = far ? createDiscs(far.discs, { budget, keyed }) : null;
  const near = createNear(root, { budget, tier, prepare });

  const loaded = new Map(); // grid key → { key, id, sector, stars, slot, staged, nebulae }
  const inbox = []; // answers waiting to be taken in
  const freeNear = Array.from({ length: NEAR_SLOTS }, (_, i) => i);
  const beyondSets = [Array.from({ length: BEYOND_SLOTS }, (_, i) => NEAR_SLOTS + i), Array.from({ length: BEYOND_SLOTS }, (_, i) => NEAR_SLOTS + BEYOND_SLOTS + i)];
  let beyondShown = -1; // which set is drawn (0 or 1), -1 none
  let beyondFor = null; // the centre key the staged set holds, once in
  let beyondAsked = null; // the centre key last asked for
  let centre = null; // [cx, cy, cz] the camera's sector
  let shownCentre = null; // the centre whose slots are drawn
  let hiddenNow = false;
  let lastMs = 0;
  let step = 0;
  let floored = false;

  const camAt = new THREE.Vector3();
  const cam = [0, 0, 0];
  const nearSectors = [];
  const nearSystems = [];
  const starList = [...STARS]; // (the hand-made stars from the first: the lights are worked out before the first update)

  const freeSlot = (rec) => {
    if (rec.slot < 0) return;
    far?.hideSlots([rec.slot]);
    freeNear.push(rec.slot);
    rec.slot = -1;
    rec.staged = false;
    for (const n of rec.nebulae) {
      n.removeFromParent();
      n.geometry.dispose();
      n.material.dispose();
    }
    rec.nebulae.length = 0;
  };
  const drop = (key) => {
    const rec = loaded.get(key);
    if (!rec) return;
    freeSlot(rec);
    loaded.delete(key);
    grid.unload(key);
  };
  const giveSlot = (rec) => {
    if (rec.slot >= 0 || !freeNear.length || !far) return;
    rec.slot = freeNear.shift();
    far.setSlot(rec.slot, { centre: rec.sector.origin, ...rec.stars });
    rec.staged = true;
    if (drawNebula) {
      for (const w of rec.sector.wonders) {
        if (w.kind !== 'nebula') continue;
        const pts = drawNebula(w, []);
        pts.position.set(...w.at);
        pts.name = `wonder:${w.id}`;
        root.add(pts);
        rec.nebulae.push(pts);
      }
    }
  };
  const askBeyond = (c) => {
    const key = keyOf(...c);
    if (beyondAsked === key) return;
    beyondAsked = key;
    beyondFor = null;
    const set = beyondShown === 0 ? 1 : 0;
    const cap = BEYOND_SLOTS * (far?.slotSize ?? 400);
    pool.request(BEYOND_POOL, { type: 'beyond', key: `beyond:${key}`, universe, centre: c, ring: Math.max(1, budget.beyondRings), cap }).then((answer) => {
      if (!answer || beyondAsked !== key || !far) return;
      // the beyond's stars split across the set's slots, all from the one centre
      const per = far.slotSize ?? 400;
      const { at, color, r, count } = answer.stars;
      beyondSets[set].forEach((slot, i) => {
        const from = i * per;
        const n = Math.max(0, Math.min(per, count - from));
        far.setSlot(slot, { centre: [c[0] * SECTOR, c[1] * SECTOR, c[2] * SECTOR], at: at.subarray(from * 3, (from + n) * 3), color: color.subarray(from * 3, (from + n) * 3), r: r.subarray(from, from + n), count: n });
      });
      beyondFor = key;
    });
  };

  const api = {
    root,
    update({ camera, ship = null, t = 0, dt = 1 / 60, now = Date.now(), hidden = false }) {
      const t0 = performance.now();
      parent.updateWorldMatrix(true, false);
      parent.worldToLocal(camera.getWorldPosition(camAt));
      cam[0] = camAt.x;
      cam[1] = camAt.y;
      cam[2] = camAt.z;
      // ── what's come back taken in first, within the budget's time (so the workers it frees are asked again this frame) ──
      while (inbox.length && performance.now() - t0 < budget.expanseMs) {
        const { k, gen, answer } = inbox.shift();
        if (!grid.done(k, gen)) continue;
        const [sx, sy, sz] = parse(k);
        loaded.set(k, { key: k, id: sectorKey(sx, sy, sz), sector: withMoons(answer.sector), stars: answer.stars, slot: -1, staged: false, nebulae: [] });
      }
      // ── what to load: the 3 × 3 × 3 round the camera, ahead first ──
      const nose = ship && Number.isFinite(ship.heading) ? [-Math.sin(ship.heading) * Math.cos(ship.pitch || 0), Math.sin(ship.pitch || 0), -Math.cos(ship.heading) * Math.cos(ship.pitch || 0)] : null;
      const { ask, drop: gone, cancel } = grid.update({ x: cam[0] + HALF, y: cam[1] + HALF, z: cam[2] + HALF, heading: nose });
      for (const k of cancel) pool.cancel(POOL, k);
      for (const k of gone) drop(k);
      ask.forEach((k, i) => {
        const gen = grid.gen;
        grid.began(k, gen);
        const [sx, sy, sz] = parse(k);
        pool.request(POOL, { type: 'sector', key: k, priority: i, universe, sx, sy, sz }).then((answer) => {
          if (answer) inbox.push({ k, gen, answer });
          else grid.failed(k, gen);
        });
      });
      // ── the centre, and what it draws ──
      const c = grid.cellOf(cam[0] + HALF, cam[1] + HALF, cam[2] + HALF);
      const moved = !centre || cheb(c, centre) > 0;
      if (moved) {
        centre = c;
        onSector?.(sectorKey(...c));
      }
      askBeyond(centre);
      nearSectors.length = 0;
      nearSystems.length = 0;
      let ready = true;
      for (let z = -1; z <= 1; z++)
        for (let y = -1; y <= 1; y++)
          for (let x = -1; x <= 1; x++) {
            const rec = loaded.get(keyOf(centre[0] + x, centre[1] + y, centre[2] + z));
            if (!rec) {
              ready = false;
              continue;
            }
            giveSlot(rec);
            nearSectors.push(rec.sector);
            for (const s of rec.sector.systems) nearSystems.push(s);
          }
      // a jump: what's drawn is far behind, and goes at once
      if (shownCentre && cheb(centre, shownCentre) > 1) {
        for (const rec of loaded.values()) if (rec.slot >= 0 && cheb(parse(rec.key), centre) > 1) freeSlot(rec);
        if (beyondShown >= 0) far?.hideSlots(beyondSets[beyondShown]);
        beyondShown = -1;
        shownCentre = null;
      }
      const beyondIn = beyondFor === keyOf(...centre);
      const staged = [...loaded.values()].filter((r) => r.staged);
      if (far && ready && beyondIn && (staged.length || !shownCentre || keyOf(...shownCentre) !== keyOf(...centre))) {
        const set = beyondShown === 0 ? 1 : 0;
        const fresh = !shownCentre;
        const show = [...staged.map((r) => r.slot), ...(beyondShown === set ? [] : beyondSets[set])];
        if (fresh) for (const s of show) far.fadeSlot(s, FADE_IN);
        else far.showSlots(show);
        if (beyondShown >= 0 && beyondShown !== set) far.hideSlots(beyondSets[beyondShown]);
        beyondShown = set;
        for (const r of staged) r.staged = false;
        // the sectors left behind give their slots back
        for (const rec of loaded.values()) if (rec.slot >= 0 && cheb(parse(rec.key), centre) > 1) freeSlot(rec);
        shownCentre = centre;
      }
      // ── hidden (on foot, in the Rick and Morty pocket, the dive): nothing of it drawn ──
      if (hidden !== hiddenNow) {
        hiddenNow = hidden;
        root.visible = !hidden;
        const shownSlots = [...loaded.values()].filter((r) => r.slot >= 0 && !r.staged).map((r) => r.slot);
        if (beyondShown >= 0) shownSlots.push(...beyondSets[beyondShown]);
        if (hidden) far?.hideSlots(shownSlots);
        else far?.showSlots(shownSlots);
      }
      // ── the bodies: built whole within a system's reach, discs to the far plane ──
      const orbitT = spaceTime(now);
      near.update(hidden ? [] : nearSystems, cam, orbitT, camera);
      if (discs) {
        if (hidden) {
          far.discs.begin();
          far.discs.end();
        } else discs.feed(nearSectors, cam, orbitT, near.built());
      }
      starList.length = 0;
      for (const s of STARS) starList.push(s);
      for (const s of near.stars()) starList.push(s);
      lastMs = performance.now() - t0;
      void t;
      void dt;
    },
    loaded: () => [...loaded.values()].map((r) => r.id),
    sector: () => (centre ? sectorKey(...centre) : null),
    sectors: () => new Map([...loaded.values()].map((r) => [r.id, r.sector])),
    nearestSystem(at) {
      let best = null;
      for (const rec of loaded.values())
        for (const s of rec.sector.systems) {
          const d = Math.hypot(s.at[0] - at[0], s.at[1] - at[1], s.at[2] - at[2]);
          if (!best || d < best.dist) best = { system: s, sector: rec.sector, dist: d };
        }
      return best;
    },
    stars: () => starList,
    solids: () => near.solids(),
    built: () => near.built(),
    setStep(s, floor = false) {
      step = s;
      floored = floor;
      near.setStep(s);
    },
    budgetNow: () => universeBudget({ tier }, step, floored),
    pops: () => far?.pops() ?? { count: 0, px: 0 },
    workMs: () => lastMs,
    reload(key) {
      const rec = [...loaded.values()].find((r) => r.id === key || r.key === key);
      if (rec) drop(rec.key);
    },
    dispose() {
      for (const k of [...loaded.keys()]) drop(k);
      for (const k of grid.flying.keys()) pool.cancel(POOL, k);
      grid.reset();
      if (beyondShown >= 0) far?.hideSlots(beyondSets[beyondShown]);
      beyondShown = -1;
      near.dispose();
      if (far) {
        far.discs.begin();
        far.discs.end();
      }
      inbox.length = 0;
      root.clear();
      root.removeFromParent();
    },
  };
  return api;
}
