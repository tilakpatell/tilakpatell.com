import { describe, expect, it } from 'vitest';
import DAMAGE from '../../data/bf2017/damage.json';
import {
  blastDamage,
  boltDamage,
  capitalSite,
  hitDamage,
  kindDamage,
  multiplier,
  partHit,
  partsHealth,
  rammed,
  spend,
  turretOf,
  vehicleDamage,
} from './damage';

const xwing = DAMAGE.fighters.xwing;
const xwingBolt = xwing.bolt;
const tieBolt = DAMAGE.fighters.tie.bolt;
const heavy = DAMAGE.capitals.destroyer.turrets.StarDestroyer_HeavyTurboLaser_02.bolts.find((b) => b.property === 61);
const cr90 = DAMAGE.capitals.corvette.parts['corvettecr90_01#0'];
// the hull's part a bolt met, as hullOf gives it ({ name, property })
const cr90Hull = { name: 'corvettecr90_01#0', property: 206 };
// a bolt of the game's kind with a damage of the test's choosing
const boltOf = (damage, property = 216) => ({ damage, damageFar: damage, falloff: [0, 0], property });

describe('a bolt’s falloff', () => {
  it('is its damage near, falling to its far damage across the falloff, and the far damage beyond', () => {
    expect(boltDamage(xwingBolt, 300)).toBe(75);
    expect(boltDamage(xwingBolt, 500)).toBe(70);
    expect(boltDamage(xwingBolt, 700)).toBe(65);
    expect(boltDamage(xwingBolt, 400)).toBe(75);
    expect(boltDamage(xwingBolt, 600)).toBe(65);
  });

  it('takes a falloff of no length (the CR90’s large turret, 100 at any range)', () => {
    const large = DAMAGE.capitals.corvette.turrets.CorvetteCR90_LargeTurretTop.bolts[0];
    expect(large.falloff).toEqual([0, 0]);
    expect(boltDamage(large, 0)).toBe(100);
    expect(boltDamage(large, 900)).toBe(100);
  });
});

describe('the material grid', () => {
  it('is the cell of the attacker’s row and the target’s column', () => {
    expect(multiplier(216, 68)).toMatchObject({ multiplier: 1.25, threshold: 0 });
    expect(multiplier(61, 68)).toMatchObject({ multiplier: 4, threshold: 0 });
    expect(multiplier(216, 206)).toMatchObject({ multiplier: 0.01, threshold: 0.02 });
  });

  it('gives a pair with no relation the (default, default) cell, 0× under 2, not 1×', () => {
    for (const [a, t] of [[216, 34], [216, 999], [999, 68], [216, undefined]]) {
      expect(multiplier(a, t)).toMatchObject({ multiplier: 0, threshold: 2 });
    }
    expect(multiplier(216, 999)).toBe(DAMAGE.noRelation);
  });
});

describe('a bolt’s hit', () => {
  it('is the falloff damage × the cell’s multiplier', () => {
    expect(hitDamage(xwingBolt, 300, 68)).toBe(93.75);
    expect(hitDamage(xwingBolt, 300, 206)).toBeCloseTo(0.75, 12);
  });

  it('does nothing where the product falls under the threshold', () => {
    expect(hitDamage(xwingBolt, 300, 132)).toBe(0);
    expect(hitDamage(boltOf(1), 0, 206)).toBe(0); // 0.01 < 0.02
    expect(hitDamage(boltOf(2), 0, 206)).toBe(0.02); // at the threshold: applied
  });

  it('takes a heavy turbolaser on a fighter ×4', () => {
    expect(heavy.damage).toBe(200);
    expect(hitDamage(heavy, 0, 68)).toBe(4 * boltDamage(heavy, 0));
    expect(hitDamage(heavy, 0, 68)).toBe(800);
  });
});

describe('a vehicle’s loss', () => {
  it('is the bolt against its own pair’s property × the vehicle damage modifier', () => {
    expect(vehicleDamage(DAMAGE.fighters.tie, xwingBolt, 300)).toBe(93.75);
    expect(vehicleDamage(xwing, tieBolt, 300)).toBe(81.25);
  });

  it('takes a turret the same way (the CR90’s turret, p129: 75)', () => {
    expect(vehicleDamage(DAMAGE.capitals.corvette.turrets.CorvetteCR90_LargeTurretTop, xwingBolt, 300)).toBe(75);
  });

  it('is × the friendly damage modifier (0) for a friend’s bolt, friendly fire off', () => {
    expect(vehicleDamage(xwing, tieBolt, 300, true)).toBe(0);
    expect(vehicleDamage(DAMAGE.capitals.corvette.turrets.CorvetteCR90_LargeTurretTop, xwingBolt, 300, true)).toBe(0);
  });

  it('reads the difficulty’s modifiers from the one row every fighter carries', () => {
    const rows = Object.values(DAMAGE.fighters);
    expect(new Set(rows.map((f) => f.vehicleDamageModifier_source)).size).toBe(1);
    expect(new Set(rows.map((f) => f.friendlyDamageModifier_source)).size).toBe(1);
  });
});

