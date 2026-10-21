import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as glsl from './kit';
import * as nodes from './kitNodes';
import { createHouse } from './houseNodes';

describe('kitNodes, the twin of kit', () => {
  it('exports what kit exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it('a kit material is a node material, with the same flags and hooks as the GLSL one', () => {
    const time = { value: 0 };
    for (const def of [{}, { leaf: true }, { leaf: true, wind: 'tree' }]) {
      const a = glsl.kitMaterial(def, { wind: { time } });
      const n = nodes.kitMaterial(def, { wind: { time } });
      expect(n.isNodeMaterial).toBe(true);
      for (const k of ['alphaTest', 'side']) expect(n[k]).toBe(a[k]);
      expect(Boolean(n.userData.faceless)).toBe(Boolean(a.userData.faceless));
      expect(Boolean(n.userData.wind)).toBe(Boolean(a.userData.wind));
    }
    const tinted = nodes.kitMaterial({}, { tint: '#123456' });
    expect(tinted.color.getHex()).toBe(0x123456);
    expect(nodes.kitMaterial({}, { tint: { recolour: '#00ff00' } }).userData.recolour).toBeTruthy();
    expect(nodes.kitMaterial({}, { house: createHouse() }).userData.house).toBeTruthy();
    expect(THREE.DoubleSide).toBe(nodes.kitMaterial({ leaf: true }).side);
  });

  // (WebGPU takes no vertex format of one byte a vertex: a bending part's
  // wind weight, quantised in the file or filled in, went in as one, and
  // every leaf's and grass blade's pipeline failed on it)
  it('bakes a bending part’s wind weight as floats, the file’s or ones', async () => {
    const mesh = (name, weight) => {
      const g = new THREE.BoxGeometry(1, 1, 1);
      if (weight) g.setAttribute('_wind', new THREE.BufferAttribute(new Uint8Array(g.attributes.position.count).fill(128), 1, true));
      const o = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ name: 'Leaves' }));
      o.name = name;
      return o;
    };
    const scene = new THREE.Group();
    scene.add(mesh('Weighted', true), mesh('Plain', false));
    const manifest = { models: { Weighted: { file: 'a.glb', radius: 1, height: 1, kind: 'tree' }, Plain: { file: 'a.glb', radius: 1, height: 1, kind: 'tree' } }, materials: { Leaves: { wind: 'tree' } } };
    const kit = nodes.loadKit('test', { manifest, load: () => ({ scene }), puffs: false });
    const [weighted, plain] = await Promise.all([kit.model('Weighted'), kit.model('Plain')]);
    const w = weighted.parts[0].geometry.attributes._wind;
    expect(w.array).toBeInstanceOf(Float32Array);
    expect(w.array[0]).toBeCloseTo(128 / 255, 6);
    const p = plain.parts[0].geometry.attributes._wind;
    expect(p.array).toBeInstanceOf(Float32Array);
    expect([...new Set(p.array)]).toEqual([1]);
    kit.dispose();
  });
});
