import { describe, expect, it } from 'vitest';
import { PIPS, createFlightCluster, vitalsPct } from './cluster';

// (the tests run in Node: a stand-in for each element, with the calls cluster.js makes, and a count of the writes)
const el = () => {
  const attrs = new Set();
  const vars = new Map();
  const e = {
    writes: 0,
    textContent: '',
    hidden: false,
    dataset: {},
    style: {
      setProperty: (k, v) => {
        e.writes++;
        vars.set(k, v);
      },
      getPropertyValue: (k) => vars.get(k) ?? '',
    },
    toggleAttribute: (n, on) => {
      e.writes++;
      return on ? attrs.add(n) : attrs.delete(n);
    },
    hasAttribute: (n) => attrs.has(n),
  };
  return e;
};
const ONE = ['.hud-vitals', '.hud-vitals-n', '.hud-arms', '.hud-arms-name'];
const dom = () => {
  const parts = Object.fromEntries(ONE.map((s) => [s, el()]));
  const many = { '.hud-arms-line': [el(), el(), el()], '.hud-arms-pip': Array.from({ length: PIPS }, el) };
  return { ...el(), parts, many, querySelector: (s) => parts[s] ?? null, querySelectorAll: (s) => many[s] ?? [] };
};
const q = (root, s) => root.querySelector(s);
const torpedoes = { name: 'Proton torpedoes', line: 'ordnance', index: 2, ammo: 2, max: 4, filling: 0.5 };

describe('the flight cluster’s writer', () => {
  it('writes the vitals', () => {
    const root = dom();
    createFlightCluster().place(root, { on: true, vitals: { value: 82, max: 100, low: false }, arms: null });
    expect(root.hasAttribute('data-on')).toBe(true);
    expect(q(root, '.hud-vitals-n').textContent).toBe('82%');
    expect(q(root, '.hud-vitals').style.getPropertyValue('--v')).toBe('0.82');
  });

  it('flags low vitals and clears it', () => {
    const root = dom();
    const c = createFlightCluster();
    c.place(root, { on: true, vitals: { value: 20, max: 100, low: true }, arms: null });
    expect(q(root, '.hud-vitals').hasAttribute('data-low')).toBe(true);
    c.place(root, { on: true, vitals: { value: 90, max: 100, low: false }, arms: null });
    expect(q(root, '.hud-vitals').hasAttribute('data-low')).toBe(false);
  });

  it('writes a line and its rack', () => {
    const root = dom();
    createFlightCluster().place(root, { on: true, vitals: null, arms: torpedoes });
    const arms = q(root, '.hud-arms');
    expect(arms.hasAttribute('data-on')).toBe(true);
    expect(arms.dataset.line).toBe('ordnance');
    expect(q(root, '.hud-arms-name').textContent).toBe('Proton torpedoes');
    expect(root.many['.hud-arms-line'].map((l) => l.hasAttribute('data-on'))).toEqual([false, false, true]);
    const pips = root.many['.hud-arms-pip'];
    expect(pips.map((p) => p.hasAttribute('data-full'))).toEqual([true, true, false, false, false, false, false, false]);
    expect(pips[2].style.getPropertyValue('--fill')).toBe('0.50');
    expect(pips.map((p) => p.hidden)).toEqual([false, false, false, false, true, true, true, true]);
  });

  it('hides the arms with none', () => {
    const root = dom();
    const c = createFlightCluster();
    c.place(root, { on: true, vitals: null, arms: torpedoes });
    c.place(root, { on: true, vitals: null, arms: null });
    expect(q(root, '.hud-arms').hasAttribute('data-on')).toBe(false);
  });

  it('writes nothing that hasn’t changed', () => {
    const root = dom();
    const c = createFlightCluster();
    const v = { on: true, vitals: { value: 50, max: 100, low: false }, arms: torpedoes };
    c.place(root, v);
    const all = [root, ...Object.values(root.parts), ...root.many['.hud-arms-line'], ...root.many['.hud-arms-pip']];
    const before = all.map((e) => e.writes);
    c.place(root, { ...v, vitals: { ...v.vitals }, arms: { ...torpedoes } });
    expect(all.map((e) => e.writes)).toEqual(before);
  });

  it('writes only the root when off', () => {
    const root = dom();
    createFlightCluster().place(root, { on: false, vitals: { value: 50, max: 100, low: false }, arms: torpedoes });
    expect(root.hasAttribute('data-on')).toBe(false);
    expect(Object.values(root.parts).every((e) => e.writes === 0)).toBe(true);
  });

  it('clamps the vitals to whole percents', () => {
    expect(vitalsPct(130, 100)).toBe(100);
    expect(vitalsPct(-4, 100)).toBe(0);
    expect(vitalsPct(1, 3)).toBe(33);
    expect(vitalsPct(5, 0)).toBe(0);
  });
});
