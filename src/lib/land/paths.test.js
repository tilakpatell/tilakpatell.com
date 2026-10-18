import { describe, expect, it } from 'vitest';
import { boundsOf, cutAlong, distanceTo, levelAlong, nearestOn } from './paths';

// a straight path along +z at x = 0 from z = 0 to z = 100, in the shape
// roadOf gives ({ length, pointAt(m) → { x, y, z } })
const straight = { length: 100, pointAt: (m) => ({ x: 0, y: 0, z: Math.min(100, Math.max(0, m)) }) };
// a quarter circle of radius 50 about (50, 0), from (0, 0) to (50, 50)
const R = 50;
const bend = {
  length: (Math.PI / 2) * R,
  pointAt: (m) => {
    const a = Math.min(Math.PI / 2, Math.max(0, m / R));
    return { x: R - R * Math.cos(a), y: 0, z: R * Math.sin(a) };
  },
};
// land that slopes up across the path, a metre in ten, and along it
const sloped = (x, z) => x * 0.1 + z * 0.05 + 10;

describe('nearestOn', () => {
  it('finds the metres along and the distance off a straight path', () => {
    const n = nearestOn(straight, 4, 30);
    expect(n.m).toBeCloseTo(30, 1);
    expect(n.d).toBeCloseTo(4, 2);
  });

  it('clamps to an end past it', () => {
    const n = nearestOn(straight, 0, -20);
    expect(n.m).toBeCloseTo(0, 3);
    expect(n.d).toBeCloseTo(20, 2);
  });

  it('follows a bend', () => {
    // (the circle's centre is 50 m from every point on it)
    const n = nearestOn(bend, 50 - 30 * Math.cos(Math.PI / 4), 30 * Math.sin(Math.PI / 4));
    expect(n.d).toBeCloseTo(20, 1);
    expect(n.m).toBeCloseTo((Math.PI / 4) * R, 0);
  });
});

describe('levelAlong', () => {
  const f = levelAlong(sloped, straight, { width: 6, edge: 12 });

  it('holds the path’s own height within width / 2 of it', () => {
    // (the land at the nearest path point, x = 0: the cross slope gone)
    expect(f(0, 50)).toBeCloseTo(sloped(0, 50), 3);
    expect(f(2.9, 50)).toBeCloseTo(sloped(0, 50), 3);
    expect(f(-2.9, 20)).toBeCloseTo(sloped(0, 20), 3);
  });

  it('is the raw land past width / 2 + edge', () => {
    expect(f(15.1, 50)).toBe(sloped(15.1, 50));
    expect(f(-40, 50)).toBe(sloped(-40, 50));
  });

  it('eases between, never past either', () => {
    const v = f(9, 50);
    expect(v).toBeGreaterThan(sloped(0, 50));
    expect(v).toBeLessThan(sloped(9, 50));
  });

  it('levels along a bend too', () => {
    const g = levelAlong(sloped, bend);
    const a = Math.PI / 4;
    const on = [R - R * Math.cos(a), R * Math.sin(a)];
    const off = [R - (R - 2) * Math.cos(a), (R - 2) * Math.sin(a)];
    expect(g(...off)).toBeCloseTo(sloped(...on), 1);
  });

  it('takes the default width and edge', () => {
    const g = levelAlong(sloped, straight);
    expect(g(2.9, 50)).toBeCloseTo(sloped(0, 50), 3);
    expect(g(15.1, 50)).toBe(sloped(15.1, 50));
  });
});

describe('cutAlong', () => {
  const flat = () => 5;
  const f = cutAlong(flat, straight, { depth: 2, width: 10, bank: 4 });

  it('lowers the land by depth within width / 2 of the line', () => {
    expect(f(0, 50)).toBeCloseTo(3, 6);
    expect(f(4.9, 50)).toBeCloseTo(3, 6);
  });

  it('leaves it past width / 2 + bank, and banks between', () => {
    expect(f(9.1, 50)).toBe(5);
    const v = f(7, 50);
    expect(v).toBeGreaterThan(3);
    expect(v).toBeLessThan(5);
  });
});

describe('distanceTo and boundsOf', () => {
  it('reads as nearestOn does, and bounds the line', () => {
    const d = distanceTo(bend);
    for (const [x, z] of [[3, 4], [40, 20], [-5, -5]]) expect(d(x, z)).toBeCloseTo(nearestOn(bend, x, z).d, 9);
    const b = boundsOf(straight);
    expect(b).toEqual({ x0: 0, x1: 0, z0: 0, z1: 100 });
  });
});
