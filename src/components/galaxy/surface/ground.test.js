import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { groundBuild, groundGeometry, groundMaterial } from './ground';
import { createGroundMap } from '../../../lib/three/groundmapNodes';
import { HALF, heightGrid } from './terrain';

const site = { ground: { seed: 1, palette: { low: '#806040', high: '#608040' } } };

// (the floor on the node renderer: lib/three/groundLookNodes, keyed by what it reads)
describe('the floor', () => {
  it('reads the ground map’s colour inside the walkable square, under its own grain', () => {
    const map = createGroundMap({ area: { x0: -HALF, z0: -HALF, w: 2 * HALF, d: 2 * HALF }, size: 4, paint: (x, z, out) => ((out[0] = out[1] = out[2] = 0.5), 0) });
    const m = groundMaterial(site, { small: true, map });
    expect(m.material.isNodeMaterial).toBe(true);
    expect(m.material.customProgramCacheKey()).toContain('galaxy-ground:map');
    map.dispose();
  });

  it('keeps its own rule without a map', () => {
    expect(groundMaterial(site, { small: true }).material.customProgramCacheKey()).not.toContain('galaxy-ground:map');
  });
});

describe('the ground’s mesh', () => {
  const grid = heightGrid((x, z) => Math.sin(x / 30) * 6 + Math.cos(z / 22) * 4, { n: 64, grow: 1.2, centre: [320, -160] });

  it('lies where the grid lies, lit by three’s own vertex normals', () => {
    const geo = groundGeometry(grid);
    const pos = geo.attributes.position.array;
    expect(pos[0]).toBeCloseTo(320 + grid.lines[0], 4);
    expect(pos[2]).toBeCloseTo(-160 + grid.lines[0], 4);
    const theirs = new THREE.BufferGeometry();
    theirs.setAttribute('position', geo.attributes.position.clone());
    theirs.setIndex(geo.index.clone());
    theirs.computeVertexNormals();
    const a = geo.attributes.normal.array;
    const b = theirs.attributes.normal.array;
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i += 97) expect(a[i]).toBeCloseTo(b[i], 5);
    expect(geo.boundingSphere).not.toBeNull();
  });

  it('is made the same a few rows a frame, for the free roam’s move', () => {
    const build = groundBuild(grid);
    let frames = 1;
    while (!build.step(0)) frames++;
    expect(frames).toBeGreaterThan(60);
    const once = groundGeometry(grid);
    expect(build.geometry.attributes.normal.array).toEqual(once.attributes.normal.array);
    expect(build.geometry.index.array).toEqual(once.index.array);
  });
});
