import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createExpanse, farRoom } from './expanse';
import { SECTOR, sectorCentre, sectorKey } from '../../../lib/space/address';
import { RIM, SECTORS } from '../../universe/layout';
import { STARS } from '../../universe/shared/space';
import { POOLS, beyondJob, beyondKeys } from '../gen/job';
import { orbitAt, spaceTime } from '../gen/orbits';
import { makeSector } from '../gen/sector';
import { UNIVERSE } from '../gen/seed';
import { addBodies } from '../gen/systems';
import { createNear, strengthOf } from './near';
import { starsOf } from './specks';
import { universeBudget } from '../../universe/shared/far';

// fakes for the drawing: what was made, and let go
function fakes() {
  const made = new Map();
  const make = (sector) => {
    const group = new THREE.Group();
    const s = { group, sector, disposed: false, update() {}, dispose: () => ((s.disposed = true), group.removeFromParent()) };
    made.set(sector.id, s);
    return s;
  };
  return { made, make };
}
// a far layer that keeps what it's given: its slots, the edge, and a list of discs a frame
function fakeFar() {
  const far = {
    slots: new Map(), // slot → what it holds
    shown: new Set(),
    fades: [],
    sets: [], // every setSlot, in order: [slot, what]
    edges: [],
    frames: [],
    rows: null,
    setSlot(i, slot) {
      far.slots.set(i, slot);
      far.shown.delete(i);
      far.sets.push([i, slot]);
    },
    fadeSlot(i, seconds) {
      far.fades.push([i, seconds]);
      far.shown.add(i);
    },
    showSlots(list) {
      for (const i of list) far.shown.add(i);
    },
    hideSlots(list) {
      for (const i of list) far.shown.delete(i);
    },
    setEdge(e) {
      far.edges.push(e);
    },
    discs: {
      begin() {
        far.rows = [];
      },
      push(...row) {
        far.rows.push(row);
      },
      end() {
        far.frames.push(far.rows);
      },
    },
  };
  return far;
}
const MID = universeBudget({ tier: 'mid' });
// what a fake far layer shows: the sectors' own slots (their ids), and the rings' (their centres)
const nearShown = (far) => [...far.shown].filter((i) => i < MID.nearSlots).map((i) => far.slots.get(i).key).sort();
const ringsShown = (far) => [...far.shown].filter((i) => i >= MID.nearSlots).map((i) => far.slots.get(i).centre.join(','));
// the 3 × 3 × 3 round a sector, by id
const round = ([sx, sy, sz], r = 1) => {
  const out = [];
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) out.push(sectorKey(sx + dx, sy + dy, sz + dz));
  return out.sort();
};

