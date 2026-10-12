import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DETAIL, detail, lodScale, modelTexCap, seg, strained, texScale } from './detail';
import { noteGpu } from './device';

describe('how finely to paint a texture at each level', () => {
  it('paints at the design size on a desktop and a phone, half on a weak device, twice at ultra', () => {
    expect(texScale(512, { level: 'high' })).toBe(1);
    expect(texScale(512, { level: 'mid' })).toBe(1);
    expect(texScale(512, { level: 'low' })).toBe(0.5);
    expect(texScale(512, { level: 'ultra' })).toBe(2);
  });

  it('keeps under each level’s ceiling, halving until it fits', () => {
    // (a 1024 design is 2048 at ultra, a 2048 one stays 4096 at most)
    expect(texScale(1024, { level: 'ultra' })).toBe(2);
    expect(texScale(4096, { level: 'ultra' })).toBe(1);
    expect(texScale(2048, { level: 'mid' })).toBe(0.5);
    expect(texScale(1024, { level: 'low' })).toBe(0.5);
    expect(texScale(2048, { level: 'low' })).toBe(0.25);
  });

  it('takes a caller’s own ceiling, and never paints smaller than a few texels', () => {
    expect(texScale(512, { level: 'ultra', max: 512 })).toBe(1);
    expect(texScale(64, { level: 'low' })).toBe(0.5);
    expect(texScale(32, { level: 'low' })).toBe(1);
  });

  it('only ever scales by powers of two, so a power-of-two design stays one', () => {
    for (const level of Object.keys(DETAIL)) {
      for (const design of [64, 128, 256, 384, 512, 1024, 2048]) {
        const k = texScale(design, { level });
        expect(Number.isInteger(Math.log2(k)), `${level} ${design}`).toBe(true);
      }
    }
  });
});

describe('how many segments round a curve', () => {
  it('doubles them at ultra and trims them on a phone or a weak device', () => {
    expect(seg(32, { level: 'high' })).toBe(32);
    expect(seg(32, { level: 'ultra' })).toBe(64);
    expect(seg(32, { level: 'mid' })).toBe(24);
    expect(seg(32, { level: 'low' })).toBe(16);
  });

  it('never trims a curve below six sides, nor a shape that had fewer to start with', () => {
    expect(seg(8, { level: 'low' })).toBe(6);
    expect(seg(6, { level: 'low' })).toBe(6);
    expect(seg(4, { level: 'low' })).toBe(4);
    expect(seg(4, { level: 'ultra' })).toBe(8);
    expect(seg(12, { level: 'low', min: 10 })).toBe(10);
  });

  it('gives whole numbers', () => {
    expect(Number.isInteger(seg(14, { level: 'mid' }))).toBe(true);
    expect(Number.isInteger(seg(7, { level: 'ultra' }))).toBe(true);
  });
});

describe('the rest of each level', () => {
  it('grows from low to ultra', () => {
    const order = ['low', 'mid', 'high', 'ultra'];
    for (let i = 1; i < order.length; i++) {
      expect(modelTexCap(order[i])).toBeGreaterThan(modelTexCap(order[i - 1]));
      expect(lodScale(order[i])).toBeGreaterThan(lodScale(order[i - 1]));
      expect(DETAIL[order[i]].seg).toBeGreaterThan(DETAIL[order[i - 1]].seg);
    }
  });

  it('reads an unknown level as high', () => {
    expect(detail('nonsense')).toBe(DETAIL.high);
  });

  it('keeps clearcoat on the hulls for ultra alone', () => {
    expect(DETAIL.ultra.clearcoat).toBeGreaterThan(0);
    for (const level of ['low', 'mid', 'high']) expect(DETAIL[level].clearcoat).toBe(0);
  });
});

describe('a strong card held at high (lane L1)', () => {
  const RTX5090 = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 5090 (0x00002B85) Direct3D11 vs_5_0 ps_5_0, D3D11)';
  const GTX1060 = 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 6GB Direct3D11 vs_5_0 ps_5_0, D3D11)';
  const store = new Map();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('window', {
      location: { search: '', hash: '' },
      localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
      navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0', deviceMemory: 16, hardwareConcurrency: 8 },
      screen: { width: 2560, height: 1440 },
      innerWidth: 2560,
      dispatchEvent: () => {},
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    noteGpu(null);
  });

  // (on the owner's RTX 5090 a level arriving for a minute read as late
  // frames, the pace floored and this held the chip at high for good)
  it('never from the frame times alone on a chip graded ultra: a loading hitch is not a weak chip', () => {
    noteGpu({ renderer: RTX5090 });
    expect(strained()).toBe(false);
    expect(store.has('tp-detail-cap')).toBe(false);
    expect(strained({ by: 'gpu' })).toBe(true);
    expect(JSON.parse(store.get('tp-detail-cap'))).toMatchObject({ renderer: RTX5090, level: 'high' });
  });

  it('from the frame times on a card graded below ultra, and never below ultra', () => {
    noteGpu({ renderer: GTX1060 });
    expect(strained()).toBe(true);
    expect(JSON.parse(store.get('tp-detail-cap')).level).toBe('high');
    store.clear();
    expect(strained()).toBe(false); // (held at high already: nothing more to hold)
  });
});