describe('a blast', () => {
  const blast = xwingBolt.blast;

  it('reaches a vehicle as its record’s damage, with no grid multiplier', () => {
    expect(blastDamage(blast)).toBe(22.5);
  });

  it('is held to the grid on its own property where the caller asks (a static model, unread)', () => {
    expect(blastDamage(blast, 206)).toBeCloseTo(0.225, 12); // p116 on p206: 0.01× under 0.02
    expect(blastDamage(blast, 132)).toBe(0); // p116 on p132: 0× under 2
  });
});

describe('a ram', () => {
  it('is 25 against an enemy under 65°, and a sixth of it past', () => {
    expect(rammed(xwing.ram, 30, false)).toBe(25);
    expect(rammed(xwing.ram, 80, false)).toBe(25 / 6);
  });

  it('is 20 against a friend, and a sixth of that past', () => {
    expect(rammed(xwing.ram, 0, true)).toBe(20);
    expect(rammed(xwing.ram, 89, true)).toBe(20 / 6);
  });
});

describe('a part’s health chain', () => {
  it('starts at the first state’s health, the later states’ its floors', () => {
    expect(partsHealth([500, 1, 0])).toEqual({ hp: 500, stage: 0, floors: [1, 0] });
  });

  it('spends the CR90’s 500, then floors at 1', () => {
    let s = spend(partsHealth([500, 1, 0]), 200);
    expect(s).toMatchObject({ hp: 300, stage: 0 });
    s = spend(s, 299);
    expect(s).toMatchObject({ hp: 1, stage: 1 });
    s = spend(s, 0.5);
    expect(s).toMatchObject({ hp: 0.5, stage: 1 });
    s = spend(s, 1);
    expect(s).toMatchObject({ hp: 0, stage: 2 });
  });

  it('carries the rest of a hit past a floor on to the next state', () => {
    expect(spend(partsHealth([500, 1, 0]), 600)).toMatchObject({ hp: 0, stage: 2 });
    expect(spend({ hp: 1.5, stage: 0, floors: [1, 0] }, 1)).toMatchObject({ hp: 0.5, stage: 1 });
  });

  it('drops a rest under the threshold, and scales a rest it carries again', () => {
    const at = (hp) => ({ hp, stage: 0, floors: [1, 0] });
    expect(spend(at(1.74), 0.75, 0.02)).toMatchObject({ hp: 1, stage: 1 }); // the rest, 0.01, dropped
    const carried = spend(at(1.7), 0.75, 0.02); // the rest, 0.05, carried
    expect(carried.stage).toBe(1);
    expect(carried.hp).toBeCloseTo(0.95, 12);
    expect(spend(at(1.5), 1, 0, 1.02).hp).toBeCloseTo(1 - 0.5 * 1.02, 12);
  });

  it('falls to 0 in the last state and no further', () => {
    expect(spend(partsHealth([100]), 150)).toMatchObject({ hp: 0, stage: 0 });
    expect(spend(partsHealth([5000, 0]), 6000)).toMatchObject({ hp: 0, stage: 1 });
  });

  it('leaves the state it is given as it was', () => {
    const s = partsHealth([500, 1, 0]);
    spend(s, 600);
    expect(s).toEqual({ hp: 500, stage: 0, floors: [1, 0] });
  });
});