// a stand-in for a sector, one star well above its middle (a real one takes
// the worker a tenth of a second, and these tests ask for dozens)
const tiny = (universe, sx, sy, sz) => {
  const origin = sectorCentre(sx, sy, sz);
  const id = sectorKey(sx, sy, sz);
  const systems = [{ id: `${id}:0`, i: 0, at: [origin[0], origin[1] + 30000, origin[2]], reach: 400, star: { size: 40, color: '#ffeedd', class: 'G' }, planets: [] }];
  return { id, sx, sy, sz, seed: 0n, origin, systems, wonders: [], beacons: {}, things: { count: 0 }, extras: {}, legacy: { systems: 0, wonders: 0 } };
};
// a pool that answers as the worker does, with the stand-ins, on a later
// microtask; or, `late`, only when it's told to (`answer(key)`), cancelled or not
function fakePool() {
  const cache = new Map();
  const pool = {
    late: false,
    defined: [],
    asked: [], // every job asked, in order
    cancelled: [],
    held: new Map(), // key → { name, msg, resolve }
    define(name, make, o) {
      pool.defined.push([name, o?.size]);
    },
    request(name, msg) {
      pool.asked.push({ name, ...msg });
      return new Promise((resolve) => {
        pool.held.set(msg.key, { name, msg, resolve });
        if (!pool.late) Promise.resolve().then(() => pool.answer(msg.key));
      });
    },
    answer(key) {
      const h = pool.held.get(key);
      if (!h) return;
      pool.held.delete(key);
      const { msg } = h;
      if (msg.type === 'beyond') h.resolve(beyondJob(msg, cache, tiny).answer);
      else {
        const sector = tiny(msg.universe, msg.sx, msg.sy, msg.sz);
        h.resolve({ key: msg.key, sector, stars: starsOf(sector) });
      }
    },
    // the oldest job held (of the pool named, if one is)
    next: (name) => [...pool.held.values()].find((h) => !name || h.name === name)?.msg.key,
    cancel(name, key) {
      pool.cancelled.push(key);
      const h = pool.held.get(key);
      if (h && !pool.late) {
        pool.held.delete(key);
        h.resolve(null);
      }
    },
    flying: (name) => [...pool.held.values()].filter((h) => h.name === name).length,
    askedFor: (name) => pool.asked.filter((m) => m.name === name),
  };
  return pool;
}
// (every answer in, and taken)
const settle = () => new Promise((r) => setTimeout(r, 0));
// a frame with the ship at a point and the camera on it (and, `frame`, then what's come in)
const cam3 = new THREE.PerspectiveCamera();
const update = (ex, [x, y, z], { heading = -Math.PI / 2, pitch = 0, dt = 1 / 60 } = {}) => {
  cam3.position.set(x, y, z);
  cam3.updateMatrixWorld();
  ex.update({ ship: { x, y, z, heading, pitch }, camera: cam3, t: 0, dt });
};
const frame = async (ex, at, o) => {
  update(ex, at, o);
  await settle();
};
// frames at a point till `done` holds (or `most` of them)
const until = async (ex, at, done, most = 200) => {
  for (let i = 0; i < most && !done(); i++) await frame(ex, at);
  return done();
};
const expanseOf = (o = {}) => {
  const pool = fakePool();
  const far = fakeFar();
  const parent = new THREE.Group();
  const ex = createExpanse(parent, { workers: pool, far, tier: 'mid', ...o });
  return { pool, far, parent, ex };
};
// everything near and the ring round a centre in, and drawn
const whole = (pool, far, centre) => () => pool.held.size === 0 && nearShown(far).join() === round(centre).join() && ringsShown(far).join() === sectorCentre(...centre).join();

