import { describe, expect, it } from 'vitest';
import { OVERLAP, at, endOf, roadOf, sOf, total } from './line';
import { STAGES } from './stages/index';

describe('the line: one number, the progress s, along the stages', () => {
  it('the whole is the sum of the stages', () => {
    expect(total(STAGES)).toBe(STAGES.reduce((a, s) => a + s.length, 0));
    expect(OVERLAP).toBe(80);
  });

  it('s = 0 is Hobbiton’s start and s = 1 the Havens’ end', () => {
    expect(at(STAGES, 0)).toMatchObject({ stage: 'hobbiton', index: 0, local: 0, metres: 0 });
    const end = at(STAGES, 1);
    expect(end.stage).toBe('havens');
    expect(end.local).toBeCloseTo(STAGES.at(-1).length, 6);
    expect(at(STAGES, -2).stage).toBe('hobbiton');
    expect(at(STAGES, 7).stage).toBe('havens');
  });

  it('every stage’s address lands on that stage, at its start or metres into it', () => {
    for (const st of STAGES) {
      const here = at(STAGES, sOf(STAGES, st.id, 0));
      expect(here.stage).toBe(st.id);
      expect(Math.abs(here.local)).toBeLessThan(1e-6);
      expect(at(STAGES, sOf(STAGES, st.id, 40)).local).toBeCloseTo(40, 6);
    }
    expect(() => sOf(STAGES, 'mordor')).toThrow();
  });

  it('a stage’s road is a smooth curve through its points, sampled a metre apart', () => {
    const pts = [[0, 0, 0], [0, 0, 100], [50, 0, 150]];
    const road = roadOf(pts);
    const poly = 100 + Math.hypot(50, 50);
    expect(Math.abs(road.length - poly) / poly).toBeLessThan(0.02);
    const a = road.pointAt(0);
    expect([a.x, a.y, a.z]).toEqual([0, 0, 0]);
    const b = road.pointAt(road.length);
    expect(b.x).toBeCloseTo(50, 4);
    expect(b.z).toBeCloseTo(150, 4);
    expect(road.pointAt(-5).z).toBe(0);
    const mid = road.pointAt(20);
    expect(mid.tangent[2]).toBeGreaterThan(0.9);
  });

  it('the end of a road says where the next stage stands and which way it faces', () => {
    const road = roadOf([[0, 0, 0], [0, 0, 100], [50, 0, 150]]);
    const end = endOf(road);
    const t = road.pointAt(road.length).tangent;
    expect(end.at[0]).toBeCloseTo(50, 4);
    expect(end.heading).toBeCloseTo(Math.atan2(t[0], t[2]), 6);
    expect(endOf(roadOf([[0, 0, 0], [0, 0, 50]])).heading).toBeCloseTo(0, 6);
  });
});
