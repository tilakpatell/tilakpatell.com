import { describe, expect, it } from 'vitest';
import { GARGANTUAN } from '../gen/gargantuans';
import { GIANT, giantK, giantParts } from './giants';

const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const base = { at: [100000, 5000, -20000], size: 4000, body: 400, axis: [0, 1, 0], light: [1, 0, 0], colors: ['#ffb070', '#ffffff'], band: 300, span: Math.PI, mid: 0 };

describe('a gargantuan far off', () => {
  it('hands its discs to its mesh near, and is gone past the far edge', () => {
    for (const d of [0, 10000, 31000, 33000, 36000, 50000, 200000, 500000]) {
      const k = giantK(d, base);
      if (d < GIANT.far) expect(k.mesh + k.disc).toBeCloseTo(1, 9);
      expect(k.mesh).toBeGreaterThanOrEqual(0);
    }
    expect(giantK(GARGANTUAN.far + base.size, base).mesh).toBe(0); // (never built at a baseline pose)
    expect(giantK(GIANT.far * 1.2, base).disc).toBe(0);
    expect(GIANT.near * 1.2).toBeLessThan(GARGANTUAN.far);
  });
  it('draws each form as discs at its true size, in the world', () => {
    const cam = [0, 0, 0];
    for (const kind of ['hole', 'arc', 'hulk', 'giant', 'dyson']) {
      const parts = giantParts({ ...base, kind }, cam);
      expect(parts.length, kind).toBeGreaterThan(0);
      expect(parts.length, kind).toBeLessThanOrEqual(48);
      for (const p of parts) expect(Math.max(...p.color), kind).toBeLessThanOrEqual(2.5); // (no far glow burning the sky)
      for (const p of parts) {
        expect(len(p.at, base.at), kind).toBeLessThanOrEqual(base.size * 1.02); // (a swarm's star just over its shell's face)
        expect(p.r, kind).toBeLessThanOrEqual(base.size);
        expect(p.color.every(Number.isFinite), kind).toBe(true);
      }
    }
    // (a hole's shadow and a swarm's star drawn over their glow and shell: nearer the camera)
    const h = giantParts({ ...base, kind: 'hole' }, cam);
    expect(len(h[1].at, cam)).toBeLessThan(len(h[0].at, cam));
    // (a Dyson swarm: its star no bigger than its body, and a ring of small glints at its shell)
    const s = giantParts({ ...base, kind: 'dyson' }, cam);
    expect(s[0].r).toBe(base.body);
    for (const g of s.slice(1)) expect(g.r).toBeLessThan(base.size * 0.05);
  });
});
