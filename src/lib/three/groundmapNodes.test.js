import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as glsl from './groundmap';
import * as nodes from './groundmapNodes';

const AREA = { x0: -2, z0: 10, w: 4, d: 8 };
const paint = (x, z, out) => {
  out[0] = 0.2 + 0.1 * x;
  out[1] = 0.5;
  out[2] = (z - 10) / 8;
  return x > 0 ? 1 : 0.25;
};

describe('groundmapNodes, the twin of groundmap', () => {
  it('paints the same picture and reads it back the same in JS', () => {
    expect(Array.from(nodes.paintGround({ area: AREA, size: 8, paint }))).toEqual(Array.from(glsl.paintGround({ area: AREA, size: 8, paint })));
    const a = glsl.createGroundMap({ area: AREA, size: 8, paint, height: (x, z) => x + z });
    const n = nodes.createGroundMap({ area: AREA, size: 8, paint, height: (x, z) => x + z });
    expect(Array.from(n.texture.image.data)).toEqual(Array.from(a.texture.image.data));
    for (const [x, z] of [[0, 12], [-1.7, 17.3], [1.9, 10.2]]) {
      expect(n.colourAt(x, z).toArray()).toEqual(a.colourAt(x, z).toArray());
      expect(n.grassAt(x, z)).toBe(a.grassAt(x, z));
      expect(n.heightAt(x, z)).toBe(a.heightAt(x, z));
    }
    expect(n.texture.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('the same uniforms, as nodes, and the shader’s reads as functions', () => {
    const a = glsl.createGroundMap({ area: AREA, size: 4, paint });
    const n = nodes.createGroundMap({ area: AREA, size: 4, paint });
    expect(Object.keys(n.uniforms).sort()).toEqual(Object.keys(a.uniforms).sort());
    expect(n.uniforms.uGroundMap.value).toBe(n.texture);
    expect(n.uniforms.uGroundRect.value.toArray()).toEqual(a.uniforms.uGroundRect.value.toArray());
    for (const f of ['groundUv', 'groundColour', 'groundGrass', 'groundHeight']) expect(typeof n[f]).toBe('function');
  });

  it('paints a floor once, as a node material', () => {
    const n = nodes.createGroundMap({ area: AREA, size: 4, paint });
    const m = n.paint(new THREE.MeshStandardMaterial());
    expect(m.isNodeMaterial).toBe(true);
    expect(m.userData.groundPaint).toBe(n.uniforms);
    expect(n.paint(m)).toBe(m);
  });
});
