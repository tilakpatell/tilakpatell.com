import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as glsl from './foliage';
import * as nodes from './foliageNodes';

const plain = (v) => (v?.toArray ? v.toArray() : v);

describe('foliageNodes, the twin of foliage', () => {
  it('exports what foliage exports, but the GLSL strings', () => {
    const strings = ['wrapShader', 'windShader', 'facelessShader'];
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).filter((k) => !strings.includes(k)).sort());
    expect(nodes.WIND).toEqual(glsl.WIND);
  });

  it('turns normals as foliage does', () => {
    const a = glsl.spherifyNormals(new THREE.IcosahedronGeometry(1, 1).scale(2, 1, 1), { keep: 0.3 });
    const b = nodes.spherifyNormals(new THREE.IcosahedronGeometry(1, 1).scale(2, 1, 1), { keep: 0.3 });
    expect(Array.from(b.attributes.normal.array)).toEqual(Array.from(a.attributes.normal.array));
    const c = glsl.liftNormals(new THREE.ConeGeometry(1, 2, 5), { keep: 0.4 });
    const d = nodes.liftNormals(new THREE.ConeGeometry(1, 2, 5), { keep: 0.4 });
    expect(Array.from(d.attributes.normal.array)).toEqual(Array.from(c.attributes.normal.array));
  });

  it('wraps the light: a node material, the same uniforms, once', () => {
    const a = glsl.wrapLighting(new THREE.MeshStandardMaterial(), { wrap: 0.4, backScatter: 0.2 });
    const n = nodes.wrapLighting(new THREE.MeshStandardMaterial(), { wrap: 0.4, backScatter: 0.2 });
    expect(n.isNodeMaterial).toBe(true);
    expect(Object.keys(n.userData.wrap).sort()).toEqual(Object.keys(a.userData.wrap).sort());
    expect(n.userData.wrap.uWrap.value).toBe(0.4);
    expect(n.userData.wrap.uBackScatter.value).toBe(0.2);
    expect(nodes.wrapLighting(n)).toBe(n);
    expect(n.customProgramCacheKey()).toContain('|wrap');
  });

  it('both faces as one, once', () => {
    const n = nodes.faceless(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }));
    expect(n.isNodeMaterial).toBe(true);
    expect(n.side).toBe(THREE.DoubleSide);
    expect(n.userData.faceless).toBe(true);
    expect(nodes.faceless(n)).toBe(n);
  });

  it('the wind: the same uniforms and values, the shared clock followed, the weight checked', () => {
    const time = { value: 3 };
    const a = glsl.wind(new THREE.MeshStandardMaterial(), { kind: 'shrub', time, leaf: 0.05 });
    const n = nodes.wind(new THREE.MeshStandardMaterial(), { kind: 'shrub', time, leaf: 0.05, weight: '_wind' });
    expect(Object.keys(n.userData.wind).sort()).toEqual(Object.keys(a.userData.wind).sort());
    for (const k of Object.keys(a.userData.wind)) expect(plain(n.userData.wind[k].value)).toEqual(plain(a.userData.wind[k].value));
    time.value = 7;
    n.userData.wind.uWindTime.update({});
    expect(n.userData.wind.uWindTime.value).toBe(7);
    expect(n.customProgramCacheKey()).toContain('wind|w:_wind');
    expect(() => nodes.wind(new THREE.MeshStandardMaterial(), { weight: 'a b' })).toThrow(TypeError);
  });
});
