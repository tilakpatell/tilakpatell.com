import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { abilityRow, cardRow, checkSources, classRow, heroRow, kitRow, reinforcementRow, teamRow, vehicleRow, weaponRow } from './bf2017-rulebook.mjs';

const ROOT = join(import.meta.dirname, '..', 'fixtures', 'bf2017', 'data');
const A280C = 'Gameplay/Equipment/Rifles/A280C/Ability_Weapon_BlasterRifle_A280C';

// A copy of the fixtures with one record changed, for the broken-chain cases.
function rootWith(name, edit) {
  const dir = mkdtempSync(join(tmpdir(), 'bf2017-'));
  cpSync(ROOT, dir, { recursive: true });
  const file = join(dir, 'data', `${name}.json`);
  writeFileSync(file, JSON.stringify(edit(JSON.parse(readFileSync(file, 'utf8')))));
  return dir;
}

describe('the weapon row', () => {
  const w = weaponRow(ROOT, A280C);

  it('reads the A280C from ability to projectile', () => {
    expect(w.id).toBe('a280c');
    expect(w.name).toBe('ID_W_A280C');
    expect(w.family).toBe('rifle');
    expect(w.firing).toMatchObject({ rof: 600, burst: 3, burstsPerMinute: 110, speed: 700, bulletsPerShot: 1, deploy: 0.8 });
    expect(w.firing.charge).toBeUndefined();
    expect(w.firing.rof_source).toMatch(/#FiringFunctionData\.FireLogic\.RateOfFire$/);
    expect(w.ammo).toBeUndefined();
  });

  it('reads the heat and the active cooling', () => {
    expect(w.heat).toMatchObject({ perBullet: 0.03334, dropPerSecond: 0.3, dropDelay: 5, threshold: 0.8, penalty: 3, overheatedDrop: 1.5, warning: 0.7 });
    expect(w.heat.perBullet_source).toMatch(/W_BlasterRifle_A280C#WeaponOverheatModifier\.HeatPerBullet$/);
    expect(w.heat.cooling).toMatchObject({ window: [0.8, 0.65], shrink: 1, reset: -100, successPenalty: 0.2, failurePenalty: 0.3, minHeat: 0.1, vent: 1, super: [0.4, 0.3] });
  });

  it('reads damage from the bolt', () => {
    expect(w.damage).toMatchObject({ start: 33, end: 19, startDistance: 20, endDistance: 40, min: 1, max: 1 });
    expect(w.damage.start_source).toMatch(/BlasterProjectile_BlasterRifle_A295#WSBulletEntityData\.StartDamage$/);
    expect(w.colour).toBe('red');
  });

  it('reads dispersion by stance, recoil, zoom and range', () => {
    expect(w.dispersion[0]).toMatchObject({ stance: 'stand', min: 0, max: 0.8, perShot: 0.08, decay: 1, noFireDelay: 0.2 });
    expect(w.dispersion[3].min).toBe(0.5);
    expect(w.dispersion).toHaveLength(8);
    expect(w.recoil).toMatchObject({ spring: 3000, damping: 0.84 });
    expect(w.zoom[0].fov).toBeGreaterThan(0);
    expect(w.range).toBe(200);
    expect(w._missing).toEqual([]);
  });

  it('names every number’s source', () => {
    expect(checkSources(w)).toEqual([]);
    expect(checkSources({ a: 1, b: { c: 2, c_source: 'Gameplay/X#T.c' }, d: { source: 'hand', e: 3 } })).toEqual(['a']);
    expect(checkSources({ list: [1, 2], list_source: 'Gameplay/X#T.list', rows: [{ _source: 'Gameplay/Y#T', n: 1 }] })).toEqual([]);
  });

  it('a weapon whose projectile is missing still has its firing row', () => {
    const root = rootWith('Gameplay/Equipment/Rifles/A280C/WeaponFiring_A280C', (a) => {
      a.objects[1].Shot.ProjectileData.$asset = 'Gameplay/Equipment/Shared/Projectiles/Nope';
      return a;
    });
    const broken = weaponRow(root, A280C);
    expect(broken.firing.rof).toBe(600);
    expect(broken.damage).toBeUndefined();
    expect(broken._missing).toHaveLength(1);
    expect(broken._missing[0]).toContain('Nope');
    expect(checkSources(broken)).toEqual([]);
  });

  it('a weapon that is not there is null', () => {
    expect(weaponRow(ROOT, 'Gameplay/Equipment/Rifles/Nope/Ability_Weapon_Nope')).toBeNull();
  });
});

describe('abilities, cards and classes', () => {
  it('reads Force Choke, its card ranks among its modifiers', () => {
    const a = abilityRow(ROOT, 'Gameplay/Kits/Hero/DarthVader/Ability_DarthVader_ForceChoke_02');
    expect(a).toMatchObject({ id: 'Ability_DarthVader_ForceChoke_02', kind: 'active', slot: 'right', recharge: 25, active: 1.5, activation: 0.1 });
    expect(a.ranks.length).toBeGreaterThanOrEqual(1);
    expect(a.ranks.flatMap((r) => r.modifiers).some((m) => m.property === 'ActiveTime' && m.value === 2.1)).toBe(true);
    expect(checkSources(a)).toEqual([]);
  });

  it('reads the combat roll as a state with a cost', () => {
    const a = abilityRow(ROOT, 'Gameplay/Kits/MP/Assault/Ability_Assault_CombatRoll_CharacterState');
    expect(a).toMatchObject({ kind: 'state', cost: 0.5, recharge: 4, active: 0.1 });
    expect(a.ranks.map((r) => r.level)).toEqual([1, 2, 3, 4]);
    expect(a.ranks[0].modifiers.map((m) => m.value)).toContain(0.95);
  });

  it('reads a star card', () => {
    const c = cardRow(ROOT, 'Gameplay/Equipment/Abilities/Ability_AssaultTraining/SC_Trooper_01_AssaultTraining');
    expect(c).toMatchObject({ id: 'SC_Trooper_01_AssaultTraining', kind: 'passive' });
    expect(c.ranks.length).toBeGreaterThan(0);
  });

  it('reads the Rebel assault class on Hoth', () => {
    const c = classRow(ROOT, 'Assault', 'Orig', 'L');
    expect(c.name).toContain('ID_C_ASSAULT_TROOPER');
    expect(c).toMatchObject({ id: 'l-orig-assault', cls: 'assault', era: 'Orig', faction: 'L', health: 150, regen: { rate: 30, delay: 6 }, weapon: 'a280' });
    expect(c.weapon_source).toContain('DefaultWeapon_L_Assault_Orig');
    expect(c.abilities.map((a) => a.slot)).toEqual(['left', 'middle', 'right']);
    expect(c.abilities[0].id).toBe('DefaultAbility_Assault_ThermalDetonator');
    expect(c.cards).toContain('SC_Trooper_01_AssaultTraining');
    expect(c.weapons).toContain('a280c');
    expect(c.kits).toEqual(['Kit_L_Assault_Orig_HO']);
    expect(checkSources(c)).toEqual([]);
  });
});

describe('a blaster hero’s ability, with what it does', () => {
  const HAN = 'Gameplay/Kits/Hero/HanSolo/';

  it('reads the Detonite Charge’s blast from its projectile, each number with its record', () => {
    const a = abilityRow(ROOT, `${HAN}Ability_HanSolo_DemolitionGrenade`);
    expect(a).toMatchObject({ kind: 'weapon', slot: 'left', activation: 0.4, recharge: 18 });
    expect(a.effect).toMatchObject({ kind: 'charge', damage: 200, inner: 5, radius: 10, impulse: 5000, gravity: -14, speed: 12, retrigger: 0.3, _missing: [] });
    expect(a.effect.damage_source).toBe(`${HAN}HanSolo_DetonateGrenade_Projectile#ExplosionEntityData.BlastDamage`);
    expect(checkSources(a)).toEqual([]);
  });

  it('reads Shoulder Charge from its prefab and its affectors: the reach, the damage to a trooper and a hero, the push, the damage taken by card rank', () => {
    const e = abilityRow(ROOT, `${HAN}Ability_HanSolo_ShoulderCharges`).effect;
    expect(e).toMatchObject({ kind: 'dash', reach: 1, damage: { trooper: 200, hero: 150 }, held: 3, knock: 3, taken: 0.75, takenByRank: [0.75, 0.7, 0.65, 0.6], _missing: [] });
    // (one of the prefab's four affector applies: the source says which)
    expect(e.held_source).toMatch(/PF_ShoulderCharge_HanSolo#AffectorApplyEntityData(\[\d\])?\.Duration$/);
    expect(e.knock_source).toBe('derived: the name of Gameplay/Prefabs/Affectors/CharacterState/Affector_ForcePushed_3m');
    expect(e.takenByRank_source).toContain('Affector_HanSolo_SharpshooterDMGReduction1#DamageMultiplierAffectorAsset.RankData.{0..3}.DamageMultiplier');
    expect(checkSources(e)).toEqual([]);
  });

  it('reads Sharpshooter’s weapon whole, its heat from the config its blueprint keeps in itself', () => {
    const e = abilityRow(ROOT, `${HAN}Ability_HanSolo_Sharpshooterz`).effect;
    expect(e.kind).toBe('weaponSwap');
    expect(e.weapon).toMatchObject({ id: 'W_Pistol_DL44_HanSolo_Sharpshooterz', firing: { rof: 350, mode: 'automatic' }, damage: { start: 65, end: 40, startDistance: 15, endDistance: 35 } });
    expect(e.weapon.heat).toMatchObject({ perBullet: 0.08, risePerSecond: 0.04, dropPerSecond: 0, dropDelay: 0.7, threshold: 0.8 });
    expect(e.weapon.heat.perBullet_source).toBe('Gameplay/Equipment/Heroes/DL44/W_Pistol_DL44_HanSolo_Sharpshooterz#OverheatConfig.HeatPerBullet');
    expect(checkSources(e)).toEqual([]);
  });

  it('leaves out a number its record lacks and says so; an ability with no effect listed has none', () => {
    const root = rootWith(`${HAN}HanSolo_DetonateGrenade_Projectile`, (a) => {
      a.objects = a.objects.filter((o) => o.$type !== 'ExplosionEntityData');
      return a;
    });
    const e = abilityRow(root, `${HAN}Ability_HanSolo_DemolitionGrenade`).effect;
    expect(e.damage).toBeUndefined();
    expect(e.gravity).toBe(-14);
    expect(e._missing).toHaveLength(4);
    expect(abilityRow(ROOT, 'Gameplay/Kits/Hero/DarthVader/Ability_DarthVader_ForceChoke_02').effect).toBeUndefined();
  });
});

describe('heroes, reinforcements, vehicles and teams', () => {
  it('reads the Rebel team on Hoth, the sequel era refused', () => {
    const t = teamRow(ROOT, 'Orig', 'hoth_01');
    expect(t.light.faction).toBe('Faction_Light_Orig');
    expect(t.light.classes).toContain('l-orig-assault');
    expect(t.light.heroes).toContain('luke');
    expect(t.light.heroes).not.toContain('rey');
    expect(t.refused).toEqual(expect.arrayContaining(['Kit_Hero_Rey', 'Kit_Hero_Finn', 'Kit_Hero_BB8']));
    expect(t.light.reinforcements).toContain('RebelJumpTrooper');
    expect(t.light.vehicles).toContain('Kit_Vehicle_ATRT_Rebel');
    expect(t.light.abilities).toContain('Ability_Weapon_BlasterRifle_A280C');
    expect(t.dark).toBeNull();
  });

  it('reads Vader', () => {
    const h = heroRow(ROOT, 'Gameplay/Kits/Hero/DarthVader/Kit_Hero_DarthVader');
    expect(h).toMatchObject({ id: 'darthvader', side: 'dark', health: 800, regen: { rate: 50 }, clipPrefix: 'DarthVader' });
    expect(h.armour).toEqual([850, 875, 900, 950]);
    expect(h.abilities.map((a) => a.slot)).toEqual(['left', 'middle', 'right']);
    expect(h.abilities[2].id).toBe('Ability_DarthVader_ForceChoke_02');
    expect(h.saber.deflect).toBe('U_Lightsaber_Deflect_Vader');
    expect(checkSources(h)).toEqual([]);
  });

  it('reads a reinforcement and its kind from its class', () => {
    const r = reinforcementRow(ROOT, 'Gameplay/Kits/Specials/RebelJumpTrooper/Kit_Special_RebelJumpTrooper');
    expect(r).toMatchObject({ id: 'RebelJumpTrooper', kind: 'aerial', side: 'light' });
    expect(r.health).toBeGreaterThan(0);
  });

  it('reads a vehicle: health, seats, weapons', () => {
    const v = vehicleRow(ROOT, 'Gameplay/Kits/Vehicle/ATRT/Kit_Vehicle_ATRT_Rebel');
    expect(v).toMatchObject({ id: 'Kit_Vehicle_ATRT_Rebel', blueprint: 'Gameplay/Vehicles/Mount/ATRT/Mount_ATRT_Rebel', kind: 'mount' });
    // (a mount's own health is 1, WSMountHealthComponentData: its rider takes the hits)
    expect(v.health).toBe(1);
    expect(v.seats[0].role).toBe('driver');
    expect(v.weapons.length).toBeGreaterThan(0);
    expect(v.weapons[0].rof).toBeGreaterThan(0);
    expect(checkSources(v)).toEqual([]);
  });
});

describe('broken chains and sources, from the final review', () => {
  it('a kit whose class weapons are missing still has its row, never a throw', () => {
    const root = rootWith('Gameplay/Kits/MP/Assault/DefaultWeapon_L_Assault_Orig', (a) => {
      a.objects[0].UnlockToCreate.$asset = 'Gameplay/Nope/U_Nope';
      return a;
    });
    const k = kitRow(root, 'Gameplay/Kits/MP/Assault/Kit_L_Assault_Orig_HO');
    expect(k.health).toBe(150);
    expect(k._missing.some((m) => m.includes('Nope'))).toBe(true);
  });

  it('a weapon whose unlock is missing says so', () => {
    const root = rootWith('Gameplay/Equipment/Rifles/A280C/Ability_Weapon_BlasterRifle_A280C', (a) => {
      a.objects[0].Unlock.$asset = 'Gameplay/Nope/U_Nope';
      return a;
    });
    const w = weaponRow(root, A280C);
    expect(w._missing[0]).toContain('U_Nope');
    expect(w.firing).toBeUndefined();
  });

  it('a reinforcement carries its primary weapon', () => {
    const r = reinforcementRow(ROOT, 'Gameplay/Kits/Specials/RebelJumpTrooper/Kit_Special_RebelJumpTrooper');
    expect(r.primaryAsset).toMatch(/RebelJumpTrooper/);
  });

  it('a source must name a record', () => {
    expect(checkSources({ a: 1, a_source: '' })).toEqual(['a']);
    expect(checkSources({ o: { _source: 'anything', n: 1 } })).toEqual(['o.n']);
    expect(checkSources({ a: 1, a_source: 'Gameplay/X#Type.Path', b: { _source: 'derived: the spawns', n: 2 }, c: { source: 'hand', n: 3 } })).toEqual([]);
    expect(heroRow(ROOT, 'Gameplay/Kits/Hero/DarthVader/Kit_Hero_DarthVader').armour_source).toMatch(/#MaxHealthAffectorAsset/);
  });
});
