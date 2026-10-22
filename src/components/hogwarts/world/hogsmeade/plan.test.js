import { describe, expect, it } from 'vitest';
import { SITES } from './layout';
import { TONES, planHouse } from './plan';

describe('the village’s houses, planned', () => {
  it('give every house two floors under a steep roof, the door in the middle of its front', () => {
    for (const s of SITES) {
      const p = planHouse(s);
      expect(p.ground, s.id).toBeGreaterThan(2.9);
      expect(p.upper, s.id).toBeGreaterThan(2.4);
      expect(p.ridge - p.eaves, s.id).toBeGreaterThan(2.5);
      expect(p.pitch, s.id).toBeGreaterThan(0.6);
      expect(p.door.x).toBe(0);
      expect(p.door.h).toBeLessThan(p.ground - 0.4);
    }
  });

  it('keeps the shop windows off the door and inside the front', () => {
    for (const s of SITES) {
      const p = planHouse(s);
      for (const b of p.bays) {
        expect(Math.abs(b.x) - b.w / 2, s.id).toBeGreaterThan(p.door.w / 2 + 0.3);
        expect(Math.abs(b.x) + b.w / 2, s.id).toBeLessThan(s.w / 2 - 0.2);
      }
      for (const c of p.casements) expect(Math.abs(c.x) + c.w / 2, s.id).toBeLessThan(s.w / 2);
    }
    // (the shops have a window to sell from; the Shack has none)
    expect(planHouse(SITES.find((s) => s.id === 'honeydukes')).bays).toHaveLength(2);
    expect(planHouse(SITES.find((s) => s.id === 'shack')).bays).toHaveLength(0);
  });

  it('puts its chimneys inside its walls and over its ridge, as many as the street says', () => {
    for (const s of SITES) {
      const p = planHouse(s);
      expect(p.chimneys.length, s.id).toBe(Math.max(1, s.chimney));
      for (const c of p.chimneys) {
        expect(Math.abs(c.x), s.id).toBeLessThan(s.w / 2);
        expect(Math.abs(c.z), s.id).toBeLessThan(s.d / 2);
        expect(c.top, s.id).toBeGreaterThan(p.ridge);
      }
    }
  });

  it('turns a cross gable to the street on the two biggest, and is the same house every time', () => {
    const big = SITES.filter((s) => planHouse(s).gable).map((s) => s.id);
    expect(big.sort()).toEqual(['broomsticks', 'honeydukes']);
    const a = planHouse(SITES[3]);
    expect(planHouse(SITES[3])).toEqual(a);
    for (const s of SITES) expect(TONES[s.tone], s.id).toBeTruthy();
  });

  it('leans each house by its own lean, never so far it falls', () => {
    for (const s of SITES) {
      const p = planHouse(s);
      expect(Math.abs(p.shear)).toBeCloseTo(Math.abs(s.lean) * 0.3);
      expect(p.sag).toBeLessThan(0.4);
    }
  });
});
