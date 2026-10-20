import { describe, expect, it } from 'vitest';
import { LAYERS, decodeHeights, fieldAt, imageLayerFrom } from './layers';
import { LAYER_TYPES, makeRaw } from '../../components/galaxy/surface/terrain';

describe('the layers, shared with the galaxy', () => {
  it('has the galaxy’s nine, the city’s blocks and the game’s image', () => {
    expect(Object.keys(LAYERS)).toEqual(['swell', 'hills', 'dunes', 'mesas', 'ridges', 'mountains', 'channels', 'island', 'level', 'blocks', 'image']);
    expect(LAYER_TYPES).toEqual(Object.keys(LAYERS));
  });

  it('is the galaxy’s own: its land sums them as before', () => {
    const ground = { seed: 3, layers: [{ type: 'swell', scale: 600, height: 18 }, { type: 'level', height: 2 }] };
    const raw = makeRaw(ground);
    const by = (x, z) => LAYERS.swell(x, z, ground.layers[0], 3) + 2;
    for (const [x, z] of [[0, 0], [123.5, -88], [-900, 4000]]) expect(raw(x, z)).toBe(by(x, z));
  });
});

describe('fieldAt', () => {
  it('sums the relief, each layer seeded seed + i, weighted', () => {
    const spec = { seed: 11, relief: [{ type: 'hills', scale: 140, height: 9 }, { type: 'ridges', scale: 900, height: 25, weight: 0.25 }] };
    const x = 37;
    const z = -512;
    const want = LAYERS.hills(x, z, spec.relief[0], 11) + 0.25 * LAYERS.ridges(x, z, spec.relief[1], 12);
    expect(fieldAt(spec, x, z)).toBeCloseTo(want, 10);
  });

  it('is the base on an empty relief', () => {
    expect(fieldAt({ seed: 1, relief: [], base: 4 }, 10, 10)).toBe(4);
  });

  describe('the flight’s additions', () => {
    it('mountains with ranges break past `to` into ranges with lowlands between, and are as they were inside it', () => {
      const ring = { type: 'mountains', from: 600, to: 3000, height: 300, scale: 1100 };
      const ranged = { ...ring, ranges: 4000 };
      for (const r of [700, 1500, 2900]) expect(LAYERS.mountains(r, 0, ranged, 3)).toBe(LAYERS.mountains(r, 0, ring, 3));
      // (far out: some ground as high as the ring's, much of it far lower)
      const far = [];
      for (let i = 0; i < 400; i++) far.push(LAYERS.mountains(6000 + (i % 20) * 900, 6000 + Math.floor(i / 20) * 900, ranged, 3) / LAYERS.mountains(6000 + (i % 20) * 900, 6000 + Math.floor(i / 20) * 900, ring, 3));
      expect(Math.max(...far)).toBeGreaterThan(0.95);
      expect(far.filter((k) => k < 0.2).length).toBeGreaterThan(40);
      expect(far.every((k) => k >= 0 && k <= 1 + 1e-9)).toBe(true);
    });

    it('mountains from 0 with no `to` are a range everywhere, finite, not a ring', () => {
      const l = { type: 'mountains', from: 0, height: 300, scale: 1200 };
      let lo = Infinity;
      for (let i = 0; i < 400; i++) {
        const v = LAYERS.mountains(i * 97 - 20000, i * -53 + 9000, l, 3);
        expect(Number.isFinite(v)).toBe(true);
        lo = Math.min(lo, v);
      }
      // (the range's floor is 0.3 of its height anywhere, near the middle too)
      expect(lo).toBeGreaterThanOrEqual(0.3 * 300 - 1e-9);
      expect(LAYERS.mountains(1, 1, l, 3)).toBeGreaterThan(0);
    });

    it('ridges along a wind run long one way and short the other', () => {
      const l = { type: 'ridges', scale: 400, height: 100, wind: 0 };
      const along = [], across = [];
      for (let i = 0; i < 200; i++) {
        along.push(Math.abs(LAYERS.ridges(i * 8, 0, l, 5) - LAYERS.ridges(i * 8 + 8, 0, l, 5)));
        across.push(Math.abs(LAYERS.ridges(0, i * 8, l, 5) - LAYERS.ridges(0, i * 8 + 8, l, 5)));
      }
      const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
      expect(mean(along)).toBeLessThan(mean(across) * 0.6);
      // without a wind, as it always was
      const plain = { type: 'ridges', scale: 400, height: 100 };
      expect(LAYERS.ridges(123, 456, plain, 5)).toBe(LAYERS.ridges(123, 456, { ...plain, wind: undefined }, 5));
    });

    it('blocks: flat-topped towers on a grid, nothing in the gaps, walls a ship can read', () => {
      const l = { type: 'blocks', cell: 120, gap: 24, hMin: 200, hMax: 600, cover: 0.9 };
      // the gaps, every way
      for (const [x, z] of [[5, 60], [60, 5], [119, 60], [-5, -60], [240 + 6, 300]]) expect(LAYERS.blocks(x, z, l, 9)).toBe(0);
      let towers = 0;
      for (let ix = 0; ix < 40; ix++) {
        const top = LAYERS.blocks(ix * 120 + 60, 60, l, 9);
        if (!top) continue;
        towers++;
        expect(top).toBeGreaterThanOrEqual(200);
        expect(top).toBeLessThanOrEqual(600);
        // flat on top: the same height a few metres off the middle
        expect(LAYERS.blocks(ix * 120 + 64, 57, l, 9)).toBe(top);
        // the same tower every time
        expect(LAYERS.blocks(ix * 120 + 60, 60, l, 9)).toBe(top);
      }
      expect(towers).toBeGreaterThan(28);
      // no wall steeper than the flight's limit, 60 m in 4 m
      for (let x = 0; x < 2400; x += 1) expect(Math.abs(LAYERS.blocks(x + 4, 60, l, 9) - LAYERS.blocks(x, 60, l, 9))).toBeLessThanOrEqual(60);
      expect(LAYERS.blocks(60, 60, { ...l, cover: 0 }, 9)).toBe(0);
    });
  });
});

