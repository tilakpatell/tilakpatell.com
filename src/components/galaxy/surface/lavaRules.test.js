import { describe, expect, it } from 'vitest';
import { LAVA, bakeLavaField, burn, heatAt, lavaAt, lavaOf, safeGround } from './lavaRules';
import { siteOf } from './sites';
import { levelled, makeRaw } from './terrain';

// a bank: lava (its floor 3 m under the surface at 0) west of x = 0, dry
// ground a metre up east of it
const bank = (x) => (x < 0 ? -3 : 1);
const sea = { level: 0, pools: [] };

describe('where the lava is', () => {
  it('Mustafar is a world of it, at its water level', () => {
    const lava = lavaOf(siteOf('mustafar'));
    expect(lava.level).toBe(2.5);
    expect(lavaAt(lava, 175, 25)).toBe(2.5);
    expect(lavaAt(lava, -9000, 0)).toBe(2.5);
  });

  it('a world with no lava has none', () => {
    expect(lavaOf(siteOf('tatooine'))).toBeNull();
    expect(lavaOf(siteOf('scarif'))).toBeNull();
  });

  it('a pit with `lava` holds a pool, that far under the land round it', () => {
    const site = { ground: { seed: 3, layers: [{ type: 'swell', scale: 200, height: 6 }], flats: [], pits: [{ at: [40, -20], r: 12, depth: 5, lava: 1.5 }, { at: [0, 0], r: 8, depth: 2 }] } };
    const lava = lavaOf(site);
    expect(lava.level).toBeNull();
    expect(lava.pools).toHaveLength(1);
    const land = levelled(makeRaw(site.ground), site.ground.flats);
    expect(lava.pools[0].level).toBeCloseTo(land(40, -20) - 1.5, 5);
    expect(lavaAt(lava, 45, -20)).toBeCloseTo(lava.pools[0].level, 5);
    expect(lavaAt(lava, 40, -20 + 12.5)).toBeNull();
    expect(lavaAt(lava, 0, 0)).toBeNull();
  });

  it('Nevarro’s lava flats have pools of it now', () => {
    const lava = lavaOf(siteOf('nevarro'));
    const flats = siteOf('nevarro').places.find((p) => p.id === 'lava');
    expect(lava.pools.length).toBeGreaterThanOrEqual(2);
    for (const p of lava.pools) expect(Math.hypot(p.x - flats.at[0], p.z - flats.at[1])).toBeLessThan(flats.r + 20);
  });
});

describe('the heat', () => {
  it('is full in the lava', () => {
    expect(heatAt(sea, bank, -2, -0.8, 0)).toBe(1);
  });

  it('warns on the bank beside it, and fades with distance', () => {
    const close = heatAt(sea, bank, 0.6, 1, 0);
    const further = heatAt(sea, bank, 2, 1, 0);
    expect(close).toBeGreaterThan(0);
    expect(close).toBeLessThan(1);
    expect(further).toBeLessThan(close);
    expect(heatAt(sea, bank, LAVA.near + 1, 1, 0)).toBe(0);
  });

  it('jumping clear over it is not standing in it', () => {
    expect(heatAt(sea, bank, -2, 2.5, 0)).toBeLessThan(1);
  });

  it('none where there is no lava', () => {
    expect(heatAt(null, bank, -2, -0.8, 0)).toBe(0);
  });
});

describe('the burn', () => {
  it('bites at once, then every tick, about LAVA.burn a second', () => {
    let b = burn(null, true, 1 / 60);
    expect(b.damage).toBe(LAVA.bite);
    let total = b.damage;
    for (let t = 1 / 60; t < 1; t += 1 / 60) {
      b = burn(b, true, 1 / 60);
      total += b.damage;
    }
    expect(total).toBeGreaterThanOrEqual(LAVA.burn - LAVA.bite);
    expect(total).toBeLessThanOrEqual(LAVA.burn + LAVA.bite);
  });

  it('stops out of it, and bites at once again going back in', () => {
    let b = burn(null, true, 1 / 60);
    b = burn(b, false, 1 / 60);
    expect(b.damage).toBe(0);
    b = burn(b, true, 1 / 60);
    expect(b.damage).toBe(LAVA.bite);
  });
});

describe('the last safe ground', () => {
  it('is kept while you stand away from the heat', () => {
    const p = { x: 4, z: 9, grounded: true };
    expect(safeGround(null, p, 0)).toEqual([4, 9]);
    expect(safeGround([1, 1], { ...p, grounded: false }, 0)).toEqual([1, 1]);
    expect(safeGround([1, 1], p, 0.4)).toEqual([1, 1]);
  });
});

describe('the lava field (what the lava and the ground draw from)', () => {
  const field = (n = 32) => bakeLavaField((x) => (x < 0 ? -3 : 1), (x, z) => lavaAt(sea, x, z), { half: 32, n, max: 6, reach: 8 });

  it('is the depth under the lava where it is, and nothing on the dry side', () => {
    const f = field();
    expect(f.depthAt(-10, 0)).toBeCloseTo(3, 1);
    expect(f.depthAt(10, 0)).toBe(0);
  });

  it('on the dry side, how far it is to the lava, out to its reach', () => {
    const f = field();
    expect(f.nearAt(-10, 0)).toBe(0);
    expect(f.nearAt(3, 0)).toBeGreaterThan(1.5);
    expect(f.nearAt(3, 0)).toBeLessThan(4.5);
    expect(f.nearAt(20, 0)).toBe(8);
  });

  it('packs both into one picture, two bytes a texel', () => {
    const f = field(16);
    expect(f.rg).toHaveLength(16 * 16 * 2);
  });

  it('with no lava anywhere, all dry and far', () => {
    const f = bakeLavaField(() => 0, () => null, { half: 32, n: 8, max: 6, reach: 8 });
    expect(f.depthAt(0, 0)).toBe(0);
    expect(f.nearAt(0, 0)).toBe(8);
  });
});