describe('the Expanse, everywhere', () => {
  it('loads the core’s sector and its 26 neighbours from home, above and below it too, nearest first, no more at once than the budget’s workers', async () => {
    const { pool, ex } = expanseOf();
    expect(pool.defined).toEqual([
      [POOLS.sector, MID.workers],
      [POOLS.beyond, 1],
    ]);
    let most = 0;
    for (let i = 0; i < 100 && ex.loaded().length < 27; i++) {
      update(ex, [0, 0, 0]);
      most = Math.max(most, pool.flying(POOLS.sector));
      await settle();
    }
    expect(ex.loaded().sort()).toEqual(round([0, 0, 0]));
    expect(ex.loaded()).toContain('E:0,0,1');
    expect(ex.loaded()).toContain('E:0,0,-1');
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(MID.workers);
    const sectors = pool.askedFor(POOLS.sector);
    expect(sectors[0]).toMatchObject({ type: 'sector', sx: 0, sy: 0, sz: 0, universe: UNIVERSE });
    expect(new Set(sectors.map((m) => m.key)).size).toBe(27);
    // its sectors as the worker made them, and the ring beyond round the core
    expect(ex.sectors()).toBeInstanceOf(Map);
    expect(ex.sectors().get('E:0,0,1')).toMatchObject({ id: 'E:0,0,1', origin: [0, SECTOR, 0] });
    expect(pool.askedFor(POOLS.beyond)).toMatchObject([{ type: 'beyond', centre: [0, 0, 0], ring: 1, universe: UNIVERSE }]);
    expect(ex.sector()).toBe('E:0,0');
    ex.dispose();
  });

  it('gives each sector a slot of the far layer, its stars from its middle, and the ring beyond one of its own, faded in where nothing was', async () => {
    const { pool, far, ex } = expanseOf();
    expect(await until(ex, [0, 0, 0], whole(pool, far, [0, 0, 0]))).toBe(true);
    for (const i of far.shown) {
      const slot = far.slots.get(i);
      if (i >= MID.nearSlots) continue;
      const s = ex.sectors().get(slot.key);
      expect(slot).toEqual({ centre: s.origin, ...starsOf(s), key: s.id });
    }
    // the ring: every sector round the 3 × 3 × 3, a speck a star, named as it holds them
    const [ring] = [...far.shown].filter((i) => i >= MID.nearSlots);
    const keys = beyondKeys([0, 0, 0], 1);
    expect(far.slots.get(ring).count).toBe(keys.length);
    expect(far.slots.get(ring).key).toEqual(['beyond:1', ...keys.map((c) => sectorKey(...c))]);
    // each faded in, as nothing was there before
    expect(far.fades).toHaveLength(28);
    for (const [, seconds] of far.fades) expect(seconds).toBe(0.5);
    ex.dispose();
  });

  it('asks and lets go of nothing new flying from inside the old rim to past it', async () => {
    const { pool, far, ex } = expanseOf();
    expect(await until(ex, [RIM.inner - 1000, 0, 0], whole(pool, far, [0, 0, 0]))).toBe(true);
    const asked = pool.asked.length;
    const loaded = ex.loaded().sort();
    for (let x = RIM.inner - 1000; x <= RIM.outer + 1000; x += 100) await frame(ex, [x, 0, 0]);
    expect(pool.asked).toHaveLength(asked);
    expect(pool.cancelled).toEqual([]);
    expect(ex.loaded().sort()).toEqual(loaded);
    expect(nearShown(far)).toEqual(round([0, 0, 0]));
    ex.dispose();
  });

  it('crossing a face, asks for the next face and swaps to it in one update once the last of it is in, never drawing both centres or neither', async () => {
    const { pool, far, ex } = expanseOf();
    expect(await until(ex, [59000, 0, 0], whole(pool, far, [0, 0, 0]))).toBe(true);
    const before = pool.asked.length;
    pool.late = true;
    const A = round([0, 0, 0]).join();
    const B = round([1, 0, 0]).join();
    const seen = [];
    let landedAt = -1;
    let swappedAt = -1;
    for (let i = 0, x = 59000; i < 120 && swappedAt < 0; i++, x = Math.min(64000, x + 500)) {
      // (one answer a frame, the oldest asked, in before the frame)
      const key = pool.next();
      if (key) {
        pool.answer(key);
        await settle();
        landedAt = i;
      }
      await frame(ex, [x, 0, 0]);
      const shown = nearShown(far).join();
      const ring = ringsShown(far);
      seen.push(shown);
      expect(shown === A || shown === B).toBe(true);
      expect(ring).toEqual([shown === A ? '0,0,0' : `${SECTOR},0,0`]);
      expect(ex.root.position.toArray()).toEqual([0, 0, 0]);
      if (shown === B) swappedAt = i;
    }
    // the new face of nine asked, and the ring round the next centre, nothing else
    const asked = pool.asked.slice(before);
    const was = new Set(round([0, 0, 0]));
    expect(asked.filter((m) => m.name === POOLS.sector).map((m) => sectorKey(m.sx, m.sy, m.sz)).sort()).toEqual(round([1, 0, 0]).filter((k) => !was.has(k)));
    expect(asked.filter((m) => m.name === POOLS.beyond)).toMatchObject([{ centre: [1, 0, 0], ring: 1 }]);
    // swapped in the update after the last of it came, and never back
    expect(swappedAt).toBe(landedAt);
    expect(seen.indexOf(B)).toBe(swappedAt);
    ex.dispose();
  });

  it('jumped a thousand sectors off, refuses what comes late for where it was, never draws the two together, and keeps nothing of before once the new place is in', async () => {
    const { pool, far, ex } = expanseOf();
    pool.late = true;
    for (let i = 0; i < 6; i++) {
      pool.answer(pool.next(POOLS.sector));
      await frame(ex, [0, 0, 0]);
    }
    expect(ex.loaded().length).toBeGreaterThan(0);
    const old = new Set(round([0, 0, 0]));
    const stale = [...pool.held.keys()];
    expect(stale.length).toBeGreaterThan(0);
    const sets = far.sets.length;
    await frame(ex, [1.2e8, 0, 0]);
    // what was drawn goes at once, and the old jobs are let go
    expect(far.shown.size).toBe(0);
    for (const k of stale) expect(pool.cancelled).toContain(k);
    // the old jobs' answers, come late anyway: refused
    for (const k of stale) pool.answer(k);
    await frame(ex, [1.2e8, 0, 0]);
    await frame(ex, [1.2e8, 0, 0]);
    for (const [, slot] of far.sets.slice(sets)) expect(old.has(slot.key)).toBe(false);
    // the new place, faded in as it comes, and nothing else
    pool.late = false;
    for (const k of [...pool.held.keys()]) pool.answer(k);
    expect(await until(ex, [1.2e8, 0, 0], whole(pool, far, [1000, 0, 0]))).toBe(true);
    expect(ex.loaded().sort()).toEqual(round([1000, 0, 0]));
    expect(ex.sector()).toBe('E:1000,0');
    expect(ex.root.position.toArray()).toEqual([0, 0, 0]);
    ex.dispose();
  });

  it('sitting on a face for 300 frames asks for each sector once and keeps drawing the one centre', async () => {
    const { pool, far, ex } = expanseOf();
    const shown = [];
    for (let i = 0; i < 300; i++) {
      await frame(ex, [SECTOR / 2 + (i % 2 ? 0.5 : -0.5), 0, 0]);
      shown.push(nearShown(far).join());
      expect(ex.root.position.toArray()).toEqual([0, 0, 0]);
    }
    const keys = pool.asked.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
    // both sides of the face, the 3 × 3 × 2 + 9 + 9, and the one ring
    expect(pool.askedFor(POOLS.sector)).toHaveLength(36);
    expect(pool.askedFor(POOLS.beyond)).toHaveLength(1);
    // (the side it started on, once that's in, from then on)
    const A = round([0, 0, 0]).join();
    expect(shown.indexOf(A)).toBeGreaterThan(0);
    expect(new Set(shown.slice(shown.indexOf(A)))).toEqual(new Set([A]));
    ex.dispose();
  });

  it('lets everything go on dispose: cancels what’s still out, hides every slot and empties its root', async () => {
    const { pool, far, parent, ex } = expanseOf();
    pool.late = true;
    for (let i = 0; i < 4; i++) {
      pool.answer(pool.next(POOLS.sector));
      await frame(ex, [0, 0, 0]);
    }
    expect(far.shown.size).toBeGreaterThan(0);
    const out = [...pool.held.keys()];
    expect(out.length).toBeGreaterThan(1);
    ex.dispose();
    for (const k of out) expect(pool.cancelled).toContain(k);
    expect(far.shown.size).toBe(0);
    expect(ex.root.children).toHaveLength(0);
    expect(parent.children).toHaveLength(0);
    expect(ex.loaded()).toEqual([]);
  });

  it('lets everything go with no ship and in the Rick and Morty pocket, and comes back after', async () => {
    const { pool, far, ex } = expanseOf();
    expect(await until(ex, [0, 0, 0], whole(pool, far, [0, 0, 0]))).toBe(true);
    ex.update({ ship: null, camera: cam3, t: 0, dt: 1 / 60 });
    expect(ex.loaded()).toEqual([]);
    expect(far.shown.size).toBe(0);
    expect(far.frames.at(-1)).toEqual([]);
    expect(await until(ex, [0, 0, 0], whole(pool, far, [0, 0, 0]))).toBe(true);
    await frame(ex, SECTORS.rickmorty.origin);
    expect(ex.loaded()).toEqual([]);
    expect(far.shown.size).toBe(0);
    ex.dispose();
  });

  it('tells where the ship is as it changes, by the map’s own sectors', async () => {
    const said = [];
    const { ex } = expanseOf({ onSector: (id) => said.push(id) });
    await frame(ex, [0, 0, 0]);
    await frame(ex, [1000, 0, 0]);
    await frame(ex, [57000, 0, 0]);
    await frame(ex, [90000, 0, 0]);
    await frame(ex, [90000, 130000, 0]);
    expect(said).toEqual(['main', 'E:0,0', 'E:1,0', 'E:1,0,1']);
    expect(ex.sector()).toBe('E:1,0,1');
    ex.dispose();
  });

  it('fades the far layer’s specks out at the edge of what it draws, easing it out after a swap and in at once', async () => {
    const { pool, far, ex } = expanseOf();
    expect(await until(ex, [0, 0, 0], whole(pool, far, [0, 0, 0]))).toBe(true);
    for (let i = 0; i < 200; i++) await frame(ex, [0, 0, 0], { dt: 1 / 30 });
    // (the 3 × 3 × 3 and the ring round it: two and a half sectors out)
    expect(far.edges.at(-1)).toBeCloseTo(2.5 * SECTOR, 3);
    // (never more than it was, plus half of what it wants a second)
    for (let i = 1; i < far.edges.length; i++) expect(far.edges[i] - far.edges[i - 1]).toBeLessThanOrEqual((0.5 * 2.5 * SECTOR) / 30 + 1e-6);
    await frame(ex, [20000, 0, 0]);
    expect(far.edges.at(-1)).toBeCloseTo(2.5 * SECTOR - 20000, 3);
    ex.dispose();
  });

  it('takes the pace’s step: no ring beyond from step 2 on a tier with one, and it back after', async () => {
    const { pool, far, ex } = expanseOf();
    expect(await until(ex, [0, 0, 0], whole(pool, far, [0, 0, 0]))).toBe(true);
    for (let i = 0; i < 200; i++) await frame(ex, [0, 0, 0], { dt: 1 / 30 });
    ex.setStep(2, false);
    await frame(ex, [0, 0, 0]);
    expect(ringsShown(far)).toEqual([]);
    expect(nearShown(far)).toEqual(round([0, 0, 0]));
    expect(far.edges.at(-1)).toBeCloseTo(1.5 * SECTOR, 3);
    ex.setStep(0, false);
    expect(await until(ex, [0, 0, 0], whole(pool, far, [0, 0, 0]))).toBe(true);
    expect(pool.askedFor(POOLS.beyond)).toHaveLength(2);
    ex.dispose();
  });

  it('makes a sector again when told, its slot swapped for the new in one update, never gone between', async () => {
    const { pool, far, ex } = expanseOf();
    expect(await until(ex, [0, 0, 0], whole(pool, far, [0, 0, 0]))).toBe(true);
    const slotOf = () => [...far.shown].find((i) => far.slots.get(i).key === 'E:1,0');
    const was = slotOf();
    pool.late = true;
    expect(ex.reload('E:1,0')).toBe(true);
    expect(pool.asked.at(-1)).toMatchObject({ type: 'sector', sx: 1, sy: 0, sz: 0 });
    for (let i = 0; i < 3; i++) {
      await frame(ex, [0, 0, 0]);
      expect(slotOf()).toBe(was);
    }
    pool.answer(pool.next());
    await settle();
    await frame(ex, [0, 0, 0]);
    expect(slotOf()).not.toBe(was);
    expect(far.shown.has(was)).toBe(false);
    expect(nearShown(far)).toEqual(round([0, 0, 0]));
    expect(ex.reload('E:9,9')).toBe(false); // (none it holds)
    ex.dispose();
  });

  it('finds the system nearest a point among what it holds', async () => {
    const { pool, far, ex } = expanseOf();
    expect(await until(ex, [0, 0, 0], whole(pool, far, [0, 0, 0]))).toBe(true);
    const near = ex.nearestSystem([SECTOR, 25000, 0]);
    expect(near.system.id).toBe('E:1,0:0');
    expect(near.sector).toBe(ex.sectors().get('E:1,0'));
    expect(near.dist).toBeCloseTo(5000, 6);
    ex.dispose();
    expect(ex.nearestSystem([0, 0, 0])).toBeNull();
  });

  it('says the most a frame of its own took since it was last asked', async () => {
    let now = 0;
    const timer = () => (now += 2);
    const { ex } = expanseOf({ timer });
    expect(ex.workMs()).toBe(0);
    await frame(ex, [0, 0, 0]);
    await frame(ex, [0, 0, 0]);
    expect(ex.workMs()).toBe(2);
    expect(ex.workMs()).toBe(0);
    ex.dispose();
  });

  it('with no pool, makes the sector the ship is in in process, the frame it’s asked, and nothing round it', () => {
    const far = fakeFar();
    const ex = createExpanse(new THREE.Group(), { far, tier: 'mid' });
    cam3.position.set(SECTOR, 0, 0);
    cam3.updateMatrixWorld();
    ex.update({ ship: { x: SECTOR, y: 0, z: 0, heading: 0 }, camera: cam3, t: 0, dt: 1 / 60 });
    expect(ex.loaded()).toEqual(['E:1,0']);
    expect(nearShown(far)).toEqual(['E:1,0']);
    expect(ringsShown(far)).toEqual([]);
    ex.dispose();
  });
});

