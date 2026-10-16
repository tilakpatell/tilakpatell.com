import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { uniform, vec3 } from 'three/tsl';
import * as glsl from './atmosphere';
import * as nodes from './atmosphereNodes';

const plain = (v) => (Array.isArray(v) ? v.map(plain) : v?.toArray ? v.toArray() : v);
const GLSL_ONLY = ['ATMO', 'SHELL_VERT', 'SHELL_FRAG'];

describe('atmosphereNodes, the twin of atmosphere', () => {
  it('exports what atmosphere exports, the GLSL strings now inscatter; the plain numbers the same', () => {
    expect(Object.keys(nodes).sort()).toEqual([...Object.keys(glsl).filter((k) => !GLSL_ONLY.includes(k)), 'inscatter'].sort());
    const air = { colour: '#a6ccff', density: 2.2, top: 1.065 };
    expect(plain(Object.values(nodes.atmosphereParams(air)))).toEqual(plain(Object.values(glsl.atmosphereParams(air))));
    for (const l of ['low', 'mid', 'high', 'ultra', 'x']) expect(nodes.stepsFor(l, 7)).toBe(glsl.stepsFor(l, 7));
    expect(nodes.skyColoursFor(air, 0.2)).toEqual(glsl.skyColoursFor(air, 0.2));
  });

  it('a shell: a node material with the GLSL’s uniforms by name and value, and its flags', () => {
    const opts = { radius: 10, colour: '#9fc4ff', suns: [{ dir: [0, 1, 0], colour: '#ffffff' }], inner: 0.98 };
    const a = glsl.createAtmosphere(opts);
    const n = nodes.createAtmosphere(opts);
    expect(Object.keys(n).sort()).toEqual(Object.keys(a).sort());
    const m = n.mesh.material;
    expect(m.isNodeMaterial).toBe(true);
    expect(Object.keys(m.uniforms).sort()).toEqual(Object.keys(a.mesh.material.uniforms).sort());
    for (const k of Object.keys(a.mesh.material.uniforms)) expect(plain(m.uniforms[k].value)).toEqual(plain(a.mesh.material.uniforms[k].value));
    for (const f of ['side', 'blending', 'transparent', 'depthWrite', 'depthTest']) expect(m[f]).toBe(a.mesh.material[f]);
    expect(n.mesh.geometry.parameters).toEqual(a.mesh.geometry.parameters);
    expect(plain(Object.values(n.params))).toEqual(plain(Object.values(a.params)));
  });

  it('sets its suns and strength, and follows its planet', () => {
    const n = nodes.createAtmosphere({ radius: 10, colour: '#9fc4ff', suns: [{ dir: [0, 1, 0], colour: '#ffffff' }] });
    const u = n.mesh.material.uniforms;
    expect(u.uSunCol.value[1].getHex()).toBe(0);
    n.set({ suns: [{ dir: [1, 0, 0], colour: [1, 0.5, 0.25] }, { dir: [0, 0, 1], colour: '#ff0000' }], strength: 1.5 });
    expect(u.uSunDir.value[1].toArray()).toEqual([0, 0, 1]);
    expect(u.uSunCol.value[0].toArray()).toEqual([1, 0.5, 0.25]);
    expect(u.uStrength.value).toBe(1.5);
    n.update(new THREE.Vector3(1, 2, 3));
    expect(u.uCenter.value.toArray()).toEqual([1, 2, 3]);
    n.dispose();
  });

  it('shares a body’s uniforms: its { value } holders and its nodes', () => {
    const dir = { value: [new THREE.Vector3(0, 1, 0), new THREE.Vector3()] };
    const r = uniform(4);
    const n = nodes.createAtmosphere({ radius: 1, colour: '#ffffff', uniforms: { uSunDir: dir, uR: r } });
    expect(n.mesh.material.uniforms.uSunDir).toBe(dir);
    expect(n.mesh.material.uniforms.uR).toBe(r);
  });

  it('marches the steps it is told, flat or not, and inscatter composes into another graph', () => {
    expect(nodes.createAtmosphere({ radius: 1, colour: '#ffffff', steps: 5 }).mesh.material.userData.atmosphere).toEqual({ steps: 5, flat: false });
    expect(nodes.createAtmosphere({ radius: 1, colour: '#b8ff5a', flat: true }).mesh.material.userData.atmosphere).toEqual({ steps: 7, flat: true });
    const p = nodes.atmosphereParams({ colour: '#ffffff' });
    const u = { uAtmo: uniform(p.uAtmo), uAtmoP: uniform(p.uAtmoP), uSunset: uniform(p.uSunset), uSunDir: [uniform(new THREE.Vector3(0, 1, 0)), uniform(new THREE.Vector3())], uSunCol: [uniform(new THREE.Color(1, 1, 1)), uniform(new THREE.Color(0, 0, 0))] };
    const out = nodes.inscatter(u, { steps: 4 })(vec3(0, 0, 3), vec3(0, 0, -1), 10);
    expect(out.isNode).toBe(true);
  });
});
