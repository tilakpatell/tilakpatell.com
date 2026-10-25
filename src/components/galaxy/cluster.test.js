import { describe, expect, it } from 'vitest';
import { buffChips, createCluster } from './cluster';

// (a stand-in for the row of chips: the document's createElement, and append and remove)
const row = () => {
  const made = [];
  const node = (tag) => {
    const n = { tag, children: [], textContent: '', dataset: {}, className: '', parent: null, style: { setProperty: (k, v) => (n.vars[k] = v) }, vars: {} };
    n.append = (...c) => c.forEach((x) => (x.parent = n, n.children.push(x)));
    n.remove = () => n.parent && (n.parent.children = n.parent.children.filter((x) => x !== n));
    made.push(n);
    return n;
  };
  const root = node('div');
  root.ownerDocument = { createElement: node };
  return { root, made };
};
const effect = (kind, left, of, points = null) => ({ kind, name: kind, left, of, points });

describe('the pickups’ chips', () => {
  it('says each effect as a chip: its share left and its time', () => {
    expect(buffChips([{ kind: 'rapid', name: 'Rapid fire', left: 6, of: 12, points: null }])).toEqual([{ kind: 'rapid', name: 'Rapid fire', v: '0.5', text: '6s' }]);
    expect(buffChips([{ kind: 'bubble', name: 'Bubble shield', left: 3.2, of: 15, points: 41 }])[0].text).toBe('41');
    expect(buffChips([])).toEqual([]);
  });
  it('holds the bar full for an effect stacked past its own time', () => {
    expect(buffChips([effect('rapid', 20, 12)])[0].v).toBe('1');
  });
  it('makes a chip a kind, writes only what changes, and takes it away with the effect', () => {
    const { root, made } = row();
    const c = createCluster();
    c.buffs(root, [effect('rapid', 12, 12), effect('bubble', 15, 15, 60)]);
    expect(root.children.map((x) => x.dataset.kind)).toEqual(['rapid', 'bubble']);
    const rapid = root.children[0];
    expect(rapid.className).toBe('fc-buff');
    expect(rapid.children[0].textContent).toBe('rapid');
    expect(rapid.children[1].textContent).toBe('12s');
    expect(rapid.vars['--v']).toBe('1');
    expect(root.children[1].children[1].textContent).toBe('60');
    const count = made.length;
    rapid.children[1].textContent = 'tampered';
    c.buffs(root, [effect('rapid', 11.9, 12), effect('bubble', 14, 15, 60)]);
    expect(rapid.children[1].textContent).toBe('tampered'); // (still 12 s, still the same share: no write, no new chip)
    expect(made.length).toBe(count);
    c.buffs(root, [effect('rapid', 6, 12), effect('bubble', 14, 15, 25)]);
    expect(rapid.children[1].textContent).toBe('6s');
    expect(rapid.vars['--v']).toBe('0.5');
    expect(root.children[1].children[1].textContent).toBe('25');
    c.buffs(root, [effect('bubble', 14, 15, 25)]);
    expect(root.children.map((x) => x.dataset.kind)).toEqual(['bubble']);
    c.buffs(root, []);
    expect(root.children.length).toBe(0);
  });
  it('does nothing with no row, and makes nothing for no effects', () => {
    const c = createCluster();
    expect(() => c.buffs(null, [effect('rapid', 5, 12)])).not.toThrow();
    const { root, made } = row();
    c.buffs(root, []);
    expect(made.length).toBe(1); // (the root itself)
  });
});
