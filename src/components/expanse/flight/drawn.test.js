import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshLambertNodeMaterial } from 'three/webgpu';
import { createHouse } from '../../../lib/three/houseNodes';
import { classicFog, drawnAsClassic, shownAs } from './drawn';

// The flight drawn as the classic renderer drew it (the fog after the
// output, the dome untoned): what each piece puts on a material. The
// pictures themselves are scripts/twin-parity's 'flight:drawn'.
describe('the flight’s fog as the classic renderer mixed it', () => {
  it('goes on a fogged node material once, and keys its program', () => {
    const m = new MeshLambertNodeMaterial({ color: '#888888' });
    const own = m.setupFog;
    expect(classicFog(m)).toBe(m);
    expect(m.setupFog).not.toBe(own);
    const wrapped = m.setupFog;
    classicFog(m);
    expect(m.setupFog).toBe(wrapped);
    expect(m.customProgramCacheKey()).toContain('flight:classic-fog');
  });

  it('leaves alone what has no fog or isn’t a node material', () => {
    const unfogged = new MeshBasicNodeMaterial({ fog: false });
    const own = unfogged.setupFog;
    classicFog(unfogged);
    expect(unfogged.setupFog).toBe(own);
    const classic = new THREE.MeshLambertMaterial();
    expect(classicFog(classic)).toBe(classic);
    expect(classic.setupFog).toBeUndefined();
  });

  it('reaches what the house adopts (a classic one swapped for its node twin) and what it makes', () => {
    const house = drawnAsClassic(createHouse({ fog: true }));
    const lit = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshLambertMaterial({ color: '#808080' }));
    const glow = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ color: '#ff8800' }));
    const root = new THREE.Group().add(lit, glow);
    expect(house.adopt(root)).toBe(1); // (the house's own count: the lit one)
    for (const o of [lit, glow]) {
      expect(o.material.isNodeMaterial).toBe(true);
      expect(o.material.customProgramCacheKey()).toContain('flight:classic-fog');
    }
    expect(lit.material.userData.house).toBe(house.uniforms);
    const made = house.material({ color: '#445566' });
    expect(made.userData.house).toBe(house.uniforms);
    expect(made.customProgramCacheKey()).toContain('flight:classic-fog');
  });
});

describe('a colour shown as the classic renderer showed it', () => {
  it('is a node', () => {
    expect(shownAs(new THREE.Color(0.5, 0.6, 0.7)).isNode).toBe(true);
  });
});
