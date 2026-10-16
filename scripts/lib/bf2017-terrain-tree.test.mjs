import { describe, expect, it } from 'vitest';
import { agreement, bc3Colours, bc3Decode, colourTree, composeMasks, framesOf, maskRasters, MASK, sampleRaster, sectionsOf, treeOf } from './bf2017-terrain-tree.mjs';

// A small resource in the game's form: a 64 m node, its layer-1 raster and
// two of its four 32 m children's, painted from one linear field (4 · x), so
// the parent is its children's mean, a border is its neighbour's inside, and
// the missing children are the parent's; and a colour tree of a root raster
// and four empty children.
const field = (x) => Math.max(0, Math.min(255, Math.round(4 * x)));
function raster(minX, minZ, size) {
  const T = MASK.tile;
  const cell = size / MASK.cells;
  const out = Buffer.alloc(T * T);
  for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) out[j * T + i] = field(minX + (i - MASK.border + 0.5) * cell);
  return out;
}
function record(tag, minX, minZ, size, b) {
  const r = Buffer.alloc(MASK.record);
  r[0] = tag;
  r.writeFloatLE(minX, 1);
  r.writeFloatLE(minZ, 5);
  r.writeFloatLE(minX + size, 9);
  r.writeFloatLE(minZ + size, 13);
  r[18] = b;
  return r;
}
function resource() {
  const rasters = [
    [1, 0, 0, 64],
    [1, 0, 0, 32],
    [1, 32, 0, 32],
  ];
  const head = Buffer.alloc(63);
  head.writeUInt32LE(72, 0);
  head.writeUInt32LE(4, 4);
  head.writeUInt32LE(1 + rasters.length, 44);
  head.writeUInt32LE(rasters.length, 48);
  const data = Buffer.concat(rasters.map(([, x, z, s]) => raster(x, z, s)));
  const flag = Buffer.alloc(5);
  flag[0] = 1;
  flag.writeUInt32LE(data.length, 1);
  const masks = Buffer.concat([head, record(0, 0, 0, 64, 1), ...rasters.map(([l, x, z, s]) => record(l, x, z, s, 0)), flag, data, Buffer.alloc(9)]);
  const ch = Buffer.alloc(52);
  ch.writeUInt32LE(260, 0);
  ch.writeUInt32LE(2, 4);
  ch.writeFloatLE(-64, 20);
  ch.writeFloatLE(-64, 24);
  ch.writeFloatLE(64, 28);
  ch.writeFloatLE(64, 32);
  ch.writeUInt32LE(5, 44);
  ch.writeUInt32LE(1, 48);
  // every block: alpha 255 (index 0), colour index 1 (the second endpoint, black)
  const block = Buffer.from([255, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff, 0, 0, 0x55, 0x55, 0x55, 0x55]);
  const tile = Buffer.concat(Array.from({ length: 65 * 65 }, () => block));
  const leaf = Buffer.from([0, 0, 0, 0]);
  const colour = Buffer.concat([ch, Buffer.from([0, 0, 1]), tile, Buffer.from([1]), leaf, leaf, leaf, leaf]);
  const section = (tag, payload) => {
    const h = Buffer.alloc(5);
    h[0] = tag;
    h.writeUInt32LE(payload.length, 1);
    return Buffer.concat([h, payload]);
  };
  // (the header's first bytes as Hoth's: a resource never starts with 16 zeros, a ResMeta does)
  const top = Buffer.alloc(0x1a);
  top[1] = 1;
  top[4] = 1;
  return Buffer.concat([top, section(1, masks), section(2, colour), Buffer.from([0xff])]);
}

describe('the terrain streaming tree', () => {
  const buf = resource();
  it('finds its sections and strips a ResMeta in front', () => {
    expect([...sectionsOf(buf).keys()]).toEqual([1, 2]);
    expect(treeOf(Buffer.concat([Buffer.alloc(16), buf])).equals(buf)).toBe(true);
    expect(treeOf(buf)).toBe(buf);
  });

  it('reads the mask rasters, their layer and node', () => {
    const { rasters, records, blocks } = maskRasters(buf);
    expect({ records, blocks }).toEqual({ records: 4, blocks: 1 });
    expect(rasters.map(({ layer, minX, minZ, size }) => [layer, minX, minZ, size])).toEqual([
      [1, 0, 0, 64],
      [1, 0, 0, 32],
      [1, 32, 0, 32],
    ]);
    expect(framesOf(rasters, 0.5)).toEqual({ minX: 0, minZ: 0, maxX: 64, maxZ: 32 });
  });

  it('samples a raster on its centred texels', () => {
    const { rasters } = maskRasters(buf);
    expect(sampleRaster(buf, rasters[0], 10.5, 3)).toBeCloseTo(42, 5);
  });

  it('counts the format: borders, parents, ancestors', () => {
    const { rasters } = maskRasters(buf);
    const a = agreement(buf, rasters);
    expect(a.borders[0]).toBe(a.borders[1]);
    expect(a.borders[1]).toBeGreaterThan(0);
    expect(a.parents.n).toBe(2 * 32 * 32);
    expect(a.parents.maxAbs).toBe(0);
    expect(a.ancestors.n).toBeGreaterThan(0);
    expect(a.ancestors.agree).toBe(a.ancestors.n);
  });

  it('lays a layer into a frame: the finer raster where it is, the parent where not', () => {
    const { rasters } = maskRasters(buf);
    const frame = { minX: 0, minZ: 0, mpp: 0.5, w: 128, h: 128 };
    const out = composeMasks(buf, rasters, [1, 0, 0, 0], frame);
    for (const [ix, iz] of [
      [3, 2],
      [100, 10],
      [50, 100],
      [120, 120],
    ]) {
      expect(out[(iz * frame.w + ix) * 4]).toBe(field(0.25 + 0.5 * ix));
      expect(out[(iz * frame.w + ix) * 4 + 1]).toBe(0);
    }
    // coarser than the rasters: the box mean of the finer texels
    const coarse = composeMasks(buf, rasters, [1], { minX: 0, minZ: 0, mpp: 2, w: 32, h: 32 });
    expect(coarse[5 * 4]).toBe(Math.round((field(10.25) + field(10.75) + field(11.25) + field(11.75)) / 4));
  });

  it('reads the colour tree depth first and decodes its BC3', () => {
    const { nodes } = colourTree(buf);
    expect(nodes.map((n) => [n.level, n.minX, n.minZ, n.size, n.at !== null])).toEqual([
      [0, -64, -64, 128, true],
      [1, -64, -64, 64, false],
      [1, 0, -64, 64, false],
      [1, 0, 0, 64, false],
      [1, -64, 0, 64, false],
    ]);
    expect(bc3Colours(buf, nodes[0].at)).toEqual({ white: false, alphaMax: 255, rgbMin: 0 });
    const img = bc3Decode(buf, nodes[0].at);
    expect([...img.subarray(0, 4)]).toEqual([0, 0, 0, 255]);
    expect([...img.subarray(img.length - 4)]).toEqual([0, 0, 0, 255]);
  });
});
