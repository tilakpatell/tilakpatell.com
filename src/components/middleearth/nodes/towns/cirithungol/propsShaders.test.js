import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from '../../../towns/cirithungol/propsShaders';
import * as nodes from './propsShaders';

// the kit’s U and Minas Morgul’s, as morgul() makes them
const morgulU = () => ({
  uTime: { value: 3 },
  uGlow: { value: 1 },
  uBeam: { value: 0.4 },
  uNoise: { value: new THREE.Texture() },
  uGhost: { value: new THREE.Color(0.3, 1.0, 0.46) },
});
const plain = (v) => (v?.toArray ? v.toArray() : v);

describe('nodes/towns/cirithungol/propsShaders, the twin of Cirith Ungol’s shaders', () => {
  it('exports what the GLSL module exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it('makes node materials whose uniforms carry the GLSL’s names and values', () => {
    const U = morgulU();
    const pairs = [
      ['beamMaterial', [U, { k: 0.8, core: 1.7, edge: 2.6 }]],
      ['beamMaterial', [U]],
      ['splashMaterial', [U]],
    ].map(([k, a]) => [k, glsl[k](...a), nodes[k](...a)]);
    for (const [k, a, n] of pairs) {
      expect(n.isNodeMaterial, k).toBe(true);
      expect(Object.keys(n.uniforms).sort(), k).toEqual(Object.keys(a.uniforms).sort());
      for (const u of Object.keys(n.uniforms)) expect(plain(n.uniforms[u].value), `${k}.${u}`).toEqual(plain(a.uniforms[u].value));
      expect([n.transparent, n.depthWrite, n.blending, n.side, n.fog], k).toEqual([a.transparent, a.depthWrite, a.blending, a.side, a.fog]);
      expect(n.toneMapped, k).toBe(false);
    }
  });

  it('follows Minas Morgul’s clock and beam, so its update still lands', () => {
    const U = morgulU();
    const a = nodes.beamMaterial(U);
    const b = nodes.splashMaterial(U);
    U.uTime.value = 8;
    U.uBeam.value = 0.9;
    for (const k of ['uTime', 'uBeam']) a.uniforms[k].update({});
    expect([a.uniforms.uTime.value, a.uniforms.uBeam.value]).toEqual([8, 0.9]);
    // (one node a holder, shared by the beam’s layers and the splash)
    expect(b.uniforms.uBeam).toBe(a.uniforms.uBeam);
  });

  it('makes the city’s stone as the GLSL did, its glow on the emissive', () => {
    const U = morgulU();
    const a = glsl.ghostMaterial(U);
    const n = nodes.ghostMaterial(U);
    expect(n.isMeshStandardNodeMaterial).toBe(true);
    expect([n.vertexColors, n.roughness, n.metalness]).toEqual([a.vertexColors, a.roughness, a.metalness]);
    expect(n.color.getHex()).toBe(a.color.getHex());
    expect(n.emissiveNode).toBeTruthy();
    expect(n.customProgramCacheKey()).toContain('cirith-ghost');
  });

  it('hides return the node material for the classic one, as ./props.js uses them', () => {
    const M = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.36 });
    const tex = new THREE.Texture();
    const orc = nodes.hide(M(), { tex, nrm: tex, key: 'cirith-orc' });
    const shelob = nodes.hide(M(), {
      tex,
      nrm: tex,
      key: 'cirith-shelob',
      ...nodes.shelobRim(),
    });
    for (const m of [orc, shelob]) {
      expect(m.isMeshStandardNodeMaterial).toBe(true);
      expect(m.roughness).toBe(0.36);
    }
    expect(orc.emissiveNode).toBeFalsy();
    expect(shelob.emissiveNode).toBeTruthy();
    expect(orc.customProgramCacheKey()).not.toBe(shelob.customProgramCacheKey());
    expect(Object.keys(nodes.shelobRim())).toEqual(Object.keys(glsl.shelobRim()));
  });
});
