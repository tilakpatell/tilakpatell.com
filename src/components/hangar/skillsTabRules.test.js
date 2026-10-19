import { describe, expect, it } from 'vitest';
import { BRANCHES, NODES } from './skills/tree';
import { TREE, columnsOf, nodeCard, resetLabel, treeOf } from './skillsTabRules';

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
    expect(nodeCard('u-seismic', [], { ok: false, why: 'soon' }).says).toBe('Not here yet');
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

// (what the rules would say: open in row 1, the row above wanted after)
const canFor = (nodes) => (id) => (nodes.includes(id) ? { ok: false, why: 'taken' } : { ok: false, why: 'parent' });
const flight = () => columnsOf()[0];
const wire = (t, key) => t.wires.find((w) => w.key === key);

describe('the Hangar’s skill tree, drawn as paths', () => {
  it('places every node of a branch inside its board, rows top to bottom, a row’s nodes side by side', () => {
    const t = treeOf(flight(), [], canFor([]));
    expect(t.width).toBe(TREE.width);
    expect(t.nodes.map((n) => n.id)).toEqual(['afterburn', 'trim', 'deflectors', 'plating', 'slipstream', 'hotdrive', 'instinct', 'kesselrun']);
    for (const n of t.nodes) {
      expect(n.x).toBeGreaterThan(0);
      expect(n.x).toBeLessThan(t.width);
      expect(n.y + TREE.block).toBeLessThanOrEqual(t.height);
    }
    expect(t.nodes[0].y).toBe(t.nodes[1].y);
    expect(t.nodes[2].y).toBeGreaterThan(t.nodes[0].y);
    expect(t.nodes[0].x).toBeLessThan(t.nodes[1].x);
  });
  it('powers the first row from the root, and nothing deeper till a node above is taken', () => {
    const t = treeOf(flight(), [], canFor([]));
    expect(wire(t, 'root').state).toBe('live');
    expect(wire(t, 'in:afterburn').state).toBe('live');
    expect(wire(t, 'bus:1').state).toBe('dead');
    expect(wire(t, 'in:deflectors').state).toBe('dead');
    expect(wire(t, 'out:afterburn').state).toBe('dead');
  });
  it('lights the path a taken node opens, and the bus it feeds once a node below it is taken too', () => {
    const one = treeOf(flight(), ['afterburn'], canFor(['afterburn']));
    expect(wire(one, 'root').state).toBe('taken');
    expect(wire(one, 'in:afterburn').state).toBe('taken');
    expect(wire(one, 'out:afterburn').state).toBe('taken');
    expect(wire(one, 'out:trim').state).toBe('dead');
    expect(wire(one, 'bus:1').state).toBe('live');
    expect(wire(one, 'in:deflectors').state).toBe('live');
    const two = treeOf(flight(), ['afterburn', 'deflectors'], canFor(['afterburn', 'deflectors']));
    expect(wire(two, 'bus:1').state).toBe('taken');
    expect(wire(two, 'in:deflectors').state).toBe('taken');
    expect(wire(two, 'in:plating').state).toBe('live');
  });
  it('gives the last row no way out, and every wire a path to draw', () => {
    const t = treeOf(columnsOf()[1], [], canFor([]));
    expect(t.wires.some((w) => w.key === 'out:u-seismic')).toBe(false);
    expect(t.wires.some((w) => w.key === 'bus:3')).toBe(true);
    for (const w of t.wires) expect(w.d).toMatch(/^M[\d.]+ [\d.]+( [LH] ?[\d. ]+)+$/);
  });
  it('carries each node’s card on it', () => {
    const t = treeOf(flight(), ['afterburn'], (id) => (id === 'afterburn' ? { ok: false, why: 'taken' } : { ok: true, why: null }));
    expect(t.nodes[0]).toMatchObject({ id: 'afterburn', state: 'taken', name: 'Afterburn', row: 1 });
    expect(t.nodes[1].state).toBe('open');
  });
});
