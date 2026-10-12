import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { imageLayerFrom } from '../../../lib/land/layers.js';
import { FAR_DROP, FAR_STEP, buildGround, cutUnder } from './ground.js';

describe('the far grid’s cut', () => {
  it('leaves out the quads wholly inside the rectangle, and keeps the ones its edge crosses', () => {
    // 4 × 4 quads of 4 m over −8…8
    const g = new THREE.PlaneGeometry(16, 16, 4, 4);
    g.rotateX(-Math.PI / 2);
    expect(cutUnder(g, [-4, -4], [4, 4])).toBe(4);
    expect(g.index.count).toBe((16 - 4) * 6);
    // (a rectangle between the lines holds no whole quad)
    const h = new THREE.PlaneGeometry(16, 16, 4, 4);
    h.rotateX(-Math.PI / 2);
    expect(cutUnder(h, [-3, -3], [3, 3])).toBe(0);
    expect(h.index.count).toBe(16 * 6);
  });

  it('draws no far triangle wholly under the near map: a hollow there is the near grid’s alone', () => {
    // a near map 128 m a side, a hollow 12 m deep at its middle; a far map 256 m a side that never saw it
    const flat = (w, mpp, at = () => 20) => {
      const data = new Uint16Array(w * w);
      const min = -((w - 1) * mpp) / 2;
      for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) data[j * w + i] = Math.round(at(min + i * mpp, min + j * mpp) * 64);
      return { data, w, h: w, minX: min, minZ: min, metresPerPixel: mpp };
    };
    const hollow = (x, z) => (Math.hypot(x, z) < 10 ? 8 : 20);
    const layer = imageLayerFrom({ heightScale: 1024, heightOffset: 0, holePixels: 0 }, flat(129, 1, hollow), flat(65, 4));
    const terrain = { near: { min: [-64, -64], size: [129, 129], metresPerPixel: 1 }, far: { min: [-128, -128], size: [65, 65], metresPerPixel: 4 } };
    const ground = buildGround(layer, terrain);
    const far = ground.children[1].geometry;
    // (8 × 8 quads of FAR_STEP; the 4 × 4 under the near map are gone)
    expect(FAR_STEP).toBe(32);
    expect(far.index.count).toBe((64 - 16) * 6);
    const p = far.attributes.position;
    const inside = (i) => Math.abs(p.getX(i)) < 64 && Math.abs(p.getZ(i)) < 64;
    for (let t = 0; t < far.index.count; t += 3) expect(inside(far.index.getX(t)) && inside(far.index.getX(t + 1)) && inside(far.index.getX(t + 2))).toBe(false);
    // (its vertices are where they were, a little under the ground)
    expect(p.getY(0)).toBeCloseTo(20 - FAR_DROP, 4);
    ground.traverse((o) => o.geometry?.dispose());
  });
});
