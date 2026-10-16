import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from '../levelArea';
import * as nodes from './levelArea';
import { LIGHTS } from '../../../data/bf2017/light/index.js';

// The area as nodes against the GLSL one: the same exports, the same look
// from the same light record, the dome and the sea node materials with the
// GLSL's flags and uniforms (by name and value), and the same fog in and out
const flags = (m) => ({ transparent: m.transparent, blending: m.blending, side: m.side, depthWrite: m.depthWrite, depthTest: m.depthTest, fog: m.fog });
const plain = (v) => (v?.toArray ? v.toArray() : v);
const storm = { at: [100, 20, -50], radius: 140, sea: -0.5, fog: { color: '#56636d', density: 0.02, sea: '#2a3a44', deep: '#0b141a' }, sky: { url: null, gain: 1.35 } };
const space = { at: [400, 0, 300], radius: 120, sea: null, fog: null, sky: { url: null, gain: 2.5, full: true } };

describe('levelArea’s twin', () => {
  it('exports what levelArea exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it('takes the same look from the world’s light record', () => {
    const fill = { sun: [1, 0.971, 0.914], sky: [0.318, 0.341, 0.4], ground: [0.05, 0.05, 0.05] };
    const a = glsl.lookOf(LIGHTS.sb_kamino, { fill, probe: LIGHTS.kamino });
    const n = nodes.lookOf(LIGHTS.sb_kamino, { fill, probe: LIGHTS.kamino });
    expect(JSON.parse(JSON.stringify(n))).toEqual(JSON.parse(JSON.stringify(a)));
    expect(n.sun.dir).toEqual(a.sun.dir);
    expect(nodes.lookOf(LIGHTS.sb_kamino)).toEqual(glsl.lookOf(LIGHTS.sb_kamino));
  });

  for (const [name, opts] of [['Kamino’s storm', storm], ['a space level’s star field', space]])
    it(`${name}: the dome and the sea, node materials with the GLSL’s flags and uniforms`, () => {
      const a = glsl.createLevelArea(new THREE.Scene(), opts);
      const n = nodes.createLevelArea(new THREE.Scene(), opts);
      expect(Object.keys(n).sort()).toEqual(Object.keys(a).sort());
      for (const part of ['level-area-sky', 'level-area-sea']) {
        const x = a.group.getObjectByName(part);
        const y = n.group.getObjectByName(part);
        expect(Boolean(y)).toBe(Boolean(x));
        if (!x) continue;
        expect(y.material.isNodeMaterial).toBe(true);
        expect(flags(y.material)).toEqual(flags(x.material));
        expect(y.position.toArray()).toEqual(x.position.toArray());
        expect(y.geometry.parameters).toEqual(x.geometry.parameters);
        expect(y.frustumCulled).toBe(x.frustumCulled);
        expect(Object.keys(y.material.uniforms).sort()).toEqual(Object.keys(x.material.uniforms).sort());
        for (const k of Object.keys(x.material.uniforms)) if (k !== 'uSky') expect(plain(y.material.uniforms[k].value)).toEqual(plain(x.material.uniforms[k].value));
      }
    });

  it('lays the storm’s fog on while you’re inside, lights with the strike, and gives the scene its own back', () => {
    const scene = new THREE.Scene();
    const own = new THREE.Fog('#000000', 1, 2);
    scene.fog = own;
    const a = nodes.createLevelArea(scene, storm);
    expect(scene.getObjectByName('level-area')).toBe(a.group);
    expect(a.group.getObjectByName('level-area-sea').position.y).toBeCloseTo(-20.5, 5);
    a.update({ position: { x: 100, y: 30, z: -50 } }, 2.5);
    expect(scene.fog).toBeInstanceOf(THREE.FogExp2);
    expect(scene.fog.density).toBe(0.02);
    expect(a.group.getObjectByName('level-area-sea').material.uniforms.uTime.value).toBe(2.5);
    a.update({ position: { x: 1000, y: 0, z: 0 } });
    expect(scene.fog).toBe(own);
    a.update({ position: { x: 90, y: 20, z: -40 } });
    a.dispose();
    expect(scene.fog).toBe(own);
    expect(scene.getObjectByName('level-area')).toBeUndefined();
  });

  it('a space level’s area shuts the galaxy out and leaves the scene’s fog alone', () => {
    const scene = new THREE.Scene();
    const own = new THREE.Fog('#000000', 1, 2);
    scene.fog = own;
    const a = nodes.createLevelArea(scene, space);
    expect(a.inside({ x: 400, y: 10, z: 300 })).toBe(true);
    a.update({ position: { x: 400, y: 10, z: 300 } });
    expect(scene.fog).toBe(own);
    expect(a.inside({ x: 0, y: 0, z: 0 })).toBe(false);
    a.dispose();
    expect(scene.getObjectByName('level-area')).toBeUndefined();
  });
});
