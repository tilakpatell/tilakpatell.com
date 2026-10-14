import { describe, expect, it } from 'vitest';
import { DISABLED, IMMOBILE, OUT_CONE, OUT_RANGE, kitOfUnit, outputOf, specOf, unitRow, unitWeapon } from './abilitiesUnit.js';

describe('the unit abilities from their records', () => {
  it('reads Luke’s push: the 30° cone and 12 m its outputs give, 90 to a hero and 150 to a trooper, the shove', () => {
    const p = specOf('Ability_Luke_ForcePush');
    expect(outputOf('Ability_Luke_ForcePush', OUT_CONE)).toBe(30);
    expect(outputOf('Ability_Luke_ForcePush', OUT_RANGE)).toBe(12);
    expect(p).toMatchObject({ kind: 'push', range: 12, cone: 30 });
    const dmg = p.targets.filter((e) => e.type === 'damage');
    expect(dmg.map((e) => [e.vs, e.damage])).toEqual([
      ['hero', 90],
      ['trooper', 150],
    ]);
    // (the least band's shove: ForcePushed_10m, ImpulseMultiplier 1)
    expect(p.targets.find((e) => e.type === 'shove')).toMatchObject({ name: 'Affector_ForcePushed_10m', impulse: 1, pull: false });
  });

  it('reads Vader’s choke: 86 a second for its 1.5 s grip on the one in front, and his own 0.8 of the damage while he holds it', () => {
    const c = specOf('Ability_DarthVader_ForceChoke_02');
    expect(c).toMatchObject({ kind: 'choke', range: 12, cone: 35 });
    expect(c.targets.find((e) => e.type === 'damage')).toMatchObject({ damage: 1, perSecond: 86, duration: 1.5 });
    expect(c.targets.find((e) => e.name === 'Affector_ForceChokeHold_Vader')).toMatchObject({ type: 'tag', disabled: true, immobile: true });
    expect(c.self.find((e) => e.type === 'taken')).toMatchObject({ multiplier: 0.8, whileActive: true });
    expect([DISABLED, IMMOBILE]).toEqual([980125368, 1544269865]);
  });

  it('reads the rage, the barrier and the slam’s own numbers', () => {
    const rage = specOf('Ability_Vader_FocusRage');
    expect(rage.self.find((e) => e.type === 'shield')).toMatchObject({ start: 200, drainAfter: 10 });
    expect(rage.self.find((e) => e.type === 'taken').multiplier).toBe(0.92);
    const barrier = specOf('Ability_Yoda_ForceBarrier');
    // (150 on Yoda, 70 on the troopers round him: Affector_ForceBarrierHealth_Yoda and _Trooper)
    expect(barrier.self.find((e) => e.type === 'shield')).toMatchObject({ start: 150 });
    expect(barrier.targets.filter((e) => e.type === 'shield').map((e) => e.start)).toContain(70);
    const slam = specOf('Ability_WookieeWarrior_Slam');
    expect(slam.targets.find((e) => e.type === 'damage').damage).toBe(75);
    expect(slam.self.find((e) => e.type === 'heal').perSecond).toBe(50);
  });

  it('gives each hero and reinforcement its kit, and each weapon ability its gun', () => {
    expect(kitOfUnit('luke')).toMatchObject({ unit: 'hero', primary: null, abilities: ['Ability_Luke_ForcePush', 'Ability_Luke_ForceRepulse', 'Ability_Luke_Dash'] });
    expect(kitOfUnit('emperor').fire).toBe('Ability_Emperor_ForceLightning');
    expect(kitOfUnit('JumpTrooper').primary).toBe('e11');
    const sharp = specOf('Ability_HanSolo_Sharpshooterz');
    expect(unitWeapon(sharp.weapon)?.firing?.rof).toBeGreaterThan(0);
    expect(unitRow({ id: 'Ability_Luke_Dash' }).unit.kind).toBe('rush');
    expect(unitRow({ id: 'nothing' })).toEqual({ id: 'nothing' });
  });
});
