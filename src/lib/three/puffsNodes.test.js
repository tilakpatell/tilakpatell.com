import { describe, expect, it } from 'vitest';
import * as glsl from './puffs';
import * as nodes from './puffsNodes';
import * as gw from './wind';
import * as nw from './windNodes';
import { createHouse } from './houseNodes';

const plain = (v) => (v?.toArray ? v.toArray() : v);
const species = { a: '#2f5a26', b: '#9bc25a', bark: '#4a3424' };

describe('puffsNodes, the twin of puffs', () => {
  it('exports what puffs exports, but the GLSL string', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).filter((k) => k !== 'puffShader').sort());
  });

  it('the same cards and cut-out', () => {
    expect(Array.from(nodes.puffGeometry({ seed: 4 }).attributes.position.array)).toEqual(Array.from(glsl.puffGeometry({ seed: 4 }).attributes.position.array));
    expect(Array.from(nodes.puffGeometry({ seed: 4 }).attributes.normal.array)).toEqual(Array.from(glsl.puffGeometry({ seed: 4 }).attributes.normal.array));
    expect(Array.from(nodes.blob(8).image.data)).toEqual(Array.from(glsl.blob(8).image.data));
  });

  it('a wood of puffs: the same meshes, flags, uniforms and placing', () => {
    const a = glsl.createPuffs({ species, count: 3, wind: gw.createWind() });
    const n = nodes.createPuffs({ species, count: 3, wind: nw.createWind() });
    expect(n.crowns.material.isNodeMaterial).toBe(true);
    expect(n.trunks.material.isNodeMaterial).toBe(true);
    for (const k of ['side', 'transparent', 'depthWrite']) expect(n.crowns.material[k]).toBe(a.crowns.material[k]);
    expect(Object.keys(n.uniforms).sort()).toEqual(Object.keys(a.uniforms).sort());
    for (const k of ['uPuffA', 'uPuffB', 'uPuffSun']) expect(plain(n.uniforms[k].value)).toEqual(plain(a.uniforms[k].value));
    for (const s of [a, n]) s.set(s.take(), 1, 2, 3, 1.2, 0.5);
    expect(Array.from(n.crowns.instanceMatrix.array)).toEqual(Array.from(a.crowns.instanceMatrix.array));
    expect(Array.from(n.trunks.instanceMatrix.array)).toEqual(Array.from(a.trunks.instanceMatrix.array));
    expect(n.crowns.name).toBe(a.crowns.name);
  });

  it('a kit tree’s far puff: the same geometry, a node material, in the house look when given one', () => {
    const opts = { radius: 2, height: 5, trunk: 0.2, seed: 9 };
    const a = glsl.puffFor([[0.1, 0.3, 0.1], [0.4, 0.6, 0.2]], opts);
    const n = nodes.puffFor([[0.1, 0.3, 0.1], [0.4, 0.6, 0.2]], { ...opts, wind: nw.createWind(), house: createHouse() });
    expect(Array.from(n.geometry.attributes.position.array)).toEqual(Array.from(a.geometry.attributes.position.array));
    expect(Array.from(n.geometry.attributes.puffTrunk.array)).toEqual(Array.from(a.geometry.attributes.puffTrunk.array));
    expect(n.material.isNodeMaterial).toBe(true);
    expect(n.material.name).toBe('puff');
    expect(n.material.userData.house).toBeTruthy();
    expect(n.material.customProgramCacheKey()).toContain('puff:trunk');
    expect(nodes.puffFor([[0, 0, 0], [1, 1, 1]], opts).material.customProgramCacheKey()).toContain('puff:trunk:still');
  });
});
