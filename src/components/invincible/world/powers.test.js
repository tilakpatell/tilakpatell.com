import { describe, expect, it } from 'vitest';
import { POWERS, nearLine, newPower, stepPower } from './powers';

const mark = (o = {}) => ({ p: [0, 50, 0], v: [0, 0, 0], mode: 'air', look: [0, 0, -1], ...o });
const tower = (id, x, z, damage = 0, o = {}) => ({ id, x, z, w: 20, d: 20, h: 80, damage, ...o });
// the power key held for `t` seconds at 1/30 s steps, gathering what comes out
function hold(id, t, m = mark(), world = {}, p = newPower()) {
  const out = [];
  for (let s = 0; s < t - 1e-9; s += 1 / 30) {
    const r = stepPower(p, id, { power: true }, m, world, 1 / 30);
    p = r.p;
    out.push(...r.out);
  }
  return { p, out };
}
const kinds = (out) => out.map((o) => o.kind);

describe('Atom Eve’s transmute', () => {
  it('puts up a wall 12 m wide where she looks, for 6 s, once a hold', () => {
    const { out } = hold('eve', 1);
    const c = out.filter((o) => o.kind === 'construct');
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ wide: POWERS.transmute.wide, life: POWERS.transmute.life });
    expect(c[0].at[2]).toBeLessThan(0);
  });
  it('aimed at a damaged tower, mends 0.3 of it instead', () => {
    const world = { towers: [tower(4, 0, -60, 0.5)] };
    const { out } = hold('eve', 0.5, mark({ p: [0, 30, 0] }), world);
    expect(out.find((o) => o.kind === 'mend')).toMatchObject({ id: 4, amount: POWERS.transmute.mend });
    expect(kinds(out)).not.toContain('construct');
    // (a whole one isn't mended: she builds)
    expect(kinds(hold('eve', 0.5, mark({ p: [0, 30, 0] }), { towers: [tower(4, 0, -60, 0)] }).out)).toContain('construct');
  });
  it('only in the air', () => {
    expect(hold('eve', 1, mark({ mode: 'ground' })).out).toEqual([]);
  });
});

describe('Omni-Man’s line-break', () => {
  it('goes 2 s at Mach 2 the way he looks, marking each tower within 60 m of the line by 0.05', () => {
    const world = { towers: [tower(1, 30, -500), tower(2, 200, -500), tower(3, -50, -1300)] };
    const { out } = hold('omniman', 0.5, mark(), world);
    const l = out.find((o) => o.kind === 'linebreak');
    expect(l.speed).toBeCloseTo(343 * 2, 0);
    expect(l.time).toBe(POWERS.linebreak.time);
    expect(l.to[2]).toBeCloseTo(-343 * 2 * 2, 0);
    expect(l.towers).toEqual([1, 3]);
    expect(l.damage).toBe(0.05);
  });
  it('floors whoever is within 60 m of its line', () => {
    const crowd = [[10, 0, -300], [100, 0, -300], [-59, 0, -900], [0, 0, 400]];
    expect(nearLine(crowd, [0, 0, 0], [0, 0, -1372], 60)).toEqual([0, 2]);
  });
});

describe('Thragg’s shout', () => {
  it('a ring to 40 m, then not again for 8 s', () => {
    let r = hold('thragg', 0.4, mark({ mode: 'ground', p: [0, 0, 0] }));
    expect(r.out.filter((o) => o.kind === 'shout')).toEqual([expect.objectContaining({ at: [0, 0, 0], r: POWERS.shout.r })]);
    const again = hold('thragg', 7, mark(), {}, { ...r.p, held: 0, fired: false });
    expect(kinds(again.out)).not.toContain('shout');
    r = hold('thragg', 8.5, mark(), {}, { ...r.p, held: 0, fired: false });
    expect(kinds(r.out)).toContain('shout');
  });
});

describe('Mark', () => {
  it('has no power', () => {
    expect(hold('mark', 2).out).toEqual([]);
  });
  it('a minute away is one short step', () => {
    const r = stepPower({ ...newPower(), cool: 5 }, 'thragg', { power: false }, mark(), {}, 60);
    expect(r.p.cool).toBeCloseTo(4.95, 9);
  });
});
