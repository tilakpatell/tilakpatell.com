import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as glsl from '../../shire/sky';
import * as nodes from './sky';
import { makeWater as glslWater } from '../../shire/ground';
import { makeWater as nodeWater } from './ground';

const value = (v) => (v?.toArray ? v.toArray() : v);

describe('nodes/shire/sky, the twin of the Shire’s sky', () => {
  it('exports what the sky exports, its moods the same', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
    expect(nodes.MOODS).toEqual(glsl.MOODS);
    expect(nodes.shadowFor(glsl.MOODS.night)).toBe(glsl.shadowFor(glsl.MOODS.night));
  });

  it('makes a node dome whose uniforms carry the GLSL’s names and values', () => {
    const a = glsl.makeSky(10);
    const n = nodes.makeSky(10);
    const m = n.dome.material;
    expect(m.isNodeMaterial).toBe(true);
    expect(n.uniforms).toBe(m.uniforms);
    expect(Object.keys(n.uniforms).sort()).toEqual(Object.keys(a.uniforms).sort());
    for (const k of Object.keys(n.uniforms)) expect(value(n.uniforms[k].value)).toEqual(value(a.uniforms[k].value));
    const o = a.dome.material;
    expect([m.side, m.depthWrite, m.fog, m.toneMapped]).toEqual([o.side, o.depthWrite, o.fog, o.toneMapped]);
    expect(m.vertexNode?.isNode).toBe(true); // (on the far plane)
    expect([n.dome.renderOrder, n.dome.frustumCulled]).toEqual([-10, false]);
  });

  it("blends the moods into a twin's sky and water as the original does", () => {
    const run = (K, water) => {
      const sky = K.makeSky(10);
      const sun = new THREE.DirectionalLight();
      const hemi = new THREE.HemisphereLight();
      const fog = new THREE.Fog(0, 1, 2);
      const stage = { renderer: { toneMappingExposure: 1 } };
      const dir = K.makeAtmosphere({ sky, sun, hemi, fog, water, stage })(0.4, 0.2);
      return {
        dir: dir.toArray(),
        sky: Object.fromEntries(Object.entries(sky.uniforms).map(([k, u]) => [k, value(u.value)])),
        water: Object.fromEntries(
          Object.entries(water.uniforms)
            .filter(([k]) => k.startsWith('u'))
            .map(([k, u]) => [k, value(u.value)]),
        ),
        light: [sun.intensity, hemi.intensity, fog.near, fog.far],
        exposure: stage.renderer.toneMappingExposure,
      };
    };
    // (each side's own water: the twin's uniforms are nodes, the GLSL's holders)
    expect(run(nodes, nodeWater().material)).toEqual(run(glsl, glslWater().material));
  });
});
