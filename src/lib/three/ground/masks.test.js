import { describe, expect, it } from 'vitest';
import { densityOf, fieldOf, maskOf, masksOf, slopeOf, softRange } from './masks.js';

// Hoth's rules as ground.json writes them (scripts/lib/bf2017-ground.mjs)
const RULES = [{ layer: 'rocky', slope: [30, null] }, { layer: 'chunky', slope: [null, 15], height: [null, -2] }, { layer: 'rough', density: 'high' }, { layer: 'packed' }];

// A 64 × 64 synthetic ground at 1 m a pixel: the flat at 0; a ridge whose
// flanks climb at 45° (columns 40 to 56, peak at 48); a trench 4 m down
// (rows 8 to 20, columns 4 to 24, walls a pixel wide); an apron of placed
// meshes on the flat round (16, 48).
const N = 64;
function synthetic() {
  const heights = new Float32Array(N * N);
  for (let z = 0; z < N; z++) {
    for (let x = 0; x < N; x++) {
      let h = 0;
      if (x >= 40 && x <= 56) h = 8 - Math.abs(x - 48);
      if (z >= 8 && z <= 20 && x >= 4 && x <= 24) h = -4;
      heights[z * N + x] = h;
    }
  }
  const frame = { w: N, h: N, minX: 0, minZ: 0, metresPerPixel: 1 };
  const points = [];
  for (let i = 0; i < 400; i++) points.push(12 + (i % 20) * 0.4, 44 + Math.floor(i / 20) * 0.4);
  return { heights, frame, points };
}

function ctx() {
  const { heights, frame, points } = synthetic();
  const slope = slopeOf(heights, frame);
  const field = fieldOf(heights, frame, 16);
  const density = densityOf(points, frame, { radius: 4, full: 4 });
  return { heights, slope, field, density, frame, rules: RULES };
}
const at = (a, x, z) => a[z * N + x];

describe('softRange', () => {
  it('is 1 inside, 0 outside, open where an end is null', () => {
    expect(softRange(20, [10, 30], 2)).toBe(1);
    expect(softRange(5, [10, 30], 2)).toBe(0);
    expect(softRange(35, [10, 30], 2)).toBe(0);
    expect(softRange(10, [10, 30], 2)).toBeCloseTo(0.5);
    expect(softRange(-1e6, [null, 0], 1)).toBe(1);
    expect(softRange(1e6, [0, null], 1)).toBe(1);
    expect(softRange(3, undefined, 1)).toBe(1);
  });
});

describe('slopeOf', () => {
  it('reads 45° on the ridge’s flank and 0° on the flat', () => {
    const { heights, frame } = synthetic();
    const s = slopeOf(heights, frame);
    expect(at(s, 44, 40)).toBeCloseTo(45, 0);
    expect(at(s, 32, 40)).toBe(0);
  });
  it('reads a hole as level ground, not a cliff', () => {
    const { heights, frame } = synthetic();
    heights[30 * N + 30] = NaN;
    const s = slopeOf(heights, frame);
    expect(at(s, 31, 30)).toBe(0);
    expect(at(s, 30, 30)).toBe(0);
  });
});

describe('maskOf on the synthetic ground (Review Focus 1)', () => {
  const c = ctx();
  const m = masksOf(RULES, c);
  it('the ridge’s flank is rocky', () => {
    expect(at(m.rocky, 44, 40)).toBeGreaterThan(0.95);
    expect(maskOf('rocky', c)[40 * N + 44]).toBeGreaterThan(0.95);
  });
  it('the trench’s floor is chunky', () => {
    expect(at(m.chunky, 14, 14)).toBeGreaterThan(0.95);
  });
  it('the apron is rough', () => {
    expect(at(m.rough, 16, 48)).toBeGreaterThan(0.95);
  });
  it('the open flat is packed', () => {
    expect(at(m.packed, 32, 40)).toBeGreaterThan(0.95);
    expect(at(m.packed, 30, 4)).toBeGreaterThan(0.95);
  });
  it('the layers sum to one at every pixel', () => {
    for (let i = 0; i < N * N; i++) {
      const sum = m.rocky[i] + m.chunky[i] + m.rough[i] + m.packed[i];
      expect(sum).toBeCloseTo(1, 5);
    }
  });
  it('a world whose rules end without a catch-all still sums to one (the last layer takes the rest)', () => {
    const r = masksOf(RULES.slice(0, 2), c);
    for (let i = 0; i < N * N; i += 37) expect(r.rocky[i] + r.chunky[i]).toBeCloseTo(1, 5);
  });
  it('computes the slope and field itself when only the heights are given', () => {
    const { heights, frame } = synthetic();
    const r = masksOf(RULES, { heights, frame, fieldM: 16 });
    expect(at(r.rocky, 44, 40)).toBeGreaterThan(0.95);
    expect(at(r.chunky, 14, 14)).toBeGreaterThan(0.95);
    // (no density given: nothing is an apron)
    expect(at(r.rough, 16, 48)).toBe(0);
  });
});
