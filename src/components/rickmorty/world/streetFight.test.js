import { describe, expect, it } from 'vitest';
import { FIGHT, createStreetFight } from './streetFight';
import { PATROL } from './patrolRules';

const STOCK = { paint: 'stock' };
const still = () => 0.5;
const cruiser = (o = {}) => ({ x: 0, y: 12, z: 0, yaw: 0, ...o });
// the bolts flown on until something's met, the fight's events gathered
const run = (f, s, { at, flying = true, stats = null, steps = 90, from = 0 } = {}) => {
  const out = [];
  for (let i = 0; i < steps; i++) out.push(...f.step(1 / 60, from + i / 60, { cruiser: s, at, flying, stats }));
  return out;
};

describe('the street’s fight: the cruiser’s guns', () => {
  it('aims at the patrol when it’s in the guns’ reach and turn, else straight ahead', () => {
    const f = createStreetFight({ loadout: STOCK, rand: still });
    expect(f.fire(0, cruiser(), { x: 8, y: 12, z: 15 })).toBe(true);
    const [b] = f.live();
    expect(b.dir[0]).toBeGreaterThan(0.3);
    const g = createStreetFight({ loadout: STOCK, rand: still });
    g.fire(0, cruiser(), { x: 0, y: 12, z: -20 });
    expect(g.live()[0].dir[2]).toBeCloseTo(1);
  });
  it('fires at the line’s own pace', () => {
    const f = createStreetFight({ loadout: STOCK, rand: still });
    expect(f.fire(0, cruiser(), null)).toBe(true);
    expect(f.fire(0.05, cruiser(), null)).toBe(false);
    expect(f.fire(FIGHT.cadence + 0.01, cruiser(), null)).toBe(true);
  });
  it('turns a calm patrol on you with a hit, and shoots it down in its hp of hits', () => {
    const f = createStreetFight({ loadout: STOCK, rand: still });
    const at = { x: 0, y: 12, z: 12 };
    f.fire(0, cruiser(), at);
    expect(run(f, cruiser(), { at, steps: 40 }).map((e) => e.type)).toContain('provoked');
    expect(f.patrol.mode).toBe('fight');
    const seen = [];
    for (let i = 1; i < PATROL.hp; i++) {
      f.fire(i, cruiser(), at);
      seen.push(...run(f, cruiser(), { at, steps: 20, from: i }).map((e) => e.type));
    }
    expect(seen).toContain('down');
    expect(f.patrol.mode).toBe('down');
  });
  it('brings a heavy round round onto the patrol', () => {
    const f = createStreetFight({ loadout: STOCK, rand: still });
    f.pick(2);
    const at = { x: 25, y: 12, z: -6 }; // (behind the guns’ turn: fired ahead)
    f.fire(0, cruiser(), at);
    const b = f.live()[0];
    expect(b.dir[0]).toBeCloseTo(0);
    run(f, cruiser(), { at, steps: 20 });
    expect(b.dir[0]).toBeGreaterThan(0.3);
  });
});

describe('the street’s fight: the patrol’s laser and the deflectors', () => {
  const angry = () => {
    const f = createStreetFight({ loadout: STOCK, rand: still });
    const at = { x: 0, y: 12, z: 10 };
    f.fire(0, cruiser(), at);
    run(f, cruiser(), { at, steps: 30 });
    return { f, at };
  };
  it('takes a hit’s 12 off the deflectors, less with plating (armorGame)', () => {
    const { f, at } = angry();
    run(f, cruiser(), { at, steps: 150, from: 1 });
    expect(f.shield).toBe(FIGHT.shield - PATROL.laser.damage * 2);
    const g = angry().f;
    run(g, cruiser(), { at, steps: 150, from: 1, stats: { armorGame: 0.9 } });
    expect(g.shield).toBeCloseTo(FIGHT.shield - PATROL.laser.damage * 0.9 * 2);
  });
  it('grounds the cruiser at no deflectors for ten seconds, the patrol back on its loop', () => {
    const { f, at } = angry();
    const types = run(f, cruiser(), { at, steps: 60 * 20, from: 1 }).map((e) => e.type);
    expect(types).toContain('grounded');
    expect(f.patrol.mode).toBe('calm');
    const until = f.groundedUntil;
    expect(f.grounded(until - 0.1)).toBe(true);
    expect(f.fire(until - 0.1, cruiser(), null)).toBe(false);
    expect(f.grounded(until + 0.01)).toBe(false);
  });
  it('lets the patrol go back to its loop when the cruiser lands', () => {
    const { f, at } = angry();
    run(f, cruiser(), { at, flying: false, steps: 2, from: 1 });
    expect(f.patrol.mode).toBe('calm');
  });
  it('brings the deflectors back once out of trouble a while', () => {
    const { f, at } = angry();
    run(f, cruiser(), { at, steps: 150, from: 1 });
    const hurt = f.shield;
    run(f, cruiser(), { at: null, steps: 60 * 7, from: 4 });
    expect(f.shield).toBeGreaterThan(hurt);
  });
});

describe('the street’s fight: the cruiser’s powers in it', () => {
  const angry = (picks = null, charge = 0) => {
    const f = createStreetFight({ loadout: STOCK, picks, charge, rand: still });
    const at = { x: 0, y: 12, z: 10, yaw: 0 };
    f.fire(0, cruiser(), at);
    run(f, cruiser(), { at, steps: 30 });
    return { f, at };
  };
  it('portals the cruiser onto the patrol’s tail with G', () => {
    const { f, at } = angry();
    const r = f.power('primary', 1, cruiser(), at);
    expect(r).toMatchObject({ ok: true, id: 'portal' });
    expect(r.portal.z).toBeCloseTo(at.z - 5);
  });
  it('takes no hit while Never tell me the odds is on', () => {
    const { f, at } = angry({ cruiser: { primary: 'odds', ultimate: 'wubba' } });
    f.setPowers({ cruiser: { primary: 'odds', ultimate: 'wubba' } }, { carry: ['falcon'] });
    f.power('primary', 1.05, cruiser(), at);
    run(f, cruiser(), { at, steps: 60 * 2, from: 1.05 });
    expect(f.shield).toBe(FIGHT.shield);
  });
  it('lets a dazed patrol fire nothing while the magnets are on', () => {
    const { f, at } = angry();
    f.setPowers({ cruiser: { primary: 'magnets', ultimate: 'heisenberg' } }, { carry: ['rv'] });
    f.power('primary', 1.05, cruiser(), at);
    run(f, cruiser(), { at, steps: 60 * 3, from: 1.05 });
    expect(f.shield).toBe(FIGHT.shield);
  });
  it('fires the big one once it’s charged, and the death ray takes the patrol down', () => {
    const { f, at } = angry(null, 1);
    expect(f.power('ultimate', 2, cruiser(), at)).toMatchObject({ ok: true, id: 'wubba' });
    const types = run(f, cruiser(), { at, steps: 60 * 3, from: 2 }).map((e) => e.type);
    expect(types).toContain('down');
  });
});
