// Middle-earth's painted stone, moved out of kit.js (which re-exports it)
// so a 'nodes' world (the Road) can paint the towns' stone without kit.js's
// shaders in its closure.
//
//   stoneTextures(renderer, { seed, size, dark, light, courses, joint, repeat, relief }) → { map, normalMap }

import { canvasTexture } from '../../lib/three/canvasTexture';
import { clamp01, fbm, makeCanvas, makeCells, makeNoise, mix, normalFromField, paintPixels, smooth } from '../../lib/paint';

// Stone: cracked along cell edges, or laid in `courses` of blocks; `joint`
// is how deep the cracks and the joints are cut.
export function stoneTextures(renderer, { seed = 3, size = 256, dark = [40, 35, 33], light = [156, 142, 130], courses = 0, joint = 0.4, repeat = [1, 1], relief = 3 } = {}) {
  const n = makeNoise(seed);
  const cells = makeCells(seed + 11);
  const field = new Float32Array(size * size);
  const c = makeCanvas(size);
  paintPixels(c, (u, v, out, x, y) => {
    let h = fbm(n, u * 8, v * 8, { period: 8, octaves: 5 });
    const fine = fbm(n, u * 32 + 9, v * 32, { period: 32, octaves: 2 });
    let seam;
    if (courses) {
      const across = courses / 2;
      const row = Math.floor(v * courses);
      const fu = (u * across + (row % 2) * 0.5) % 1;
      const fv = (v * courses) % 1;
      seam = smooth(0, 0.05, Math.min(Math.min(fu, 1 - fu) * 2, Math.min(fv, 1 - fv)));
      const col = Math.floor(u * across + (row % 2) * 0.5) % across;
      h = h * 0.8 + n(col * 3 + 0.5, row * 5 + 0.5) * 0.14;
    } else {
      const k = cells(u * 5, v * 5, 5);
      seam = smooth(0, 0.06, k.f2 - k.f1);
      h = h * 0.84 + k.id * 0.1;
    }
    h = clamp01((h * 0.8 + fine * 0.2) * (1 - joint + joint * seam));
    field[y * size + x] = h;
    const t = clamp01(h * 1.35 - 0.12);
    out[0] = mix(dark[0], light[0], t);
    out[1] = mix(dark[1], light[1], t);
    out[2] = mix(dark[2], light[2], t);
  });
  return {
    map: canvasTexture(c, renderer, { repeat }),
    normalMap: canvasTexture(normalFromField(field, size, size, relief), renderer, { repeat, srgb: false }),
  };
}
