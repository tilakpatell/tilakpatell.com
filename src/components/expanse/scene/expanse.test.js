import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createExpanse, activeAt } from './expanse';
import { RIM, SECTORS } from '../../universe/layout';

// fakes for the drawing: what was made and let go
function fakes() {
  const made = new Map();
  const make = (sector) => {
    const group = new THREE.Group();
    const s = { group, sector, disposed: false, update() {}, dispose: () => ((s.disposed = true), group.removeFromParent()) };
    made.set(sector.id, s);
    return s;
  };
  const field = { builds: [], rebuild: (u, sx, sz) => field.builds.push([sx, sz]), update() {}, dispose() {}, size: () => 0 };
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
    const ex = createExpanse(parent, { make: f.make, makeStarfield: f.makeStarfield });
    run(1000, { ex }, 30);
    expect(f.made.size).toBe(0);
    expect(f.field.builds).toHaveLength(0);
    expect(ex.loaded()).toEqual([]);
  });

  it('loads the 3 × 3 round the ship one a frame past the rim, never the authored sector, and the star field beyond', () => {
    const f = fakes();
    const parent = new THREE.Group();
    const ex = createExpanse(parent, { make: f.make, makeStarfield: f.makeStarfield });
    run(90000, { ex }, 1);
    expect(f.made.size).toBe(1);
    run(90000, { ex }, 20);
    expect([...f.made.keys()].sort()).toEqual(['E:0,-1', 'E:0,1', 'E:1,-1', 'E:1,0', 'E:1,1', 'E:2,-1', 'E:2,0', 'E:2,1'].sort());
    expect(f.field.builds.at(-1)).toEqual([1, 0]);
    // back inside the rim: all of it let go
    run(0, { ex }, 2);
    expect([...f.made.values()].every((s) => s.disposed)).toBe(true);
    expect(ex.loaded()).toEqual([]);
  });

  it('stays at the map’s middle however far out, nothing re-anchored: the map is drawn round the camera (relative.js)', () => {
    const f = fakes();
    const parent = new THREE.Group();
    const ex = createExpanse(parent, { make: f.make, makeStarfield: f.makeStarfield });
    // (past the authored map’s 54,000 edge, where a floating origin used to move)
    run(55001, { ex }, 12);
    expect(ex.root.position.toArray()).toEqual([0, 0, 0]);
    // (and eight sectors out: the ship’s own numbers go through whole)
    run(1000000, { ex }, 12);
    expect(ex.root.position.toArray()).toEqual([0, 0, 0]);
    expect(f.field.builds.at(-1)).toEqual([8, 0]);
    expect(ex.sector()).toBe('E:8,0');
    expect(ex.loaded().every((id) => id.startsWith('E:'))).toBe(true);
    // and back home, as it was
    run(0, { ex }, 2);
    expect(ex.root.position.toArray()).toEqual([0, 0, 0]);
    expect(ex.loaded()).toEqual([]);
  });

  it('lets go of everything on dispose', () => {
    const f = fakes();
    const parent = new THREE.Group();
    const ex = createExpanse(parent, { make: f.make, makeStarfield: f.makeStarfield });
    run(120000, { ex }, 15);
    ex.dispose();
    expect([...f.made.values()].every((s) => s.disposed)).toBe(true);
    expect(parent.children).toHaveLength(0);
  });
});
