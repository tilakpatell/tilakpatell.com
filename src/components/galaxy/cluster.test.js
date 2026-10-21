import { describe, expect, it } from 'vitest';
import { buffChips, createCluster } from './cluster';

// (the tests run in Node: a stand-in for each element, with the calls cluster.js makes)
const el = () => {
  const attrs = new Set();
  const vars = new Map();
  return {
    textContent: '',
    hidden: false,
    dataset: {},
    style: { setProperty: (k, v) => vars.set(k, v), getPropertyValue: (k) => vars.get(k) ?? '' },
    toggleAttribute: (n, on) => (on ? attrs.add(n) : attrs.delete(n)),
    hasAttribute: (n) => attrs.has(n),
  };
};
// (the galaxy's own blocks, and the HUD kit's vitals and arms: runtime/hud/cluster.js writes those)
const PARTS = ['.hud-vitals', '.hud-vitals-n', '.hud-arms', '.hud-arms-name', '.fc-speed', '.fc-speed-n', '.fc-kills-n', '.fc-target', '.fc-target-name', '.fc-target-dist', '.fc-target-hp'];
const MANY = { '.hud-arms-line': 3, '.hud-arms-pip': 8 };
const dom = () => {
  const parts = Object.fromEntries(PARTS.map((s) => [s, el()]));
  const many = Object.fromEntries(Object.entries(MANY).map(([s, n]) => [s, Array.from({ length: n }, el)]));
  return { ...el(), many, querySelector: (s) => parts[s] ?? null, querySelectorAll: (s) => many[s] ?? [] };
};
const laser = { name: 'Laser cannons', line: 'primary', index: 0, ammo: 0, max: 0, filling: 0 };
const v = (o = {}) => ({ on: true, shield: 82, low: false, speed: 6, top: 12, boosting: false, kills: 3, lock: null, arms: laser, ...o });

describe('flight cluster', () => {
  it('writes the ship', () => {
    const root = dom();
    createCluster().place(root, v());
    expect(root.hasAttribute('data-on')).toBe(true);
    expect(root.querySelector('.hud-vitals-n').textContent).toBe('82%');
    expect(root.querySelector('.hud-vitals').style.getPropertyValue('--v')).toBe('0.82');
    expect(root.querySelector('.fc-speed').style.getPropertyValue('--v')).toBe('0.5');
    expect(root.querySelector('.fc-speed-n').textContent).toBe('SPD 60');
    expect(root.querySelector('.fc-kills-n').textContent).toBe('3');
  });
  it('flags low deflectors and the boost', () => {
    const root = dom();
    const c = createCluster();
    c.place(root, v({ shield: 20, low: true, boosting: true }));
    expect(root.querySelector('.hud-vitals').hasAttribute('data-low')).toBe(true);
    expect(root.querySelector('.fc-speed').hasAttribute('data-boost')).toBe(true);
    c.place(root, v());
    expect(root.querySelector('.hud-vitals').hasAttribute('data-low')).toBe(false);
    expect(root.querySelector('.fc-speed').hasAttribute('data-boost')).toBe(false);
  });
  it('writes the target, and clears it', () => {
    const root = dom();
    const c = createCluster();
    c.place(root, v({ lock: { name: 'TIE Interceptor', dist: 14.2, hp: 0.5 } }));
    expect(root.querySelector('.fc-target').hasAttribute('data-on')).toBe(true);
    expect(root.querySelector('.fc-target-name').textContent).toBe('TIE Interceptor');
    expect(root.querySelector('.fc-target-dist').textContent).toBe('14');
    expect(root.querySelector('.fc-target-hp').style.getPropertyValue('--v')).toBe('0.5');
    expect(root.querySelector('.fc-target-hp').hasAttribute('data-on')).toBe(true);
    c.place(root, v());
    expect(root.querySelector('.fc-target').hasAttribute('data-on')).toBe(false);
  });
  it('writes the primary line, with no rack under it', () => {
    const root = dom();
    createCluster().place(root, v());
    expect(root.querySelector('.hud-arms').hasAttribute('data-on')).toBe(true);
    expect(root.querySelector('.hud-arms-name').textContent).toBe('Laser cannons');
    expect(root.many['.hud-arms-line'].map((l) => l.hasAttribute('data-on'))).toEqual([true, false, false]);
    expect(root.many['.hud-arms-pip'].every((p) => p.hidden)).toBe(true);
  });
  it('shows no hull bar for a one-hit fighter', () => {
    const root = dom();
    createCluster().place(root, v({ lock: { name: 'TIE Fighter', dist: 9.26, hp: null } }));
    expect(root.querySelector('.fc-target-dist').textContent).toBe('9.3');
    expect(root.querySelector('.fc-target').hasAttribute('data-on')).toBe(true);
    expect(root.querySelector('.fc-target-hp').hasAttribute('data-on')).toBe(false);
  });
  it('hides when not flying, and writes nothing it already wrote', () => {
    const root = dom();
    const c = createCluster();
    c.place(root, v());
    const n = root.querySelector('.hud-vitals-n');
    n.textContent = 'tampered';
    c.place(root, v());
    expect(n.textContent).toBe('tampered'); // (unchanged value: no write)
    c.place(root, v({ on: false }));
    expect(root.hasAttribute('data-on')).toBe(false);
  });
});

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