describe('a bolt on a capital’s part', () => {
  it('spends the CR90’s hull by the grid: 0.75 an X-wing bolt on p206', () => {
    const s = partHit(cr90, partsHealth(cr90.health), cr90Hull, xwingBolt, 300);
    expect(s.stage).toBe(0);
    expect(s.hp).toBeCloseTo(499.25, 12);
  });

  it('holds the CR90’s hull at 1 and drops a rest under 0.02, the threshold checked again', () => {
    const s = partHit(cr90, { hp: 1.74, stage: 0, floors: [1, 0] }, cr90Hull, xwingBolt, 300);
    expect(s).toMatchObject({ hp: 1, stage: 1 });
    const t = partHit(cr90, { hp: 1.7, stage: 0, floors: [1, 0] }, cr90Hull, xwingBolt, 300);
    expect(t.stage).toBe(1);
    expect(t.hp).toBeCloseTo(0.95, 12);
  });

  it('wrecks it at 0, and a hit on the wreck does nothing', () => {
    const s = partHit(cr90, { hp: 0.5, stage: 1, floors: [1, 0] }, cr90Hull, xwingBolt, 300);
    expect(s).toMatchObject({ hp: 0, stage: 2 });
    expect(partHit(cr90, s, cr90Hull, xwingBolt, 300)).toBe(s);
  });

  it('takes the squad bonus where the part is linked, one mate at most', () => {
    const s0 = partsHealth(cr90.health);
    expect(partHit(cr90, s0, cr90Hull, xwingBolt, 300, 1).hp).toBeCloseTo(500 - 0.75 * 1.02, 12);
    expect(partHit(cr90, s0, cr90Hull, xwingBolt, 300, 3).hp).toBeCloseTo(500 - 0.75 * 1.02, 12);
    const unlinked = DAMAGE.capitals.destroyer.parts['stardestroyer_tractorbeam_01#0'];
    const beam = { name: 'stardestroyer_tractorbeam_01#0', property: 129 };
    expect(partHit(unlinked, partsHealth(unlinked.health), beam, xwingBolt, 300, 1).hp).toBe(2000 - 75);
  });

  it('does nothing on a part its state does not name', () => {
    const s = partsHealth(cr90.health);
    expect(partHit(cr90, s, { name: 'corvettecr90_01#1', property: 206 }, xwingBolt, 300)).toBe(s);
    const tower = DAMAGE.capitals.destroyer.parts['stardestroyer_communicationstower_01#0'];
    const broken = { hp: 0, stage: 1, floors: [0] };
    expect(partHit(tower, broken, { name: 'stardestroyer_communicationstower_01#0', property: 129 }, heavy, 0)).toBe(broken);
  });

  it('does nothing on p132, 0× under 2', () => {
    const hull = DAMAGE.capitals.destroyer.parts['stardestroyer_hull_01_sb_endor#1'];
    const s = partsHealth(hull.health);
    expect(partHit(hull, s, { name: 'stardestroyer_hull_01_sb_endor#1', property: 132 }, heavy, 0)).toBe(s);
  });

  it('takes no friend’s bolt unless the part has friendly fire', () => {
    const s = partsHealth(cr90.health);
    expect(partHit(cr90, s, cr90Hull, xwingBolt, 300, 0, true)).toBe(s);
    const tower = DAMAGE.capitals.venator.parts['venatorstardestroyer_controltower_left#0'];
    expect(tower.friendlyFire).toBe(true);
    const at = { name: 'venatorstardestroyer_controltower_left#0', property: 206 };
    expect(partHit(tower, partsHealth(tower.health), at, xwingBolt, 300, 0, true).hp).toBeCloseTo(499.25, 12);
  });
});

describe('a kind’s rows', () => {
  it('is the game’s own row for a kind the game had', () => {
    expect(kindDamage('xwing')).toBe(xwing);
    expect(kindDamage('interceptor')).toBe(DAMAGE.fighters.interceptor);
    expect(kindDamage('corvette')).toBe(DAMAGE.capitals.corvette);
  });

  it('is the stand-in’s row for a kind the game never had', () => {
    expect(DAMAGE.stand.bwing.as).toBe('ywing');
    expect(kindDamage('bwing')).toBe(DAMAGE.fighters.ywing);
    expect(kindDamage('executor')).toBe(DAMAGE.capitals.destroyer);
  });

  it('is null for a kind with no damage (the Death Star) or none known', () => {
    expect(kindDamage('deathstar')).toBeNull();
    expect(kindDamage('nothing')).toBeNull();
  });

  it('finds a capital’s site entry and a turret part’s turret, through the stand-in', () => {
    expect(capitalSite('corvette', 'hull').parts).toContain('corvettecr90_01#0');
    expect(capitalSite('executor', 'reactor')).toBe(DAMAGE.capitals.destroyer.site.reactor);
    expect(capitalSite('corvette', 'nothing')).toBeNull();
    expect(capitalSite('xwing', 'hull')).toBeNull();
    expect(turretOf('destroyer', 'stardestroyer_heavyturbolaser_01#2')).toBe(
      DAMAGE.capitals.destroyer.turrets.StarDestroyer_HeavyTurboLaser_02,
    );
    expect(turretOf('corvette', 'corvettecr90_01#0')).toBeNull();
  });
});
