import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from './flatLitter';
import * as nodes from './flatLitterNodes';
import { createWind } from './wind';

const SPEC = {
  colours: ['#a39c34', '#d8a83c', '#b4622c'],
  density: 0.55,
  size: 0.28,
  shed: 0.7,
};
const floorAt = (x, z) => 0.4 * Math.sin(x * 0.3) + 0.25 * Math.cos(z * 0.2) + 1;
const opts = (more = {}) => ({
  max: 512,
  half: 14,
  spec: SPEC,
  floorAt,
  seed: 3,
  crowns: [{ x: 4, z: 4, r: 2, lo: 3, hi: 8 }],
  ...more,
});
const plain = (v) => (v?.toArray ? v.toArray() : v);

describe('flatLitterNodes, the twin of flatLitter', () => {
  it('exports what flatLitter exports, but the GLSL string', () => {
    expect(Object.keys(nodes).sort()).toEqual(
      Object.keys(glsl)
        .filter((k) => k !== 'flatLitterShader')
        .sort(),
    );
    for (const d of [0.001, 0.35, 0.55]) for (const max of [128, 256, 512]) expect(nodes.flatLeafCount(d, { max, half: 14 })).toBe(glsl.flatLeafCount(d, { max, half: 14 }));
  });

  it('makes a Lambert node material, both faces, its uniforms the GLSL’s names and values', () => {
    const a = glsl.createFlatLitter(opts({ lift: 0.03, focus: { x: 2, z: -1 } }));
    const n = nodes.createFlatLitter(opts({ lift: 0.03, focus: { x: 2, z: -1 } }));
    expect(n.material.isNodeMaterial).toBe(true);
    expect(n.material.isMeshLambertNodeMaterial).toBe(true);
    expect(n.material.side).toBe(THREE.DoubleSide);
    expect(n.material.name).toBe('leaves');
    expect(n.material.userData.faceless).toBe(true);
    expect(n.material.maskNode).toBeTruthy(); // (cut to a leaf)
    const names = ['uLeafFocus', 'uLeafLook', 'uLeafClock', 'uLeafA', 'uLeafB', 'uLeafC'];
    expect(Object.keys(n.material.uniforms).sort()).toEqual(names.sort());
    // (the GLSL’s uniforms reach its program by onBeforeCompile: read them there)
    const sh = {
      uniforms: {},
      vertexShader: THREE.ShaderLib.lambert.vertexShader,
      fragmentShader: THREE.ShaderLib.lambert.fragmentShader,
    };
    a.material.onBeforeCompile(sh);
    for (const k of names) {
      expect(n.material.uniforms[k].isNode, k).toBe(true);
      expect(plain(n.material.uniforms[k].value), k).toEqual(plain(sh.uniforms[k].value));
    }
  });

  it('lays, steps, kicks and sheds the same leaves as the original', () => {
    const wind = createWind({ strength: 1, angle: 0.3 });
    const a = glsl.createFlatLitter(opts({ wind, spec: { ...SPEC, shed: 20 } }));
    const n = nodes.createFlatLitter(opts({ wind, spec: { ...SPEC, shed: 20 } }));
    const me = { key: 'me', x: 0.05, z: -3, y: 0 };
    for (let k = 0; k < 90; k++) {
      wind.update(1 / 60);
      me.z = -3 + (3 * k) / 60;
      a.update(1 / 60, { focus: { x: 0, z: 0 }, walkers: [me] });
      n.update(1 / 60, { focus: { x: 0, z: 0 }, walkers: [{ ...me }] });
    }
    a.blast(1, 1, 3);
    n.blast(1, 1, 3);
    expect([...n.sim.p]).toEqual([...a.sim.p]);
    expect([...n.ground]).toEqual([...a.ground]);
    expect(n.info()).toEqual(a.info());
    expect(n.mesh.geometry.instanceCount).toBe(a.mesh.geometry.instanceCount);
    const sh = { uniforms: {}, vertexShader: '', fragmentShader: '' };
    a.material.onBeforeCompile(sh);
    for (const k of ['uLeafClock', 'uLeafFocus']) expect(plain(n.material.uniforms[k].value)).toEqual(plain(sh.uniforms[k].value));
    for (const l of [a, n]) l.dispose();
    wind.dispose();
  });
});
