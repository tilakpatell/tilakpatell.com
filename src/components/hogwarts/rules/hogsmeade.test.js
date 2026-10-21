import { describe, expect, it } from 'vitest';
import { BUILDINGS, SHACK, SNOW_FROM, VILLAGE, buildingAt, doors, frameAt, snowAt } from './hogsmeade';

describe('Hogsmeade’s High Street', () => {
  it('has a dozen buildings, each with a sign and a line at its door', () => {
    expect(BUILDINGS.length).toBe(12);
    for (const b of BUILDINGS) {
      expect(b.sign.length, b.id).toBeGreaterThan(3);
      expect(b.line.length, b.id).toBeGreaterThan(10);
      expect(b.line, b.id).toMatch(/[.”]$/);
    }
    expect(BUILDINGS.filter((b) => b.room).map((b) => b.room).sort()).toEqual(['broomsticks', 'hogshead', 'honeydukes']);
  });

  it('lays its frame along the road from the station', () => {
    const [ux, uz] = VILLAGE.axis;
    expect(Math.hypot(ux, uz)).toBeCloseTo(1);
    expect(frameAt(0, 0)).toEqual(VILLAGE.at);
    // (the right of a walker going up the street is to its right)
    const right = frameAt(0, 10);
    const cross = ux * (right[1] - VILLAGE.at[1]) - uz * (right[0] - VILLAGE.at[0]);
    expect(cross).toBeGreaterThan(0);
  });

  it('stands no two buildings in one another, and every door on the street', () => {
    const all = BUILDINGS.map((b) => buildingAt(b.id));
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        if (a.side !== b.side) continue;
        const gap = Math.abs(a.along - b.along) - (a.w + b.w) / 2;
        expect(gap, `${a.id} and ${b.id}`).toBeGreaterThanOrEqual(0);
      }
    for (const d of doors()) {
      const off = Math.hypot(d.at[0] - VILLAGE.at[0], d.at[1] - VILLAGE.at[1]);
      expect(off, d.id).toBeLessThan(VILLAGE.half + 30);
    }
    expect(buildingAt('nowhere')).toBeNull();
  });

  it('turns every door out to the street', () => {
    for (const b of BUILDINGS) {
      const s = buildingAt(b.id);
      const out = [Math.sin(s.faces), Math.cos(s.faces)];
      const toStreet = [VILLAGE.at[0] - s.door[0], VILLAGE.at[1] - s.door[1]];
      const [ux, uz] = VILLAGE.axis;
      // (the part of the way to the street’s middle that is across the street)
      const along = toStreet[0] * ux + toStreet[1] * uz;
      const across = [toStreet[0] - along * ux, toStreet[1] - along * uz];
      expect(out[0] * across[0] + out[1] * across[1], b.id).toBeGreaterThan(0);
    }
  });

  it('keeps the Shack on its hill behind the fence, away from the street', () => {
    const d = Math.hypot(SHACK.at[0] - VILLAGE.at[0], SHACK.at[1] - VILLAGE.at[1]);
    expect(d).toBeGreaterThan(VILLAGE.half);
    expect(SHACK.fence).toHaveLength(2);
  });

  it('lies under snow from the eighth week whatever the lawn is doing', () => {
    expect(snowAt(1, 0)).toBe(0);
    expect(snowAt(SNOW_FROM - 1, 0.4)).toBeCloseTo(0.4);
    expect(snowAt(SNOW_FROM, 0)).toBeGreaterThan(0.5);
    expect(snowAt(11, 1)).toBe(1);
  });
});
