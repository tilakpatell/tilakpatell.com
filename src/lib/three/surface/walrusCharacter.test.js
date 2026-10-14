import { beforeAll, describe, expect, it } from 'vitest';
import { loadThree } from '../light/three.js';
import { DETAIL_NORMAL_SCALE, detailSmooth, detailValid, overlay, sliceOf, slotOf, walrusAlbedo, walrusDetail, walrusOverlay, walrusSmooth } from './walrusCharacter.js';

// AOSlice's green as the snowtrooper's maps store it: 0, 105, 255 (and 170,
// which the Hoth troopers' maps never use)
const LEVELS = [0, 105, 170, 255].map((v) => v / 255);

describe('the WalrusMetallic front end', () => {
  it('picks the slot, the slice and the gap as the compiled shader does', () => {
    expect(LEVELS.map(slotOf)).toEqual([0, 1, 2, 2]);
    expect(LEVELS.map((g) => sliceOf(g))).toEqual([0, 1, 2, 2]);
    // (170: between 0.65 and 0.8, no detail; 255 takes the third slice and the z vectors)
    expect(LEVELS.map(detailValid)).toEqual([true, true, false, true]);
    // (the slice is round(2.5·g): 0.25 is slot x but slice 1)
    expect([slotOf(0.25), sliceOf(0.25)]).toEqual([0, 1]);
    expect(DETAIL_NORMAL_SCALE).toBe(0.5);
  });

  it("the detail's blue overlays the albedo and doubles the smoothness at its weight", () => {
    expect(overlay(0.2, 0.5)).toBeCloseTo(0.2);
    expect(overlay(0.8, 0.5)).toBeCloseTo(0.8);
    expect(overlay(0.2, 0.4)).toBeCloseTo(0.16);
    expect(overlay(0.8, 0.4)).toBeCloseTo(0.76);
    expect(detailSmooth(0.4, 0.5, 1)).toBeCloseTo(0.4);
    expect(detailSmooth(0.4, 0.4, 0.3)).toBeCloseTo(0.4 + (0.32 - 0.4) * 0.3);
    expect(detailSmooth(0.4, 0.4, 0)).toBe(0.4);
  });

  describe('on the node graph', () => {
    let three;
    beforeAll(async () => {
      three = await loadThree();
    });

    it('samples every slice once at the slot tiling and returns the normal, blue and weight', () => {
      const { THREE, tsl } = three;
      const asked = [];
      const sample = (t, uv) => {
        asked.push(t);
        return tsl.texture(t, uv);
      };
      const slices = [new THREE.Texture(), new THREE.Texture(), new THREE.Texture()];
      const d = walrusDetail(tsl, { sample, level: tsl.float(0.41), uv: tsl.uv(), slices, per: { tiling: [5, 15, 2, 0], normal: [0.9, 2, 0.3, 0], smoothness: [0.3, 0.1, 0, 0] } });
      expect(asked).toEqual(slices);
      for (const k of ['xy', 'blue', 'k', 'valid']) expect(d[k]?.isNode).toBe(true);
    });

    it('builds the albedo, overlay and smoothness nodes; no ColorAO leaves the colour as it was', () => {
      const { tsl } = three;
      const c = tsl.vec3(0.5, 0.5, 0.5);
      expect(walrusAlbedo(tsl, c, tsl.float(0.5), 0)).toBe(c);
      expect(walrusAlbedo(tsl, c, tsl.float(0.5), 0.5).isNode).toBe(true);
      expect(walrusOverlay(tsl, c, tsl.float(0.4), tsl.float(0.3)).isNode).toBe(true);
      expect(walrusSmooth(tsl, tsl.float(0.4), tsl.float(0.4), tsl.float(0.3)).isNode).toBe(true);
    });
  });
});
