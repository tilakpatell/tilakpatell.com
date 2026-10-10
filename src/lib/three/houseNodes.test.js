import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as glsl from './house';
import * as nodes from './houseNodes';
import { createGroundMap } from './groundmapNodes';

const plain = (v) => (v?.toArray ? v.toArray() : v);

describe('houseNodes, the twin of house', () => {
  it('exports what house exports, but the GLSL string', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).filter((k) => k !== 'houseShader').sort());
    expect(nodes.LOOK).toEqual(glsl.LOOK);
    for (const mood of [{ hemiSky: 0xcfe2ff, hemi: 1 }, { hemiSky: 0x223344, hemi: 0.3 }, { shadow: 0x123456 }]) expect(nodes.shadowFor(mood)).toBe(glsl.shadowFor(mood));
  });

  it('the same uniforms by name and value, set, lit and skied the same', () => {
    const look = { shadow: 0x5544aa, edge: [0.2, 0.7], fogLow: 0xffeedd };
    const a = glsl.createHouse(look);
    const n = nodes.createHouse(look);
    expect(Object.keys(n.uniforms).sort()).toEqual(Object.keys(a.uniforms).sort());
    const sun = new THREE.DirectionalLight(0xffeedd, 2);
    const hemi = new THREE.HemisphereLight(0xaaccff, 0x443322, 0.7);
    for (const h of [a, n]) {
      h.light({ sun, hemi });
      h.sky({ low: 0xffaa66, high: 0x2255aa, below: 0.8, sunDir: new THREE.Vector3(1, 1, 0) });
      h.set({ mix: 0.6 });
    }
    for (const k of Object.keys(a.uniforms)) expect(plain(n.uniforms[k].value)).toEqual(plain(a.uniforms[k].value));
    expect(n.toneMapping).toBe(a.toneMapping);
    expect(n.exposure).toBe(a.exposure);
  });

  it('adopts a scene: classic lit materials swapped for their node twins, shared ones once, each patched once', () => {
    const n = nodes.createHouse({ fog: false });
    const scene = new THREE.Scene();
    const shared = new THREE.MeshStandardMaterial();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), shared), new THREE.Mesh(new THREE.BoxGeometry(), shared), new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
    expect(n.adopt(scene)).toBe(1);
    const [m1, m2, basic] = scene.children.map((o) => o.material);
    expect(m1.isNodeMaterial).toBe(true);
    expect(m2).toBe(m1);
    expect(basic.isNodeMaterial).toBeFalsy(); // (unlit: left as it was)
    expect(m1.userData.house).toBe(n.uniforms);
    expect(n.adopt(scene)).toBe(0);
    expect(m1.customProgramCacheKey()).toContain('house:nofog');
  });

  it('a material in the look, and the ground once given (its key follows)', () => {
    const n = nodes.createHouse();
    const m = n.material({ color: 0x336699 });
    expect(m.isMeshLambertNodeMaterial).toBe(true);
    expect(m.userData.house).toBe(n.uniforms);
    expect(m.customProgramCacheKey()).not.toContain('house:ground');
    const map = createGroundMap({ area: { x0: 0, z0: 0, w: 1, d: 1 }, size: 2, paint: () => 1 });
    n.ground(map, { height: 2, strength: 0.3, offset: 0.5 });
    expect(m.customProgramCacheKey()).toContain('house:ground');
    expect(n.uniforms.uGroundMap).toBe(map.uniforms.uGroundMap);
    expect(n.uniforms.uLookBounce.value.toArray()).toEqual([2, 0.3, 0.5]);
  });
});
