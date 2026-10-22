import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as glsl from './grass';
import * as nodes from './grassNodes';
import { createGroundMap } from './groundmapNodes';
import { createWind } from './windNodes';
import { createGroundMap as glslMap } from './groundmap';
import { createWind as glslWind } from './wind';

const AREA = { x0: -10, z0: -10, w: 20, d: 20 };
const paint = () => 1;

describe('grassNodes, the twin of grass', () => {
  it('the same blades', () => {
    expect(Array.from(nodes.grassGeometry({ side: 6, size: 3 }).attributes.aBlade.array)).toEqual(Array.from(glsl.grassGeometry({ side: 6, size: 3 }).attributes.aBlade.array));
  });

  it('the same mesh, flags and uniforms, centred and set the same', () => {
    const a = glsl.createGrass({ ground: glslMap({ area: AREA, size: 4, paint }), wind: glslWind(), side: 6, size: 3 });
    const n = nodes.createGrass({ ground: createGroundMap({ area: AREA, size: 4, paint }), wind: createWind(), side: 6, size: 3 });
    expect(n.material.isMeshLambertNodeMaterial).toBe(true);
    expect(n.material.side).toBe(THREE.DoubleSide);
    expect(n.mesh).toMatchObject({ name: 'grass', frustumCulled: false, castShadow: false, receiveShadow: false });
    expect(Object.keys(n.uniforms).sort()).toEqual(Object.keys(a.uniforms).sort());
    for (const g of [a, n]) {
      g.update({ x: 3, z: 4 });
      g.set({ height: 0.8, width: 0.1, root: 0.2 });
    }
    for (const k of Object.keys(a.uniforms)) expect(n.uniforms[k].value?.toArray?.() ?? n.uniforms[k].value).toEqual(a.uniforms[k].value?.toArray?.() ?? a.uniforms[k].value);
    expect(n.material.customProgramCacheKey()).toContain('grass');
  });

  it('laid down near the camera only when asked: the same uniforms either way', () => {
    const ground = createGroundMap({ area: AREA, size: 4, paint });
    const a = nodes.createGrass({ ground, wind: createWind(), side: 6, size: 3 });
    const b = nodes.createGrass({ ground, wind: createWind(), side: 6, size: 3, near: 4 });
    expect(Object.keys(b.uniforms).sort()).toEqual(Object.keys(a.uniforms).sort());
    expect(b.mesh).toMatchObject({ name: 'grass', castShadow: false, receiveShadow: false });
  });

  it('grows curved blades when asked: five corners and three triangles each, tapering to one tip', () => {
    const g = nodes.grassGeometry({ side: 4, size: 2, shape: 'blade' });
    expect(g.getAttribute('position').count).toBe(16 * 5);
    expect(g.getIndex().count).toBe(16 * 9);
    const pos = g.getAttribute('position');
    // (the root two wide, the middle pair narrower, the tip a point)
    expect([pos.getX(0), pos.getX(1)]).toEqual([-1, 1]);
    expect(Math.abs(pos.getX(2))).toBeLessThan(1);
    expect([pos.getX(4), pos.getY(4)]).toEqual([0, 1]);
    // (and the one triangle a blade, as before, unless asked)
    expect(nodes.grassGeometry({ side: 4, size: 2 }).getIndex()).toBeNull();
  });

  it('gives every blade one normal, straight up, read once a draw: a hook that reads the geometry’s finds it', () => {
    for (const shape of ['tri', 'blade']) {
      const n = nodes.grassGeometry({ side: 4, size: 2, shape }).getAttribute('normal');
      expect(n.isInstancedBufferAttribute).toBe(true);
      expect(Array.from(n.array)).toEqual([0, 1, 0]);
    }
  });

  it('grows them four to a tuft: each two-by-two block of cells round one root, a few centimetres off it', () => {
    const side = 8;
    const size = 4;
    const g = nodes.grassGeometry({ side, size, shape: 'blade', tufts: true });
    const b = g.getAttribute('aBlade');
    const at = (k) => [b.getX(k * 5), b.getY(k * 5)];
    const { centres } = nodes.bladeLayout({ side, size });
    const cell = size / side;
    for (let iz = 0; iz < side; iz++)
      for (let ix = 0; ix < side; ix++) {
        const root = (iz - (iz % 2)) * side + (ix - (ix % 2));
        const [x, z] = at(iz * side + ix);
        expect(Math.hypot(x - centres[root * 2], z - centres[root * 2 + 1])).toBeLessThanOrEqual(0.8 * cell + 1e-6);
      }
  });

  it('keys a curved blade’s program apart from the triangle’s', () => {
    const ground = createGroundMap({ area: AREA, size: 4, paint });
    const a = nodes.createGrass({ ground, wind: createWind(), side: 6, size: 3 });
    const b = nodes.createGrass({ ground, wind: createWind(), side: 6, size: 3, shape: 'blade', tufts: true });
    expect(b.material.customProgramCacheKey()).toContain('blade');
    expect(a.material.customProgramCacheKey()).not.toContain('blade');
  });
});
