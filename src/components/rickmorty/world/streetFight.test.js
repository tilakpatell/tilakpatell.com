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

describe('the street’s fight in a chase (./games/chase.js)', () => {
  it('turns the patrol on the cruiser for a chase, without a word, and lets it go', () => {
    const f = createStreetFight({ loadout: STOCK, rand: still });
    const at = { x: 0, y: 12, z: 12 };
    f.chase(true, 5);
    expect(f.patrol).toMatchObject({ mode: 'fight', nextShot: 5 + PATROL.first });
    expect(run(f, cruiser(), { at, steps: 30, from: 5 }).map((e) => e.type)).not.toContain('provoked');
    f.chase(false);
    expect(f.patrol.mode).toBe('calm');
  });
  it('holds a patrol in a chase: a hit flashes and takes nothing, and once it’s let go a hit takes its share', () => {
    const f = createStreetFight({ loadout: STOCK, rand: still });
    const at = { x: 0, y: 12, z: 12 };
    f.chase(true, 0);
    f.pick(2); // (a heavy round: more than its hp)
    f.fire(0, cruiser(), at);
    const held = run(f, cruiser(), { at, steps: 60 }).map((e) => e.type);
    expect(held).toContain('hit');
    expect(held).not.toContain('down');
    expect(f.patrol).toMatchObject({ mode: 'fight', hp: PATROL.hp });
    f.chase(false);
    f.fire(2, cruiser(), at);
    expect(run(f, cruiser(), { at, steps: 60, from: 2 }).map((e) => e.type)).toContain('down');
    expect(f.patrol.mode).toBe('down');
  });
  it('keeps a patrol let go held a while when asked (a chase won: the shots still in the air take nothing, and don’t turn it)', () => {
    const f = createStreetFight({ loadout: STOCK, rand: still });
    const at = { x: 0, y: 12, z: 12 };
    f.chase(true, 0);
    f.chase(false, 1, 10);
    expect(f.patrol.mode).toBe('calm');
    f.pick(2);
    f.fire(2, cruiser(), at);
    const kept = run(f, cruiser(), { at, steps: 60, from: 2 }).map((e) => e.type);
    expect(kept).not.toContain('provoked');
    expect(kept).not.toContain('down');
    expect(f.patrol).toMatchObject({ mode: 'calm', hp: PATROL.hp });
    // the while over, a hit counts again
    f.fire(12, cruiser(), at);
    expect(run(f, cruiser(), { at, steps: 60, from: 12 }).map((e) => e.type)).toContain('down');
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

describe('the street’s fight once the cruiser’s landed', () => {
  it('lets a laser already in the air pass a cruiser that’s set down', () => {
    const f = createStreetFight({ loadout: STOCK, rand: still });
    const at = { x: 0, y: 12, z: 10 };
    f.fire(0, cruiser(), at);
    run(f, cruiser(), { at, steps: 30 });
    run(f, cruiser(), { at, steps: 12, from: 1 }); // (its first shot away, at 1.15 s)
    const types = run(f, cruiser(), { at, flying: false, steps: 60, from: 1.2 }).map((e) => e.type);
    expect(f.shield).toBe(FIGHT.shield);
    expect(types).not.toContain('grounded');
  });
});

describe('the street’s fight: the skill tree’s four', () => {
  const ARMS = { arms: ['seismic', 'darkmatter', 'crystal', 'energon'] };
  const armed = (loadout) => createStreetFight({ loadout: { ...STOCK, ...loadout }, fx: ARMS, rand: still });
  it('drops a seismic charge behind, and its ring takes down a patrol on the cruiser’s tail', () => {
    const f = armed({ ordnance: 'seismic' });
    f.pick(2);
    const c = cruiser();
    const tail = { x: 0, y: 12, z: -6 };
    expect(f.fire(0, c, tail)).toBe(true);
    const [b] = f.live();
    expect(b.dir[2]).toBeCloseTo(-1);
    expect(b.pos[2]).toBeLessThan(c.z);
    const types = run(f, c, { at: tail, steps: 120 }).map((e) => e.type);
    expect(types).toContain('down');
  });
  it('leaves a patrol well clear of the ring be', () => {
    const f = armed({ ordnance: 'seismic' });
    f.pick(2);
    f.fire(0, cruiser(), null);
    const types = run(f, cruiser(), { at: { x: 0, y: 12, z: 40 }, steps: 120 }).map((e) => e.type);
    expect(types).not.toContain('down');
    expect(f.patrol.mode).toBe('calm');
  });
  it('bursts the cluster’s round into six shards near the patrol', () => {
    const f = armed({ ordnance: 'crystal' });
    f.pick(2);
    const at = { x: 0, y: 12, z: 20 };
    f.fire(0, cruiser(), at);
    let most = 0;
    for (let i = 0; i < 40; i++) {
      f.step(1 / 60, i / 60, { cruiser: cruiser(), at, flying: true });
      most = Math.max(most, f.live().length);
    }
    expect(most).toBeGreaterThanOrEqual(6);
  });
  it('lands the arc on the patrol at once within the guns’ reach, and crackles out ahead with none', () => {
    const f = armed({ secondary: 'energon' });
    f.pick(1);
    const at = { x: 0, y: 12, z: 15 };
    f.fire(0, cruiser(), at);
    const types = f.step(1 / 60, 0, { cruiser: cruiser(), at, flying: true }).map((e) => e.type);
    expect(types).toContain('provoked');
    expect(f.patrol.hp).toBeCloseTo(PATROL.hp - 2.4);
    const g = armed({ secondary: 'energon' });
    g.pick(1);
    g.fire(0, cruiser(), null);
    expect(g.live()[0].range).toBe(6);
  });
  it('fires the stock line for a unique part whose node isn’t taken', () => {
    const f = createStreetFight({ loadout: { ...STOCK, ordnance: 'seismic' }, rand: still });
    f.pick(2);
    expect(f.armory.id).toBe('heavy');
  });
});
