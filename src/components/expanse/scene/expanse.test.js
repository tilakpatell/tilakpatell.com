import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createExpanse, activeAt } from './expanse';
import { createOrigin } from '../../../runtime/origin';
import { RIM, SECTORS } from '../../universe/layout';
import { orbitAt, spaceTime } from '../gen/orbits';
import { makeSector } from '../gen/sector';
import { UNIVERSE } from '../gen/seed';
import { addBodies } from '../gen/systems';
import { createNear } from './near';
import { slotOf } from './sectors';

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
});
