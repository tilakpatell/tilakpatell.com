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
});
