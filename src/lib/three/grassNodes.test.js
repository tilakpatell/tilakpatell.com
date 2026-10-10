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
});
