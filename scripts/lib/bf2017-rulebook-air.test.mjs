// The air rulebook on fixtures of the X-wing T-65 (its blueprint trimmed to
// its health, mesh, cannon and locking components, its _Handling and
// _Weapons layers, its bolts, its kit, the proton torpedo) and the sequel's
// T-70, refused. No export needed.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { airRulebook, curveOf, refusedAir } from './bf2017-rulebook-air.mjs';
import { checkSources } from './bf2017-rulebook.mjs';

const ROOT = join(import.meta.dirname, '..', 'fixtures', 'bf2017', 'air');
const air = airRulebook(ROOT);
const x = air.vehicles.xwing_t65;

describe('the air rulebook', () => {
  it("holds the X-wing's handling as its layer has it", () => {
    expect(x.handling.maxSpeed).toBe(100);
    expect(x.handling.boostMaxSpeed).toBe(115);
    expect(x.handling.engineAccelerationRate).toBe(32.5);
    expect(x.handling.boostEngineAccelerationRate).toBe(60);
    expect(x.handling.rollTorque).toBe(-31500);
    expect(x.handling.axisTurnRates).toEqual([110, 100, 190]);
    expect(x.handling.axisTurnRatesZoomed).toEqual([82.5, 75, 142.5]);
    expect(x.handling.targetFakeRollAngle).toBe(32);
    // (three configs, differing in their minimum speed alone)
    expect(x.handling.configs).toBe(3);
    expect(x.handling.minSpeeds.sort()).toEqual([55, 65]);
  });

  it('resolves the turn-rate-by-speed curve to its points', () => {
    const c = x.handling.turnRateBySpeedCurve;
    expect(c.points.map(([px, py]) => [px, py])).toEqual([
      [0, 1],
      [0.5, 1],
      [1, 0.85],
    ]);
    expect(c.kinds).toEqual(['smooth', 'smooth', 'smooth']);
    expect(curveOf(null)).toBe(null);
  });

  it("reads the cannon's rate, bolt and heat", () => {
    expect(x.weapons.rateOfFire).toBe(480);
    expect(x.weapons.bolt).toMatchObject({ projectile: 'Projectile_Xwing', speed: 2000, damage: 75, damageFar: 65, falloff: [400, 600] });
    expect(x.weapons.overheat).toMatchObject({ perShot: 0.034, dropPerSecond: 0.3 });
    expect(x.weapons.overcharged.by).toBe('U_Vehicle_Ability_WeaponOvercharge');
  });

  it('reads its health, its lock and its abilities from the kit', () => {
    expect(x.health.max).toBe(1200);
    expect(x.targeting.radius).toBe(4.2);
    expect(x.class).toBe('fighter');
    const torpedo = x.abilities.find((a) => a.id === 'VehicleWeaponAbility_ProtonTorpedo');
    expect(torpedo).toMatchObject({ kind: 'vehicleweapon', slot: 'right', recharge: 15, betweenShots: 0.2, shots: 1 });
    expect(torpedo.lock.time).toBe(1);
  });

  it("lists the light side's Original-era kit and the Empire's pilots", () => {
    expect(air.kits.orig.light).toEqual(['xwing_t65']);
    expect(air.names.empire[0]).toBe('TK-772');
  });

  it("refuses the sequel's ships", () => {
    expect(air.vehicles.xwing_t70).toBeUndefined();
    expect(air.refused).toContain('xwing_t70');
    for (const n of ['Gameplay/Vehicles/Air/AWingRZ3/Vehicle_Air_AWingRZ3', 'Gameplay/Vehicles/Air/TieInterceptor_Hask/Vehicle_Air_TieInterceptor_Hask', 'Gameplay/Vehicles/Air/MillenniumFalcon_NT/Vehicle_Air_MillenniumFalcon_NT', 'S1/Gameplay/Vehicles/Air/IdensTIE/Vehicle_Air_IdensTIE']) expect(refusedAir(n)).toBe(true);
    expect(refusedAir('Gameplay/Vehicles/Air/XWing_T65/Vehicle_Air_XWing_T65')).toBe(false);
  });

  it('names a record for every number', () => {
    expect(checkSources(air)).toEqual([]);
  });
});
