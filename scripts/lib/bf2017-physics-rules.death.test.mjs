// The death's rulebooks (the Battlefront world's ragdolls): a weapon's hit
// impulse from its projectile, and a soldier blueprint's corpse time.
import { describe, expect, it } from 'vitest';
import { checkSources, deathRow, impulseRows } from './bf2017-physics-rules.mjs';

const RIFLE = 'Gameplay/Equipment/Rifles/_DefaultWeapon/BlasterProjectile_Default_Rifle';
const BOW = 'Gameplay/Equipment/Shared/Projectiles/BlasterProjectile_Bowcaster';

describe('impulseRows', () => {
  const weapons = { rows: { e11: { id: 'e11', damage: { projectile: RIFLE } }, chewbacca: { id: 'chewbacca', damage: { projectile: BOW } }, bowv2: { id: 'bowv2', damage: {} }, ghost: { id: 'ghost', damage: { projectile: 'Gameplay/Nowhere' } } } };
  const projectiles = {
    rows: [
      { id: 'blasterprojectile_default_rifle', name: RIFLE.toLowerCase(), impactImpulse: 50, impactImpulse_source: '#WSBulletEntityData.ImpactImpulse' },
      { id: 'blasterprojectile_bowcaster', name: BOW, impactImpulse: 46, impactImpulse_source: '#WSBulletEntityData.ImpactImpulse' },
    ],
  };
  const book = impulseRows(weapons, projectiles);

  it('gives each weapon its projectile’s impact impulse, with the record it came from', () => {
    expect(book.rows.e11).toEqual({ impulse: 50, impulse_source: `${RIFLE.toLowerCase()}#WSBulletEntityData.ImpactImpulse` });
    expect(book.rows.chewbacca.impulse).toBe(46);
  });

  it('leaves out a weapon with no projectile, or one the export lacks', () => {
    expect(book.rows.bowv2).toBeUndefined();
    expect(book.rows.ghost).toBeUndefined();
    expect(book.missing).toEqual(['bowv2', 'ghost']);
  });

  it('keeps the default rifle’s as the fallback, every number sourced', () => {
    expect(book.fallback.impulse).toBe(50);
    expect(checkSources({ rows: book.rows, fallback: book.fallback })).toEqual([]);
  });
});

describe('deathRow', () => {
  const asset = (name, health) => ({ name, root: 0, objects: [{ $type: 'SoldierBlueprint' }, { $type: 'WSSoldierHealthComponentData', ...health }] });

  it('reads the trooper’s corpse time and its dying state from the health component', () => {
    const row = deathRow(asset('Gameplay/Characters/StormTrooperShared', { TimeForCorpse: 10, SkipDyingState: true, DyingMaxTimeInAir: 5, RemainDyingInAir: false }));
    expect(row).toMatchObject({ id: 'stormtroopershared', timeForCorpse: 10, skipDyingState: true, dyingMaxTimeInAir: 5, remainDyingInAir: false });
    expect(row.timeForCorpse_source).toBe('Gameplay/Characters/StormTrooperShared#WSSoldierHealthComponentData.TimeForCorpse');
    expect(checkSources(row)).toEqual([]);
  });

  it('gives nothing for a blueprint with no health component', () => {
    expect(deathRow({ name: 'X', root: 0, objects: [{ $type: 'SoldierBlueprint' }] })).toBe(null);
  });
});
