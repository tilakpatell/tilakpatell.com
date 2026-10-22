import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createExpanse, activeAt } from './expanse';
import { createOrigin } from '../../../runtime/origin';
import { RIM, SECTORS } from '../../universe/layout';

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
    // (awake past the rim but still on the authored map, inside its edge: no shift)
    const edge = SECTORS.main.edge;
    expect(edge - 500).toBeGreaterThan(RIM.outer);
    run(edge - 500, { ex }, 12);
    expect(origin.at).toEqual([0, 0, 0]);
    run(edge + 1001, { ex }, 1);
    expect(origin.at).toEqual([50000, 0, 0]);
    expect(shifts).toEqual([[50000, 0, 0]]);
    run(edge + 1001, { ex }, 12);
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
});
