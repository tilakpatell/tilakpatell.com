import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DIVE, FOUND_KEY, QUESTS_KEY, diveAt, planDive, surfaceProps } from './travel';
import { forward } from '../universe/ship';

describe('the dive on a planet', () => {
  const ship = { x: 300, y: 40, z: -120 };
  const r = 60;

  it('starts where the ship is and ends just over the air, on the same line', () => {
    const d = planDive(ship, r);
    const a = diveAt(d, 0);
    expect(a.x).toBeCloseTo(300);
    expect(a.y).toBeCloseTo(40);
    expect(a.z).toBeCloseTo(-120);
    const b = diveAt(d, DIVE);
    expect(Math.hypot(b.x, b.y, b.z)).toBeCloseTo(r * 1.08);
    expect(b.k).toBe(1);
    expect(b.x / b.z).toBeCloseTo(300 / -120);
  });

  it('goes slow, then faster and faster', () => {
    const d = planDive(ship, r);
    const at = (t) => Math.hypot(...['x', 'y', 'z'].map((k) => diveAt(d, t)[k]));
    const first = at(0) - at(DIVE / 3);
    const last = at((DIVE * 2) / 3) - at(DIVE);
    expect(last).toBeGreaterThan(first * 3);
  });

  it('points the nose at the planet', () => {
    const p = diveAt(planDive(ship, r), 0.5);
    const [fx, fz] = forward(p.heading);
    const l = Math.hypot(p.x, p.z);
    expect(fx).toBeCloseTo(-p.x / l);
    expect(fz).toBeCloseTo(-p.z / l);
  });

  it('never ends further out than it began, or inside the planet', () => {
    const near = planDive({ x: 10, y: 0, z: 0 }, r);
    expect(near.d1).toBe(10);
    expect(diveAt(near, 99).k).toBe(1);
  });
});

describe('the surface made from the galaxy', () => {
  beforeEach(() => {
    const store = new Map();
    vi.stubGlobal('window', { localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('carries what was found and done on that world, and nothing broken', () => {
    window.localStorage.setItem(FOUND_KEY, JSON.stringify({ hoth: ['base'], tatooine: 'junk' }));
    window.localStorage.setItem(QUESTS_KEY, JSON.stringify({ hoth: ['tauntaun'] }));
    const p = surfaceProps('hoth', { ship: 'xwing', loadout: { a: 1 } });
    expect(p).toMatchObject({ system: 'hoth', mission: null, ship: 'xwing', found: ['base'], done: ['tauntaun'], build: null, net: null, reduced: false });
    expect(p.compass).toEqual({ current: null });
    expect(surfaceProps('tatooine', { ship: 'xwing' }).found).toEqual([]);
  });
});