describe('the Expanse’s levels', () => {
  // a body builder that builds nothing much
  const fakeBuild = (look, { r }) => ({ group: new THREE.Group(), radius: r, reach: r, update() {}, setSuns() {}, dispose() {} });
  const camera = new THREE.PerspectiveCamera();
  // the first system of E:1,0, and a camera 300 above its star with the ship there
  const AT = addBodies(makeSector(UNIVERSE, 1, 0));
  const SYS = AT.systems[0];
  const eye = new THREE.PerspectiveCamera();
  eye.position.set(SYS.at[0], SYS.at[1] + 300, SYS.at[2]);
  eye.updateMatrixWorld();
  const NOW = 1.7e12;
  const atSys = (ex, frames = 40, now = NOW) => {
    for (let i = 0; i < frames; i++) ex.update({ ship: { x: SYS.at[0], y: SYS.at[1], z: SYS.at[2], heading: 0 }, camera: eye, t: i / 60, dt: 1 / 60, now });
  };
  const run = (x, opts, frames = 12, z = 0) => {
    for (let i = 0; i < frames; i++) opts.ex.update({ ship: { x, y: 0, z, heading: -Math.PI / 2 }, camera, t: i / 60, dt: 1 / 60 });
  };

  it('builds the system the camera’s in, on the shared clock, and draws the rest within the far plane as discs', () => {
    const f = fakes();
    const far = fakeFar();
    const parent = new THREE.Group();
    const ex = createExpanse(parent, { make: f.make, far, makeNear: (group, o) => createNear(group, { ...o, build: fakeBuild }) });
    const sector = addBodies(makeSector(UNIVERSE, 1, 0));
    const [sys] = sector.systems;
    const cam = new THREE.PerspectiveCamera();
    cam.position.set(sys.at[0], sys.at[1] + 300, sys.at[2]);
    cam.updateMatrixWorld();
    const now = 1.7e12;
    for (let i = 0; i < 40; i++) ex.update({ ship: { x: sys.at[0], y: sys.at[1], z: sys.at[2], heading: 0 }, camera: cam, t: i / 60, dt: 1 / 60, now });
    // built, in the map's space, its planets where their orbits have them now
    const p = sys.planets[0];
    const built = parent.getObjectByName(`planet:${p.id}`);
    expect(built).toBeTruthy();
    const v = built.getWorldPosition(new THREE.Vector3());
    orbitAt(p, spaceTime(now)).forEach((x, k) => expect(v.getComponent(k)).toBeCloseTo(x, 6));
    // its discs given up to it; other systems' within the far plane drawn
    const ids = far.frames.at(-1).map((row) => row[11]);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.some((id) => id === sys.id || id.startsWith(`${sys.id}:`))).toBe(false);
    expect(ids.every((id) => typeof id === 'string' && id.startsWith('E:'))).toBe(true);
    // and all of it gone home
    run(0, { ex }, 2);
    expect(parent.getObjectByName(`planet:${p.id}`)).toBeUndefined();
  });

  it('with no far layer given, makes its own on its first frame with a ship, drawn only while there is one', () => {
    const f = fakes();
    const parent = new THREE.Group();
    const ex = createExpanse(parent, { make: f.make });
    const own = () => parent.children.find((o) => o.name === 'far-stars');
    ex.update({ ship: null, camera, t: 0, dt: 1 / 60 });
    expect(own()).toBeUndefined();
    run(1000, { ex }, 3);
    expect(own().visible).toBe(true);
    ex.update({ ship: null, camera, t: 0, dt: 1 / 60 });
    expect(own().visible).toBe(false);
    ex.dispose();
    expect(own()).toBeUndefined();
  });

  it('lends the light of the stars it builds after the map’s own, in one array kept from frame to frame', () => {
    const f = fakes();
    const ex = createExpanse(new THREE.Group(), { make: f.make, far: fakeFar(), build: fakeBuild });
    const lit = ex.stars();
    expect(lit).toEqual(STARS);
    atSys(ex);
    expect(ex.stars()).toBe(lit);
    expect(lit).toHaveLength(STARS.length + 1);
    STARS.forEach((s, i) => expect(lit[i]).toBe(s));
    expect(lit.at(-1)).toEqual({ id: SYS.id, at: SYS.at, r: SYS.star.size, colour: SYS.star.color, strength: strengthOf(SYS.star.class), reach: 3 * SYS.reach });
    atSys(ex, 2);
    expect(ex.stars()).toBe(lit);
    // home: the map's stars alone
    run(0, { ex }, 2);
    expect(ex.stars()).toBe(lit);
    expect(lit).toEqual(STARS);
  });

  it('lends what it builds as solids, each where it is now, in one array kept from frame to frame', () => {
    const f = fakes();
    const ex = createExpanse(new THREE.Group(), { make: f.make, far: fakeFar(), build: fakeBuild });
    expect(ex.solids()).toHaveLength(0);
    atSys(ex);
    const solids = ex.solids();
    const ids = solids.map((o) => o.id);
    expect(ids).toEqual([SYS.id, ...SYS.planets.flatMap((p) => [p.id, ...p.moonList.map((m) => m.id)])]);
    for (const o of solids) {
      expect(o.r).toBeGreaterThan(0);
      expect(o.reach).toBeGreaterThanOrEqual(o.r);
    }
    expect(solids[0].at).toEqual(SYS.at);
    // the planets where their orbits have them now, and a minute on, moved in place
    const p = SYS.planets[0];
    const one = solids.find((o) => o.id === p.id);
    orbitAt(p, spaceTime(NOW)).forEach((x, k) => expect(one.at[k]).toBeCloseTo(x, 6));
    atSys(ex, 1, NOW + 60000);
    expect(ex.solids()).toBe(solids);
    expect(solids.find((o) => o.id === p.id)).toBe(one);
    orbitAt(p, spaceTime(NOW + 60000)).forEach((x, k) => expect(one.at[k]).toBeCloseTo(x, 6));
    expect(Math.hypot(...one.at.map((x, k) => x - orbitAt(p, spaceTime(NOW))[k]))).toBeGreaterThan(0.1);
    // home: none
    run(0, { ex }, 2);
    expect(ex.solids()).toHaveLength(0);
  });

  it('builds with the body builder it is given', () => {
    const f = fakes();
    const looks = [];
    const build = (look, o) => (looks.push(look), fakeBuild(look, o));
    const parent = new THREE.Group();
    const ex = createExpanse(parent, { make: f.make, far: fakeFar(), build });
    atSys(ex);
    expect(looks.length).toBe(SYS.planets.reduce((n, p) => n + 1 + p.moonList.length, 0));
    expect(parent.getObjectByName(`planet:${SYS.planets[0].id}`)).toBeTruthy();
  });

  it('takes the pace’s step: fewer discs as the budget has it, and less detail in what it builds', () => {
    const f = fakes();
    const far = fakeFar();
    const steps = [];
    const makeNear = (group, o) => {
      const n = createNear(group, { ...o, build: fakeBuild });
      const set = n.setStep;
      n.setStep = (step) => (steps.push(step), set(step));
      return n;
    };
    const ex = createExpanse(new THREE.Group(), { make: f.make, far, makeNear, tier: 'low' });
    atSys(ex, 60);
    const whole = far.frames.at(-1).length;
    const least = universeBudget({ tier: 'low' }, 3, true).discs;
    expect(whole).toBeGreaterThan(least);
    ex.setStep(3, true);
    atSys(ex, 200);
    expect(far.frames.at(-1).length).toBeLessThanOrEqual(least);
    expect(far.frames.at(-1).length).toBeGreaterThan(0);
    ex.setStep(0, false);
    atSys(ex, 200);
    expect(far.frames.at(-1).length).toBe(whole);
    expect(steps).toEqual([3, 0]);
  });

  it('takes a step before its first frame, and its discs keep to it', () => {
    const f = fakes();
    const far = fakeFar();
    const ex = createExpanse(new THREE.Group(), { make: f.make, far, build: fakeBuild, tier: 'low' });
    ex.setStep(3, true);
    atSys(ex, 60);
    expect(far.frames.at(-1).length).toBeLessThanOrEqual(universeBudget({ tier: 'low' }, 3, true).discs);
  });

  it('says what came in at once in its far layer, and nothing before its first frame', () => {
    const f = fakes();
    const far = { ...fakeFar(), pops: () => ({ count: 2, px: 7 }) };
    far.discs = fakeFar().discs;
    const ex = createExpanse(new THREE.Group(), { make: f.make, far, build: fakeBuild });
    expect(ex.pops()).toEqual({ count: 0, px: 0 });
    atSys(ex, 3);
    expect(ex.pops()).toEqual({ count: 2, px: 7 });
    // and its own far layer's, when it's given none
    const own = createExpanse(new THREE.Group(), { make: f.make, build: fakeBuild });
    expect(own.pops()).toEqual({ count: 0, px: 0 });
    atSys(own, 3);
    const p = own.pops();
    expect(Number.isFinite(p.count) && Number.isFinite(p.px)).toBe(true);
  });

  it('sizes a far layer for a device’s level: the budget’s slots, A and B for each ring beyond, and room for half again its discs', () => {
    // (a ring's slot holds every star of its sectors: 98 round the 3 × 3 × 3, 218 the next out, 330 at most a sector)
    const ring = (r) => ((2 * r + 3) ** 3 - (2 * r + 1) ** 3) * 330;
    expect(ring(1)).toBe(98 * 330);
    expect(ring(2)).toBe(218 * 330);
    const mid = universeBudget({ tier: 'mid' });
    expect(farRoom({ tier: 'mid' })).toEqual({ slots: [...Array(mid.nearSlots).fill(mid.slotSize), ring(1), ring(1)], discs: Math.ceil(mid.discs * 1.5) });
    const ultra = universeBudget({ detail: 'ultra' });
    expect(farRoom({ tier: 'high', detail: 'ultra' })).toEqual({ slots: [...Array(ultra.nearSlots).fill(ultra.slotSize), ring(1), ring(1), ring(2), ring(2)], discs: Math.ceil(ultra.discs * 1.5) });
    // and its own far layer made so, for the level it's told
    const f = fakes();
    const parent = new THREE.Group();
    const ex = createExpanse(parent, { make: f.make, build: fakeBuild, tier: 'high', detail: 'ultra' });
    atSys(ex, 2);
    const room = farRoom({ detail: 'ultra' });
    const own = parent.children.find((o) => o.name === 'far-stars');
    expect(own.geometry.getAttribute('position').count).toBe(room.slots.reduce((a, b) => a + b, 0) + room.discs);
    ex.dispose();
  });
});
