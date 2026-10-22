import { describe, expect, it } from 'vitest';
import { BOTTLES, SWEETS, fill } from './stock';

const shelf = (ry = 0) => ({ at: [1, 0.8, -2], ry, w: 2.4, h: 0.45 });

describe('a shop’s shelves', () => {
  it('are stocked the same every visit, and differently by the seed', () => {
    expect(fill([shelf()], { seed: 3 })).toEqual(fill([shelf()], { seed: 3 }));
    expect(fill([shelf()], { seed: 3 })).not.toEqual(fill([shelf()], { seed: 4 }));
  });

  it('keep everything on its shelf, along it, standing on it', () => {
    for (const ry of [0, Math.PI / 2, -Math.PI / 2, 0.4]) {
      const items = fill([shelf(ry)], { seed: 9 });
      expect(items.length).toBeGreaterThan(6);
      const along = [Math.cos(ry), -Math.sin(ry)];
      for (const i of items) {
        const dx = i.at[0] - 1;
        const dz = i.at[2] + 2;
        // (on the shelf’s own line, inside its ends)
        expect(Math.abs(dx * along[1] - dz * along[0])).toBeLessThan(1e-9);
        expect(Math.abs(dx * along[0] + dz * along[1])).toBeLessThanOrEqual(1.2);
        expect(i.at[1]).toBe(0.8);
        expect(['jar', 'box', 'tin']).toContain(i.kind);
      }
    }
  });

  it('stock fewer on a low device, and bottles behind a bar', () => {
    const many = fill([shelf(), shelf(0.2)], { seed: 2 }).length;
    expect(fill([shelf(), shelf(0.2)], { seed: 2, tier: 'low' }).length).toBeLessThan(many);
    expect(new Set(fill([shelf()], { seed: 5, kinds: BOTTLES }).map((i) => i.kind))).not.toContain('jar');
    expect(SWEETS.every((k) => k.colours.length > 0 && k.w > 0)).toBe(true);
  });
});
