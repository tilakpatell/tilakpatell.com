import { describe, expect, it } from 'vitest';
import { BRANCHES, NODES } from './skills/tree';
import { columnsOf, nodeCard, resetLabel } from './skillsTabRules';

describe('the Hangar’s skills', () => {
  it('lay the tree out in four columns, a branch each, rows 1 to 4, every node once', () => {
    const cols = columnsOf();
    expect(cols.map((c) => c.branch)).toEqual(BRANCHES);
    for (const c of cols) {
      expect(typeof c.label).toBe('string');
      expect(c.rows).toHaveLength(4);
    }
    const all = cols.flatMap((c) => c.rows.flat());
    expect(new Set(all).size).toBe(Object.keys(NODES).length);
    expect(cols[0].rows[0]).toEqual(['afterburn', 'trim']);
  });
  it('say what each node needs, or that it’s taken', () => {
    expect(nodeCard('afterburn', [], { ok: true, why: null })).toMatchObject({ id: 'afterburn', state: 'open', name: 'Afterburn', cost: '1 point', says: 'Take it' });
    expect(nodeCard('deflectors', [], { ok: false, why: 'parent' })).toMatchObject({ state: 'parent', cost: '2 points', says: 'Needs one from the row above' });
    expect(nodeCard('afterburn', ['afterburn'], { ok: false, why: 'taken' })).toMatchObject({ state: 'taken', says: 'Taken' });
    expect(nodeCard('kesselrun', [], { ok: false, why: 'key' }).says).toBe('Needs an achievement from Star Wars');
    expect(nodeCard('b-cruiser', [], { ok: false, why: 'key' }).says).toBe('Needs an achievement from Rick and Morty');
    expect(nodeCard('u-seismic', [], { ok: false, why: 'soon' }).says).toBe('Arrives with the unique weapons');
    expect(nodeCard('racks', [], { ok: false, why: 'points' }).says).toBe('Short of points');
  });
  it('call a node taken whatever the rules say of it now', () => {
    expect(nodeCard('trim', ['trim'], { ok: false, why: 'points' }).state).toBe('taken');
  });
  it('price the reset: free the first time, then in credits', () => {
    expect(resetLabel(0)).toBe('Reset the tree (free this once)');
    expect(resetLabel(500)).toBe('Reset the tree · 500 ¢');
  });
});
