import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createExpanse, activeAt, farRoom } from './expanse';
import { createOrigin } from '../../../runtime/origin';
import { RIM, SECTORS } from '../../universe/layout';
import { STARS } from '../../universe/shared/space';
import { orbitAt, spaceTime } from '../gen/orbits';
import { makeSector } from '../gen/sector';
import { UNIVERSE } from '../gen/seed';
import { addBodies } from '../gen/systems';
import { createNear, strengthOf } from './near';
import { slotOf } from './sectors';
import { universeBudget } from '../../universe/shared/far';

// fakes for the drawing: what was made, re-anchored and let go
function fakes() {
  const made = new Map();
  const make = (sector) => {
    const group = new THREE.Group();
    const s = { group, sector, at: null, disposed: false, update() {}, reanchor: (at) => (s.at = at), dispose: () => ((s.disposed = true), group.removeFromParent()) };
    made.set(sector.id, s);
    return s;
  };
  const field = { builds: [], at: null, rebuild: (u, sx, sz, at) => field.builds.push([sx, sz, at]), update() {}, reanchor: (at) => (field.at = at), dispose() {}, size: () => 0 };
  return { made, make, makeStarfield: () => field, field };
}
// a far layer that keeps what it's given: its slots, and a list of discs a frame
function fakeFar() {
  const far = {
    slots: new Map(), // slot → what it holds
    shown: new Set(),
    fades: [],
    frames: [],
    rows: null,
    setSlot(i, slot) {
      far.slots.set(i, slot);
      far.shown.delete(i);
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
    keys: () => [...far.shown].map((i) => far.slots.get(i).key).sort(),
  };
  return far;
}
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

describe('the Expanse on the map', () => {
  it('is quiet inside the rim and in the Rick and Morty pocket, and wakes past the rim', () => {
    expect(activeAt({ x: 0, z: 0 }, false)).toBe(false);
    expect(activeAt({ x: RIM.inner - 10, z: 0 }, true)).toBe(false);
    expect(activeAt({ x: RIM.outer + 10, z: 0 }, false)).toBe(true);
    expect(activeAt({ x: RIM.outer - 10, z: 0 }, false)).toBe(false); // (in the band: as it was)
    expect(activeAt({ x: RIM.outer - 10, z: 0 }, true)).toBe(true);
    expect(activeAt({ x: 0, z: SECTORS.rickmorty.origin[2] }, true)).toBe(false);
    expect(activeAt({ x: 90000, z: 0 }, false)).toBe(true);
    expect(activeAt(null, true)).toBe(false);
  });

  it('builds nothing inside the rim', () => {
    const f = fakes();
    const parent = new THREE.Group();
    const ex = createExpanse(parent, { origin: createOrigin(), make: f.make, makeStarfield: f.makeStarfield });
    run(1000, { ex }, 30);
    expect(f.made.size).toBe(0);
    expect(f.field.builds).toHaveLength(0);
    expect(ex.loaded()).toEqual([]);
  });

  it('loads the 3 × 3 round the ship one a frame past the rim, never the authored sector, and the star field beyond', () => {
    const f = fakes();
    const parent = new THREE.Group();
    const ex = createExpanse(parent, { origin: createOrigin(), make: f.make, makeStarfield: f.makeStarfield });
    run(90000, { ex }, 1);
    expect(f.made.size).toBe(1);
    run(90000, { ex }, 20);
    expect([...f.made.keys()].sort()).toEqual(['E:0,-1', 'E:0,1', 'E:1,-1', 'E:1,0', 'E:1,1', 'E:2,-1', 'E:2,0', 'E:2,1'].sort());
    expect(f.field.builds.at(-1).slice(0, 2)).toEqual([1, 0]);
    // back inside the rim: all of it let go
    run(0, { ex }, 2);
    expect([...f.made.values()].every((s) => s.disposed)).toBe(true);
    expect(ex.loaded()).toEqual([]);
  });

  it('moves the floating origin by whole cells out in the Expanse, re-anchoring everything so nothing moves', () => {
    const f = fakes();
    const parent = new THREE.Group();
    const origin = createOrigin();
    const shifts = [];
    const ex = createExpanse(parent, { origin, make: f.make, makeStarfield: f.makeStarfield, onShift: (s) => shifts.push(s) });
    // (awake past the rim but still on the authored map, inside its 54,000 edge: no shift)
    run(53000, { ex }, 12);
    expect(origin.at).toEqual([0, 0, 0]);
    run(55001, { ex }, 1);
    expect(origin.at).toEqual([50000, 0, 0]);
    expect(shifts).toEqual([[50000, 0, 0]]);
    run(55001, { ex }, 12);
    // the root carries the origin; every sector re-anchored to it
    expect(ex.root.position.toArray()).toEqual([50000, 0, 0]);
    for (const s of f.made.values()) expect(s.at).toEqual([50000, 0, 0]);
    expect(f.field.at).toEqual([50000, 0, 0]);
    // and back home, the origin goes back to the map's middle
    run(0, { ex }, 2);
    expect(origin.at).toEqual([0, 0, 0]);
    expect(ex.root.position.toArray()).toEqual([0, 0, 0]);
  });

  it('lets go of everything on dispose', () => {
    const f = fakes();
    const parent = new THREE.Group();
    const origin = createOrigin();
    const ex = createExpanse(parent, { origin, make: f.make, makeStarfield: f.makeStarfield });
    run(120000, { ex }, 15);
    ex.dispose();
    expect([...f.made.values()].every((s) => s.disposed)).toBe(true);
    expect(parent.children).toHaveLength(0);
    expect(origin.at).toEqual([0, 0, 0]);
  });

  it('gives each sector it loads a slot of the far layer, its stars and wonders faded in, and hides it when the sector goes', () => {
    const f = fakes();
    const far = fakeFar();
    const ex = createExpanse(new THREE.Group(), { origin: createOrigin(), make: f.make, makeStarfield: f.makeStarfield, far });
    run(90000, { ex }, 20);
    const loaded = ['E:0,-1', 'E:0,1', 'E:1,-1', 'E:1,0', 'E:1,1', 'E:2,-1', 'E:2,0', 'E:2,1'];
    expect(far.keys()).toEqual(loaded.sort());
    expect(far.fades.length).toBe(8);
    for (const [, seconds] of far.fades) expect(seconds).toBeGreaterThan(0);
    const one = [...far.slots.values()].find((slot) => slot.key === 'E:2,1');
    expect(one).toEqual(slotOf(addBodies(makeSector(UNIVERSE, 2, 1))));
    // two sectors on: those let go behind hidden, their slots taken by those ahead
    run(210000, { ex }, 30);
    run(330000, { ex }, 30);
    expect(far.keys()).toEqual(ex.loaded().sort());
    expect(far.keys()).not.toContain('E:0,1');
    expect(far.keys()).toHaveLength(12);
    expect(far.fades.length).toBe(14); // (a column of three more each time)
    expect(Math.max(...far.slots.keys())).toBeLessThan(12); // (no more slots than are drawn at once)
    // home: every slot hidden, and the discs none
    run(0, { ex }, 2);
    expect(far.shown.size).toBe(0);
    expect(far.frames.at(-1)).toEqual([]);
  });

  it('builds the system the camera’s in, on the shared clock, and draws the rest within the far plane as discs', () => {
    const f = fakes();
    const far = fakeFar();
    const parent = new THREE.Group();
    const ex = createExpanse(parent, { origin: createOrigin(), make: f.make, makeStarfield: f.makeStarfield, far, makeNear: (group, o) => createNear(group, { ...o, build: fakeBuild }) });
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

  it('with no far layer given, makes its own when it first wakes, drawn only while it’s awake', () => {
    const f = fakes();
    const parent = new THREE.Group();
    const ex = createExpanse(parent, { origin: createOrigin(), make: f.make, makeStarfield: f.makeStarfield });
    const own = () => parent.children.find((o) => o.name === 'far-stars');
    run(1000, { ex }, 3);
    expect(own()).toBeUndefined();
    run(90000, { ex }, 3);
    expect(own().visible).toBe(true);
    run(0, { ex }, 2);
    expect(own().visible).toBe(false);
    ex.dispose();
    expect(own()).toBeUndefined();
  });

  it('lends the light of the stars it builds after the map’s own, in one array kept from frame to frame', () => {
    const f = fakes();
    const ex = createExpanse(new THREE.Group(), { origin: createOrigin(), make: f.make, makeStarfield: f.makeStarfield, far: fakeFar(), build: fakeBuild });
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
    const ex = createExpanse(new THREE.Group(), { origin: createOrigin(), make: f.make, makeStarfield: f.makeStarfield, far: fakeFar(), build: fakeBuild });
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
    const ex = createExpanse(parent, { origin: createOrigin(), make: f.make, makeStarfield: f.makeStarfield, far: fakeFar(), build });
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
    const ex = createExpanse(new THREE.Group(), { origin: createOrigin(), make: f.make, makeStarfield: f.makeStarfield, far, makeNear, tier: 'low' });
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

  it('takes a step before it first wakes, and its discs keep to it', () => {
    const f = fakes();
    const far = fakeFar();
    const ex = createExpanse(new THREE.Group(), { origin: createOrigin(), make: f.make, makeStarfield: f.makeStarfield, far, build: fakeBuild, tier: 'low' });
    ex.setStep(3, true);
    atSys(ex, 60);
    expect(far.frames.at(-1).length).toBeLessThanOrEqual(universeBudget({ tier: 'low' }, 3, true).discs);
  });

  it('says what came in at once in its far layer, and nothing before it wakes', () => {
    const f = fakes();
    const far = { ...fakeFar(), pops: () => ({ count: 2, px: 7 }) };
    far.discs = fakeFar().discs;
    const ex = createExpanse(new THREE.Group(), { origin: createOrigin(), make: f.make, makeStarfield: f.makeStarfield, far, build: fakeBuild });
    expect(ex.pops()).toEqual({ count: 0, px: 0 });
    atSys(ex, 3);
    expect(ex.pops()).toEqual({ count: 2, px: 7 });
    // and its own far layer's, when it's given none
    const own = createExpanse(new THREE.Group(), { origin: createOrigin(), make: f.make, makeStarfield: f.makeStarfield, build: fakeBuild });
    expect(own.pops()).toEqual({ count: 0, px: 0 });
    atSys(own, 3);
    const p = own.pops();
    expect(Number.isFinite(p.count) && Number.isFinite(p.px)).toBe(true);
  });

  it('sizes a far layer for a device’s level: the budget’s slots, and room for half again its discs', () => {
    const mid = universeBudget({ tier: 'mid' });
    expect(farRoom({ tier: 'mid' })).toEqual({ slots: Array(mid.nearSlots).fill(mid.slotSize), discs: Math.ceil(mid.discs * 1.5) });
    expect(farRoom({ tier: 'high', detail: 'ultra' }).discs).toBe(Math.ceil(universeBudget({ detail: 'ultra' }).discs * 1.5));
    // and its own far layer made so, for the level it's told
    const f = fakes();
    const parent = new THREE.Group();
    const ex = createExpanse(parent, { origin: createOrigin(), make: f.make, makeStarfield: f.makeStarfield, build: fakeBuild, tier: 'high', detail: 'ultra' });
    atSys(ex, 2);
    const room = farRoom({ detail: 'ultra' });
    const own = parent.children.find((o) => o.name === 'far-stars');
    expect(own.geometry.getAttribute('position').count).toBe(room.slots.reduce((a, b) => a + b, 0) + room.discs);
  });
});
