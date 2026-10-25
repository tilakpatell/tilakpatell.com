import { describe, expect, it } from 'vitest';
import { diffPixels, judge } from './shot-compare.mjs';

const img = (px, channels = 3) => ({ data: Uint8Array.from(px.flat()), width: 2, height: 2, channels });
const K = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
const pose = (calls, overlay) => ({ calls, triangles: [100, 100], overlay });
describe('shot-compare', () => {
  it('counts a pixel off past 8/255 in a colour channel', () => {
    expect(diffPixels(img(K), img([[9, 0, 0], [8, 8, 8], [0, 0, 200], [0, 0, 0]]))).toEqual({ share: 0.5, max: 200 });
    expect(diffPixels(img(K), { data: new Uint8Array(3), width: 1, height: 1, channels: 3 })).toBeNull();
  });
  it('judges against the floor', () => {
    const floor = { images: { a: { share: 0.1, max: 30 } }, poses: { p: pose([38, 39], []) } };
    expect(judge({ images: { a: { share: 0.12, max: 40 }, b: null }, poses: { p: pose([38, 40], ['1 lock']), q: { error: 'no pose q' } } }, floor)).toEqual(["a: 12.000% of pixels off, over the floor's 10.000%", 'b: the sizes differ', "p: 40 calls, outside the floor's 38–39", 'p: the overlay differs (1 lock)', 'q: the pose failed (no pose q)']);
    expect(judge({ images: { a: { share: 0.1, max: 99 } }, poses: { p: pose([39, 38], []) } }, floor)).toEqual([]);
  });
});
