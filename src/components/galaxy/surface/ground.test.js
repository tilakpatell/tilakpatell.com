import { describe, expect, it } from 'vitest';
import { groundMaterial } from './ground';
import { createGroundMap } from '../../../lib/three/groundmapNodes';
import { HALF } from './terrain';

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
