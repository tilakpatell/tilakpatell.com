import { describe, expect, it } from 'vitest';
import air from '../../data/bf2017/air.json';
import { createAbilities, createGuns, damageAt } from './fighterWeapons';

const X = air.vehicles.xwing_t65;

describe("a starfighter's guns", () => {
  it('fires at its rate of fire', () => {
    const guns = createGuns(X);
    let shots = 0;
    for (let t = 0; t < 1; t += 1 / 60) shots += guns.fire(1 / 60, true);
    // (480 a minute: 8 a second, the first on the trigger)
    expect(shots).toBeGreaterThanOrEqual(8);
    expect(shots).toBeLessThanOrEqual(9);
  });

  it('heats by its bolts, overheats, and cools only when it stops', () => {
    const guns = createGuns(X);
    let shots = 0;
    for (let t = 0; t < 10 && !guns.overheated; t += 1 / 60) shots += guns.fire(1 / 60, true);
    expect(guns.overheated).toBe(true);
    expect(shots).toBe(Math.ceil(1 / X.weapons.overheat.perShot));
    expect(guns.fire(1 / 60, true)).toBe(0);
    for (let t = 0; t < 10 && guns.overheated; t += 1 / 60) guns.fire(1 / 60, false);
    expect(guns.overheated).toBe(false);
  });

  it('fires the overcharged bolt while charged', () => {
    const guns = createGuns(X);
    expect(guns.bolt.projectile).toBe('Projectile_Xwing');
    guns.charged(true);
    expect(guns.bolt.projectile).toBe(X.weapons.overcharged.projectile);
  });

  it('falls off with distance', () => {
    const b = X.weapons.bolt;
    expect(damageAt(b, 10)).toBe(75);
    expect(damageAt(b, 500)).toBe(70);
    expect(damageAt(b, 900)).toBe(65);
  });
});

describe("a starfighter's abilities", () => {
  it('recharges after use, on its record’s times', () => {
    const ab = createAbilities(X);
    const id = 'Ability_WeaponOvercharge';
    expect(ab.use(id)).toBe(true);
    expect(ab.active(id)).toBe(true);
    expect(ab.use(id)).toBe(false);
    for (let t = 0; t < 5.01; t += 0.01) ab.step(0.01);
    expect(ab.active(id)).toBe(false);
    for (let t = 0; t < 20.02; t += 0.01) ab.step(0.01);
    expect(ab.ready(id)).toBe(true);
  });
});
