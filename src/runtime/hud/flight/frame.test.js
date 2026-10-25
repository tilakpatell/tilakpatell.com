import { describe, expect, it } from 'vitest';
import { createFrame, fillFlight } from './frame.js';

const project = (x, y, z, out) => ((out.x = x), (out.y = y), (out.z = z), out);
const P = (x, y, z) => ({ x, y, z });
const SHIP = { x: 720, y: 450, z: 0, heading: Math.PI / 2, pitch: 0 };
const view = (o = {}) => ({ on: true, gun: true, foot: false, ship: SHIP, hot: false, hit: false, kill: false, static: false, rect: { x: 0, y: 0, w: 1440, h: 900 }, tanHalf: 0.5, h: 900, lock: null, lockName: '', lockText: null, lead: null, life: 0.85, threatsFrom: [], mates: null, to: null, goal: null, navMax: 260, ...o });
const fill = (o) => fillFlight(createFrame(), view(o), project);
const r6 = (n) => n.toFixed(6);
const LOCK = { id: 'h1', at: P(700, 400, 50), size: 2, hp: 2, hpMax: 3 };
const LEAD = { x: 720, y: 450, z: 30, t: 0.85 };
// a, b, g off the screen; c on it; d behind; e calm; f the lock
const [A, B, C, D, E, F, G] = [[2000, 450, 10, 1], [-300, 450, 10, 0.5], [720, 450, 100, 1], [720, 450, -50, 1], [3000, 450, 10, 0], [760, 450, -20, 1], [720, 5000, 10, 1]].map(([x, y, z, threat], i) => ({ id: 'abcdefg'[i], at: P(x, y, z), threat }));
const MATES = [[1500, 450, 10], [720, 450, 50], [-100, 450, 10], [720, -500, 10], [720, 1500, 10]].map(([x, y, z], i) => ({ id: `m${i + 1}`, name: `M${i + 1}`, at: P(x, y, z) }));
const GOAL = { at: [720, 450, 100], reach: 10, way: true, name: 'Tatooine', text: null };
const FOOT = { foot: true, gun: false, ship: null, hot: true, lock: { id: 't1', at: P(700, 400, 40), size: 1.8, dist: 12.4 }, lockText: '12 m', bracket: { k: 1.6, min: 26, max: 120 }, goal: { ...GOAL, reach: 0, way: false, text: '35 m', dist: 35.2 }, navMin: 40, navMax: 40 };

describe('the flight HUD’s record', () => {
  it('brackets the lock ×2.6, 30 to 140, and leads it', () => {
    const { lock } = fill({ lock: LOCK, lockName: 'TIE', hot: true });
    expect(lock).toMatchObject({ on: true, x: 700, y: 400, z: 50, hot: true, name: 'TIE', text: null, tough: true });
    expect([lock.r, lock.dist, lock.hp].map(r6)).toEqual(['93.600000', r6(Math.sqrt(5400)), '0.666667']);
    expect([500, 5, -5].map((z) => fill({ lock: { ...LOCK, at: P(700, 400, z) } }).lock.r)).toEqual([30, 140, 30]);
    expect(fill({ lock: { ...LOCK, hpMax: undefined } }).lock.tough).toBe(false);
    expect([{}, { t: 0.86 }, { x: 5 }, { x: 10 }].map((d) => fill({ lock: LOCK, lead: { ...LEAD, ...d } }).lead.on)).toEqual([true, false, false, true]);
    expect(fill({ lead: LEAD }).lead.on).toBe(false);
  });
  it('arrows the threats off the screen, nearest first, at most 3, leaving out the lock and the calm', () => {
    const f = fill({ lock: { ...F, size: 1 }, threatsFrom: [[A, B, C, E], null, [D, F, G]] });
    expect([f.threats.n, f.threats.at.map(({ x, y, z }) => [x, y, z])]).toEqual([3, [[720, 450, -50], [-300, 450, 10], [2000, 450, 10]]]);
  });
  it('arrows the mates off the screen, the pilot flown to among them, at most 4', () => {
    const names = (id) => fill({ mates: MATES, to: { id, name: 'W', at: P(720, 450, -5) } }).mates.at.map((m) => m.name);
    expect([names('p'), names('m1')]).toEqual([['W', 'M1', 'M3', 'M4'], ['M1', 'M3', 'M4', 'M5']]);
  });
  it('sizes the nav at reach × 2.2, clamped per map', () => {
    const { nav } = fill({ goal: GOAL });
    expect([nav, r6(nav.r)]).toMatchObject([{ on: true, x: 720, z: 100, way: true, name: 'Tatooine', dist: 100, text: null }, '198.000000']);
    expect([[20, 260], [20, 225], [0, 260]].map(([reach, navMax]) => fill({ goal: { ...GOAL, reach }, navMax }).nav.r)).toEqual([260, 225, 34]);
  });
  it('on foot: the lock ×1.6 in the map’s words, threats and mates left alone', () => {
    const f = fill(FOOT);
    expect([f.lock, r6(f.lock.r), f.reticle.on, f.lead.on, f.threats, f.mates]).toMatchObject([{ on: true, hot: true, dist: 12.4, text: '12 m', tough: null }, '64.800000', false, false, null, null]);
    expect([f.nav.r, f.nav.dist, f.nav.text]).toEqual([40, 35.2, '35 m']);
  });
  it('shows nothing while on is false', () => {
    const f = fill({ on: false, lock: LOCK, lead: LEAD, goal: GOAL, threatsFrom: [[A]], mates: MATES });
    expect([f.reticle.on, f.lock.on, f.lead.on, f.threats.n, f.mates.n, f.nav.on]).toEqual([false, false, false, 0, 0, false]);
  });
  it('fills the same records every frame, and hands the arrows’ back after a walk', () => {
    const f = createFrame();
    const parts = () => [f.reticle, f.lock, f.lead, f.nav, f.threats, f.mates, f.threats.at[0], f.mates.at[3]];
    const kept = parts();
    for (let i = 0; i < 100; i++) fillFlight(f, view({ lock: LOCK, lead: LEAD, goal: GOAL, threatsFrom: [[A, B, D]], mates: MATES }), project);
    [FOOT, {}].forEach((o) => fillFlight(f, view(o), project));
    parts().forEach((r, i) => expect(r).toBe(kept[i]));
  });
});
