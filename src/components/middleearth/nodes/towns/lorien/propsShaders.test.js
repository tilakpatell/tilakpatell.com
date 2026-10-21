import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from '../../../towns/lorien/propsShaders';
import * as nodes from './propsShaders';

// the kit’s K.water: the fog’s uniforms, the clock, the night it shares
const kitWater = () => ({
  ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
  uTime: { value: 3 },
  uNight: { value: 0.25 },
});
const mirrorUniforms = (water) => ({
  ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
  uTime: { value: 1.5 },
  uK: { value: 0.4 },
  uKind: { value: 2 },
  uNight: water.uNight,
  uShire: { value: new THREE.Texture() },
});

describe('nodes/towns/lorien/propsShaders, the twin of Lothlórien’s shaders', () => {
  it('exports what the GLSL module exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it('makes node materials whose uniforms carry the GLSL’s names and values', () => {
    const water = kitWater();
    const pairs = [
      ['basinWaterMaterial', water],
      ['fallSheetMaterial', water],
      ['mirrorWaterMaterial', mirrorUniforms(water)],
    ].map(([k, u]) => [k, glsl[k](u), nodes[k](u)]);
    for (const [k, a, n] of pairs) {
      expect(n.isNodeMaterial, k).toBe(true);
      expect(Object.keys(n.uniforms).sort(), k).toEqual(
        Object.keys(a.uniforms)
          .filter((u) => u.startsWith('u'))
          .sort(),
      );
      for (const u of Object.keys(n.uniforms)) expect(n.uniforms[u].value, `${k}.${u}`).toBe(a.uniforms[u].value);
      expect([n.transparent, n.depthWrite, n.side, n.fog, n.toneMapped], k).toEqual([a.transparent, a.depthWrite, a.side, a.fog, true]);
    }
  });

  it('follows the kit’s clock and night, so its tick and setNight still land', () => {
    const water = kitWater();
    const basin = nodes.basinWaterMaterial(water);
    const fall = nodes.fallSheetMaterial(water);
    const mirror = nodes.mirrorWaterMaterial(mirrorUniforms(water));
    water.uTime.value = 9;
    water.uNight.value = 1;
    for (const m of [basin, fall, mirror]) for (const k of ['uTime', 'uNight']) m.uniforms[k].update({});
    expect([basin.uniforms.uTime.value, basin.uniforms.uNight.value]).toEqual([9, 1]);
    // (one node a holder: the basin and the falling sheet share it)
    expect(fall.uniforms.uTime).toBe(basin.uniforms.uTime);
    expect(mirror.uniforms.uNight).toBe(basin.uniforms.uNight);
    expect(mirror.uniforms.uTime).not.toBe(basin.uniforms.uTime);
  });

  it('glows by colour on the node material it returns, as ./props.js uses it', () => {
    const M = (o) =>
      new THREE.MeshStandardMaterial({
        roughness: 0.8,
        emissiveIntensity: 0.4,
        ...o,
      });
    const lit = nodes.glowByColour(M({ vertexColors: true }));
    const plain = nodes.glowByColour(M({ vertexColors: false }));
    expect(lit.isMeshStandardNodeMaterial).toBe(true);
    expect([lit.roughness, lit.emissiveIntensity]).toEqual([0.8, 0.4]);
    expect(lit.emissiveNode).toBeTruthy();
    // (#ifdef USE_COLOR: no vertex colours, nothing changed)
    expect(plain.emissiveNode).toBeFalsy();
    expect(lit.customProgramCacheKey()).toContain('lorien-glow');
    const classic = M({ vertexColors: true });
    expect(glsl.glowByColour(classic)).toBe(classic);
  });
});
