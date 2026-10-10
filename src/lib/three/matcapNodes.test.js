import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as glsl from './matcap';
import * as nodes from './matcapNodes';
import { wind } from './foliageNodes';

describe('matcapNodes, the twin of matcap', () => {
  it('the same key for a light', () => {
    const sun = new THREE.DirectionalLight(0xffeedd, 2);
    sun.position.set(1, 2, 0);
    const lights = { sun, hemi: new THREE.HemisphereLight(0xaaccff, 0x332211, 0.5) };
    expect(nodes.matcapKey({ roughness: 0.4 }, lights)).toBe(glsl.matcapKey({ roughness: 0.4 }, lights));
  });

  it('a lit material as a matcap node material, its look and its hooks kept; one that glows as it was', () => {
    const fake = { setRenderTarget() {}, getRenderTarget: () => null, render() {} };
    const m = wind(new THREE.MeshStandardMaterial({ color: 0x336699, side: THREE.DoubleSide, name: 'leaf' }), { kind: 'shrub' });
    const out = nodes.matcapFor(m, fake, {});
    expect(out.isMeshMatcapNodeMaterial).toBe(true);
    expect(out.color.getHex()).toBe(0x336699);
    expect(out.side).toBe(THREE.DoubleSide);
    expect(out.setupPosition).toBe(m.setupPosition);
    expect(out.customProgramCacheKey).toBe(m.customProgramCacheKey);
    const glow = new THREE.MeshStandardMaterial({ emissive: 0xff0000 });
    expect(nodes.matcapFor(glow, fake, {})).toBe(glow);
    nodes.disposeMatcaps(fake);
  });
});
