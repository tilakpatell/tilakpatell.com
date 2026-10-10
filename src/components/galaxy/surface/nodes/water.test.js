import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createWater } from '../water';
import { seaFor, wavesFor } from '../ocean';
import { planeMaterial, seaMaterial, waterNodes } from './water';

const sun = new THREE.Vector3(0.3, 0.6, 0.2).normalize();
const valuesOf = (m) => Object.fromEntries(Object.entries(m.uniforms).filter(([k]) => k.startsWith('u')).map(([k, v]) => [k, v.value]));
const site = (kind) => ({ sky: { horizon: '#aabbcc', zenith: '#335577' }, water: { level: 0, color: '#3c7f88', deep: '#1f4a58', kind } });

describe('the water as nodes', () => {
  it('makes the values uniform nodes under the same names', () => {
    const t = new THREE.Texture();
    const u = waterNodes({ uA: 1, uB: new THREE.Color(1, 0, 0), uT: t });
    expect(u.uA.value).toBe(1);
    expect(u.uB.value.getHex()).toBe(0xff0000);
    expect(u.uT.value).toBe(t);
  });

  for (const kind of ['lava', 'clouds']) {
    it(`a plane of ${kind}: fogged, opaque, the plane's uniforms`, () => {
      const w = createWater(site(kind), sun, '#ffffff', { small: true });
      const { material, uniforms } = planeMaterial(valuesOf(w.mesh.material), { fine: true });
      expect(material.isNodeMaterial).toBe(true);
      expect(material).toMatchObject({ fog: w.mesh.material.fog, transparent: false });
      for (const k of Object.keys(valuesOf(w.mesh.material))) expect(uniforms[k]).toBeDefined();
    });
  }

  it('the sea: its waves on the vertex, the sea’s uniforms', () => {
    const w = createWater(site('sea'), sun, '#ffffff', { small: true, heightAt: () => -10 });
    const { material, uniforms } = seaMaterial(valuesOf(w.mesh.material), wavesFor(seaFor(null, site('sea').water)));
    expect(material.positionNode?.isNode).toBe(true);
    expect(material.fog).toBe(true);
    expect(uniforms.uDepth.value).toBe(w.mesh.material.uniforms.uDepth.value);
    uniforms.uCentre.value.set(4, 5);
    expect(uniforms.uCentre.value.x).toBe(4);
  });
});
