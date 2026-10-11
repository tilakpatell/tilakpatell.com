import { FloatType } from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { describe, expect, it } from 'vitest';
import { encodeRgbe, halve, luminance, normalise, renderGlobe } from './bf2017-sky.mjs';

const read = (buf) => {
  const l = new HDRLoader();
  l.setDataType(FloatType);
  return l.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
};
// a w × h picture, RGBA floats, each texel from f(x, y)
const picture = (w, h, f) => {
  const d = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = f(x, y);
      d.set([r, g, b, 1], (y * w + x) * 4);
    }
  return { data: d, width: w, height: h };
};

describe('a level’s probe, made the site’s', () => {
  it('writes Radiance RGBE that three reads back, bright and dark, to within its 8-bit mantissa', () => {
    const p = picture(16, 8, (x, y) => [x * 100 + 0.5, y * 0.01 + 0.001, x === 3 && y === 2 ? 60000 : 0.25]);
    const back = read(encodeRgbe(p));
    expect(back.width).toBe(16);
    expect(back.height).toBe(8);
    for (let i = 0; i < 16 * 8; i++)
      for (let c = 0; c < 3; c++) {
        const want = p.data[i * 4 + c];
        expect(Math.abs(back.data[i * 4 + c] - want), `${i}.${c}`).toBeLessThanOrEqual(Math.max(...[0, 1, 2].map((k) => p.data[i * 4 + k])) / 128 + 1e-6);
      }
  });

  it('halves a face by averaging each 2 × 2', () => {
    const h = halve(picture(4, 2, (x) => [x, 0, 10]));
    expect([h.width, h.height]).toEqual([2, 1]);
    expect(Array.from(h.data.slice(0, 4))).toEqual([0.5, 0, 10, 1]);
    expect(Array.from(h.data.slice(4, 8))).toEqual([2.5, 0, 10, 1]);
  });

  it('brings the game’s light units to the site’s: the six faces’ mean light made `mean`', () => {
    const faces = [0, 1, 2, 3, 4, 5].map((i) => picture(2, 2, () => [i * 100, i * 100, i * 100]));
    const out = normalise(faces, 0.8);
    const all = out.flatMap((f) => [...Array(4).keys()].map((i) => luminance(f.data, i)));
    expect(all.reduce((a, b) => a + b, 0) / all.length).toBeCloseTo(0.8, 5);
    // (the faces themselves untouched)
    expect(faces[1].data[0]).toBe(100);
  });
});

describe('a globe from a planet’s skin (lane S3)', () => {
  const flat = (rgb, w = 8, h = 4) => {
    const data = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) data.set([...rgb, 255], i * 4);
    return { data, width: w, height: h };
  };
  it('lays the colour map on a lit disc, transparent outside it, darker on the side away from the sun', () => {
    const g = renderGlobe({ colour: flat([40, 160, 60]), size: 24, over: 2 });
    expect(g.width).toBe(48);
    const at = (x, y) => Array.from(g.data.subarray((y * 48 + x) * 4, (y * 48 + x) * 4 + 4));
    expect(at(0, 0)[3]).toBe(0); // (a corner: outside the globe, nothing)
    const centre = at(24, 24);
    expect(centre[3]).toBe(255);
    expect(centre[1]).toBeGreaterThan(centre[0]); // (green, as the map)
    expect(centre[1]).toBeGreaterThan(centre[2]);
    const sunward = at(10, 10); // (up and to the left, where the sun is)
    const shaded = at(38, 38);
    expect(sunward[1]).toBeGreaterThan(shaded[1]);
    expect(shaded[3]).toBe(255); // (the night side is still the planet, dim, not a hole)
  });
  it('lays the clouds over the ground where their coverage is above the cut, and the air’s colour at the limb', () => {
    const clouds = flat([255, 255, 255], 8, 4);
    for (let i = 0; i < 32; i++) clouds.data[i * 4] = i % 2 ? 255 : 0; // (coverage in red, as the site's cut keeps it: every other column covered)
    const clear = renderGlobe({ colour: flat([40, 160, 60]), size: 24, over: 2 });
    const cloudy = renderGlobe({ colour: flat([40, 160, 60]), clouds, cloudCut: 0.5, size: 24, over: 2 });
    const sum = (g) => g.data.reduce((s, v, i) => (i % 4 === 0 ? s + v : s), 0);
    expect(sum(cloudy)).toBeGreaterThan(sum(clear)); // (whiter where the clouds are)
    const aired = renderGlobe({ colour: flat([40, 160, 60]), atmo: [124, 148, 178], size: 24, over: 2 });
    const limb = (g, x, y) => g.data[(y * 48 + x) * 4 + 3];
    expect(limb(aired, 0, 16)).toBeGreaterThan(0); // (just past the limb: r ≈ 1.03 radii)
    expect(limb(clear, 0, 16)).toBe(0);
  });
});
