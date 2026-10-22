import { describe, expect, it } from 'vitest';
import { CUTS, placements, urlOf } from './hallModels';
import { HALL, hallPlan } from './plan/greatHall';

const plan = hallPlan({ tier: 'high' });
// the models as cut (public/models/hogwarts/models.json): a 7.5 m length of
// table, a 3.6 m bench, a chair
const sizes = { table: [7.5, 1.04, 1.37], bench: [3.6, 0.94, 0.76], chair: [0.84, 1.75, 0.68] };

describe('the hall’s furniture as models', () => {
  const at = placements(plan, sizes);

  it('lays each house table as lengths end to end, filling it exactly, at the table’s height and width', () => {
    expect(at.table).toHaveLength(plan.tables.length * 5);
    for (const t of plan.tables) {
      const mine = at.table.filter((p) => p.at[0] === t.x);
      const run = mine.reduce((s, p) => s + p.s[0] * sizes.table[0], 0);
      expect(run).toBeCloseTo(t.z1 - t.z0, 6);
      for (const p of mine) {
        expect(p.s[1] * sizes.table[1]).toBeCloseTo(HALL.table.top, 6);
        expect(p.s[2] * sizes.table[2]).toBeCloseTo(HALL.table.width, 6);
      }
    }
  });

  it('puts a bench along each side of every table, its seat at the bench’s height', () => {
    expect(new Set(at.bench.map((p) => p.at[0])).size).toBe(plan.benches.length);
    for (const p of at.bench) expect(p.s[1] * sizes.bench[1]).toBeCloseTo(HALL.bench.top, 6);
  });

  it('gives every member of staff a chair but the Headmaster, whose gold chair is the kit’s', () => {
    expect(at.chair).toHaveLength(plan.staff.length - 1);
    for (const c of at.chair) expect(c.at[1]).toBe(HALL.dais.height);
  });

  it('asks for a cut each model has at every tier, and the candles’ only on ultra', () => {
    for (const part of ['table', 'bench', 'chair']) for (const tier of ['low', 'mid', 'high', 'ultra']) expect(urlOf(part, tier)).toMatch(/^\/models\/hogwarts\/hall\/[a-z-]+(\.lo)?\.glb$/);
    expect(urlOf('candle', 'high')).toBeNull();
    expect(urlOf('candle', 'ultra')).toBe('/models/hogwarts/hall/candle.lo.glb');
    expect(Object.keys(CUTS)).toContain('candle');
  });
});
