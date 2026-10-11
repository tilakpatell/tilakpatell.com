import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STANCE_OF, heldRow, restMuzzle } from './bf2017-held.mjs';
import { checkSources } from './bf2017-rulebook.mjs';

const ROOT = join(import.meta.dirname, '..', 'fixtures', 'bf2017', 'data');
const A280C = 'Gameplay/Equipment/Rifles/A280C/W_BlasterRifle_A280C';

describe('the weapon skeleton’s rest', () => {
  it('holds Wep_Muzzle at index 41, 0.58 m up the barrel', () => {
    const r = restMuzzle(ROOT);
    expect(r.index).toBe(41);
    expect(r.at[0]).toBe(0);
    expect(r.at[1]).toBeCloseTo(0.00941, 5);
    expect(r.at[2]).toBeCloseTo(0.57978, 5);
    expect(r.source).toBe('Characters/Rigs/Weapon/WeaponSke01#SkeletonAsset.LocalPose.41.trans');
  });
});

describe('a weapon in the hand (the A280C)', () => {
  const row = heldRow(ROOT, A280C);

  it('names its 3P mesh and id', () => {
    expect(row.id).toBe('a280c');
    expect(row.mesh).toBe('gameplay/equipment/rifles/a280c/a280c_mesh3p_mesh');
    expect(row.mesh_source).toBe(`${A280C}#SoldierWeaponData.WeaponStates.0.Mesh3p`);
  });

  it('puts the muzzle at the rest plus the weapon’s own offset for index 41', () => {
    // rest (0, 0.00941, 0.57978) + Mesh3pTransforms.Transforms[29].trans (0, 0.05573, 0.03328)
    expect(row.muzzle[0]).toBe(0);
    expect(row.muzzle[1]).toBeCloseTo(0.06514, 4);
    expect(row.muzzle[2]).toBeCloseTo(0.61306, 4);
    expect(row.muzzle_source).toBe(`derived: Characters/Rigs/Weapon/WeaponSke01#SkeletonAsset.LocalPose.41.trans + ${A280C}#SoldierWeaponData.WeaponStates.0.Mesh3pTransforms.Transforms.29.trans`);
  });

  it('takes the flash from the modifier no unlock gates (the all-zero GUID)', () => {
    // (the A280C has a second flash behind an unlock, at 0, 0.1, 0.7)
    expect(row.flash[1]).toBeCloseTo(0.06513, 4);
    expect(row.flash[2]).toBeCloseTo(0.61306, 4);
    expect(row.flash_source).toMatch(new RegExp(`^${A280C}#WeaponFiringEffectsModifier\\.FireEffects3p\\.0\\.Offset$`));
  });

  it('maps its animation set to the stance pack', () => {
    expect(row.animSet).toBe('wabsRif');
    expect(row.animSet_source).toBe(`${A280C}#SoldierWeaponData.AnimBaseSet`);
    expect(row.stance).toBe('t');
    expect(STANCE_OF).toEqual({ wabsRif: 't', wabsPstl: 'p', wabsLMG: 'l' });
  });

  it('names a source for every number and misses nothing', () => {
    expect(checkSources({ rows: { a280c: row } })).toEqual([]);
    expect(row._missing).toEqual([]);
  });

  it('says what it lacks rather than guessing', () => {
    const lost = heldRow(ROOT, 'Gameplay/Equipment/Rifles/Nope/W_Nope');
    expect(lost.muzzle).toBeUndefined();
    expect(lost._missing.length).toBeGreaterThan(0);
  });
});
