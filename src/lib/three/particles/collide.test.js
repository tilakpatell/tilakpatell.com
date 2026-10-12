import { describe, expect, it } from 'vitest';
import { COLLIDE, collideParticle } from './collide.js';
import { depthPlane } from './fixtures/depthPlane.js';

const scene = (o) => depthPlane(o);

const at = (p, v) => ({ p: new Float32Array([...p, 0]), v: new Float32Array([...v, 1]) });

describe('collideParticle, the depth-buffer kernel’s CPU twin', () => {
  it('a particle just behind the floor lands on it and bounces, damped', () => {
    const s = scene();
    const { p, v } = at([0.5, -0.05, 0.3], [2, -3, 0]);
    expect(collideParticle(p, v, 0, s)).toBe(true);
    expect(p[1]).toBeCloseTo(0, 2);
    expect(v[1]).toBeCloseTo(3 * COLLIDE.bounce, 2);
    expect(v[0]).toBeCloseTo(2 * (1 - COLLIDE.friction), 2);
  });

  it('above the floor, nothing', () => {
    const s = scene();
    const { p, v } = at([0.5, 0.2, 0.3], [0, -3, 0]);
    expect(collideParticle(p, v, 0, s)).toBe(false);
    expect(v[1]).toBe(-3);
  });

  it('further behind than the surface’s thickness, nothing (it is behind the wall, not in it)', () => {
    const s = scene();
    const { p, v } = at([0.5, -0.5, 0.3], [0, -3, 0]);
    expect(collideParticle(p, v, 0, s)).toBe(false);
  });

  it('off the screen it falls through: no depth there (Review Focus 3)', () => {
    const s = scene();
    const { p, v } = at([60, -0.05, 0], [0, -3, 0]);
    expect(collideParticle(p, v, 0, s)).toBe(false);
    expect(p[1]).toBeCloseTo(-0.05, 6);
  });

  it('where nothing was drawn (depth 1) it falls through', () => {
    const s = scene({ floor: false });
    const { p, v } = at([0.5, -0.05, 0.3], [0, -3, 0]);
    expect(collideParticle(p, v, 0, s)).toBe(false);
  });

  it('behind the camera, nothing', () => {
    const s = scene();
    const { p, v } = at([0, 12, 0], [0, -3, 0]);
    expect(collideParticle(p, v, 0, s)).toBe(false);
  });

  it('a particle moving away from the surface is put back on it but not turned', () => {
    const s = scene();
    const { p, v } = at([0.5, -0.05, 0.3], [0, 2, 0]);
    expect(collideParticle(p, v, 0, s)).toBe(true);
    expect(v[1]).toBe(2);
  });
});
