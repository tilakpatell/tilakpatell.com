import { describe, expect, it } from 'vitest';
import { KINDS, TILE, bakeDetail } from './hullDetail';

const N = 256;
const px = bakeDetail(N);
const at = (i, j, c) => px[(((j + N) % N) * N + ((i + N) % N)) * 4 + c];

describe('hullDetail', () => {
  it('bakes a square of RGBA, its panels’ kinds a share each of the whole', () => {
    expect(px).toHaveLength(N * N * 4);
    expect(KINDS.reduce((n, [, share]) => n + share, 0)).toBeCloseTo(1, 6);
    expect(TILE % 26).toBe(0);
    expect(TILE % 13).toBe(0);
  });

  it('tiles: across its edges it changes no more than between any two neighbours inside it', () => {
    const step = (a, b, c) => {
      let d = 0;
      for (let k = 0; k < N; k++) d += Math.abs(at(a, k, c) - at(b, k, c)) + Math.abs(at(k, a, c) - at(k, b, c));
      return d / (2 * N);
    };
    for (const c of [0, 1, 2, 3]) {
      const inside = (step(100, 101, c) + step(40, 41, c) + step(170, 171, c)) / 3;
      expect(step(N - 1, 0, c), `channel ${c}`).toBeLessThan(inside * 3 + 4);
    }
  });

  it('slopes about flat over the whole tile (it comes back to where it began), shades about the middle', () => {
    const mean = (c) => {
      let s = 0;
      for (let k = 0; k < N * N; k++) s += px[k * 4 + c];
      return s / (N * N);
    };
    expect(Math.abs(mean(0) - 127.5)).toBeLessThan(2);
    expect(Math.abs(mean(1) - 127.5)).toBeLessThan(2);
    expect(Math.abs(mean(2) - 127.5)).toBeLessThan(25);
  });

  it('cuts its seams in: a groove’s cavity deep, most of the hull open, plates of different greys', () => {
    let deep = 0;
    let open = 0;
    const greys = new Set();
    for (let k = 0; k < N * N; k++) {
      if (px[k * 4 + 3] > 100) deep++;
      if (px[k * 4 + 3] < 20) open++;
      greys.add(px[k * 4 + 2] >> 3);
    }
    expect(deep / (N * N)).toBeGreaterThan(0.01);
    expect(open / (N * N)).toBeGreaterThan(0.5);
    expect(greys.size).toBeGreaterThan(8);
  });

  it('is the same tile every time it’s baked (a worker’s and the page’s alike)', () => {
    const again = bakeDetail(N);
    expect(again.every((v, k) => v === px[k])).toBe(true);
  });
});