describe('the image layer: the game’s heightmaps', () => {
  // a 3 × 3 near map at 1 m a pixel from (0, 0), over a 5 × 5 far map at 2 m
  // from (-2, -2); heights already in metres
  const near = { data: new Float32Array([10, 12, 14, 10, 12, 14, 10, 12, NaN]), w: 3, h: 3, minX: 0, minZ: 0, metresPerPixel: 1 };
  const far = { data: new Float32Array(25).fill(5), w: 5, h: 5, minX: -2, minZ: -2, metresPerPixel: 2 };
  const layer = { type: 'image', near, far };

  it('reads the near map where it covers', () => {
    expect(LAYERS.image(0, 0, layer)).toBe(10);
    expect(LAYERS.image(1, 1, layer)).toBe(12);
  });

  it('is bilinear: halfway between two texels is their mean', () => {
    expect(LAYERS.image(0.5, 0, layer)).toBeCloseTo(11, 10);
    expect(LAYERS.image(1.5, 0.5, layer)).toBeCloseTo(13, 10);
  });

  it('reads the far map outside the near one', () => {
    expect(LAYERS.image(-1, -1, layer)).toBe(5);
    expect(LAYERS.image(5, 5, layer)).toBe(5);
  });

  it('a hole in the near map reads the far map, not zero', () => {
    expect(LAYERS.image(2, 2, layer)).toBe(5);
    expect(LAYERS.image(1.5, 1.5, layer)).toBe(5);
  });

  it('is 0 with neither map (the pack not loaded yet), and 0 beyond both', () => {
    expect(LAYERS.image(3, 3, { type: 'image', pack: 'hoth' })).toBe(0);
    expect(LAYERS.image(500, 500, layer)).toBe(0);
  });

  it('decodes 16-bit heights by the record’s scale and offset', () => {
    expect(Array.from(decodeHeights(new Uint16Array([0, 32768, 65535]), 1024, -12))).toEqual([-12, 500, 1024 - 12 - 1024 / 65536]);
    // the record's hole value reads as NaN, so the layer falls through it
    const d = decodeHeights(new Uint16Array([0, 100]), 1024, 0, { hole: 0 });
    expect(Number.isNaN(d[0])).toBe(true);
    expect(d[1]).toBeCloseTo((100 / 65536) * 1024, 6);
  });

  it('reads 16-bit maps as they are, each texel decoded as it is sampled (half the memory)', () => {
    const k = 1024 / 65536;
    const near16 = { data: Uint16Array.from([640, 768, 896, 640, 768, 896, 640, 768, 0]), w: 3, h: 3, minX: 0, minZ: 0, metresPerPixel: 1, scale: 1024, offset: 0, hole: 0 };
    const l = { type: 'image', near: near16, far };
    expect(LAYERS.image(1, 1, l)).toBeCloseTo(768 * k, 10);
    expect(LAYERS.image(0.5, 0, l)).toBeCloseTo(704 * k, 10);
    expect(LAYERS.image(2, 2, l)).toBe(5); // (the hole: the far map's)
  });

  it('builds the layer from a record and its two maps, the seam within half a metre', () => {
    const record = { heightScale: 1024, heightOffset: 0, holePixels: 0 };
    // one gentle slope, sampled at 1 m and at 2 m
    const raw = (x) => Math.round(((100 + x * 0.5) / 1024) * 65536);
    const nearPixels = { data: new Uint16Array(9 * 9).map((_, i) => raw(i % 9)), w: 9, h: 9, minX: 0, minZ: 0, metresPerPixel: 1 };
    const farPixels = { data: new Uint16Array(9 * 9).map((_, i) => raw((i % 9) * 2 - 4)), w: 9, h: 9, minX: -4, minZ: -4, metresPerPixel: 2 };
    const l = imageLayerFrom(record, nearPixels, farPixels);
    expect(l.type).toBe('image');
    expect(l.near.data).toBeInstanceOf(Uint16Array);
    const inBoth = LAYERS.image(3.3, 2.1, l);
    const farOnly = LAYERS.image(3.3, 2.1, { far: l.far });
    expect(Math.abs(inBoth - farOnly)).toBeLessThan(0.5);
    expect(inBoth).toBeCloseTo(100 + 3.3 * 0.5, 1);
  });
});
