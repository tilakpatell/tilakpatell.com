// What a blaster hero's ability does, as numbers (the hero-kit lane): the
// ability row holds the timings (bf2017-rulebook.mjs), and the effect is in
// the records its prefab reaches, a projectile's explosion, an affector's
// damage, a query's radius, a gadget's health. The prefabs are logic graphs,
// so nothing here walks them: `EFFECTS` names, an ability, the kind of thing
// it is and each number's record, type and field, and `effectOf` reads them
// from the export, each with its `<key>_source`. A field the export lacks is
// left out and listed in `_missing`; a number no record names (how many
// detonators Leia holds) is in the block's `hand`, with its line in
// src/data/bf2017/NOTES.md.
//
// A read is `[key, record, type, path, { is, affector }]`: the first object
// of that type in the record, or with `is` the first whose field has that
// value (a prefab holds several queries and delays; the source then says
// which, `Type[n]`), or with `affector` the apply that names that affector.
// A swapped weapon is a whole weapon row (`weaponRow`).
//
//   KINDS                                  the fourteen kinds
//   effectOf(root, id, { weaponRow }) → { kind, … } | null   (id: the ability's short name)

import { follow, objectsOf, pick, shortName } from './bf2017-ebx.mjs';

export const KINDS = ['charge', 'thrown', 'weaponSwap', 'dash', 'deployShield', 'cloud', 'scan', 'reveal', 'mines', 'barrage', 'stunDroid', 'selfShield', 'slam', 'marks'];

const K = 'Gameplay/Kits/Hero/';
const E = 'Gameplay/Equipment/Heroes/';
const A = 'Gameplay/Prefabs/Affectors/States/';
const PUSHED = 'Gameplay/Prefabs/Affectors/CharacterState/Affector_ForcePushed_3m';

// an explosion's four numbers
const blast = (rec) => [
  ['damage', rec, 'ExplosionEntityData', 'BlastDamage'],
  ['inner', rec, 'ExplosionEntityData', 'InnerBlastRadius'],
  ['radius', rec, 'ExplosionEntityData', 'BlastRadius'],
  ['impulse', rec, 'ExplosionEntityData', 'BlastImpulse'],
];
// the damage taken while it lasts: the affector's ranks are a star card's four levels
const taken = (rec, base = 0) => ({ read: [['taken', rec, 'DamageMultiplierAffectorAsset', `RankData.${base}.DamageMultiplier`]], ranks: [['takenByRank', rec, 'DamageMultiplierAffectorAsset', 'RankData.{n}.DamageMultiplier', [0, 1, 2, 3]]] });
const merge = (...parts) => ({ read: parts.flatMap((p) => p.read ?? []), ranks: parts.flatMap((p) => p.ranks ?? []) });

export const EFFECTS = {
  // ── Han Solo ──
  Ability_HanSolo_DemolitionGrenade: {
    kind: 'charge',
    read: [
      ...blast(`${K}HanSolo/HanSolo_DetonateGrenade_Projectile`),
      ['gravity', `${K}HanSolo/HanSolo_DetonateGrenade_Projectile`, 'FlashGrenadeEntityData', 'Gravity'],
      ['speed', `${K}HanSolo/HanSolo_DetonateGrenade_Projectile`, 'FlashGrenadeEntityData', 'InitialSpeed'],
      ['retrigger', `${K}HanSolo/Ability_HanSolo_DemolitionGrenade`, 'InactiveSoldierWeaponPlayerAbilityAsset', 'RetriggerCooldown'],
    ],
  },
  Ability_HanSolo_Sharpshooterz: { kind: 'weaponSwap', weapon: `${E}DL44/W_Pistol_DL44_HanSolo_Sharpshooterz` },
  Ability_HanSolo_ShoulderCharges: {
    kind: 'dash',
    ...merge(
      {
        read: [
          ['reach', `${K}HanSolo/PF_ShoulderCharge_HanSolo`, 'SphereQueryEntityData', 'Radius'],
          ['damage.trooper', `${A}Affector_Damage_HanSolo_ShoulderCharge_Troopers`, 'DamageAffectorAsset', 'RankData.0.InitialDamage'],
          ['damage.hero', `${A}Affector_Damage_HanSolo_ShoulderCharge`, 'DamageAffectorAsset', 'RankData.0.InitialDamage'],
          // (how long the prefab keeps the pushed state on the one it hit: the apply that names that affector)
          ['held', `${K}HanSolo/PF_ShoulderCharge_HanSolo`, 'AffectorApplyEntityData', 'Duration', { affector: 'Affector_ForcePushed_3m' }],
        ],
      },
      taken(`${A}Affector_HanSolo_SharpshooterDMGReduction1`),
    ),
    pushed: PUSHED,
  },
  // ── Leia ──
  Ability_Leia_ThermalDetonator_Fake: {
    kind: 'thrown',
    read: [
      ...blast(`${K}Leia/Abilities/Thermal_Detonator_Leia_Projectile`),
      ['gravity', `${K}Leia/Abilities/Thermal_Detonator_Leia_Projectile`, 'WSGrenadeEntityData', 'Gravity'],
      ['ttl', `${K}Leia/Abilities/Thermal_Detonator_Leia_Projectile`, 'WSGrenadeEntityData', 'TimeToLive'],
    ],
    // (how many she holds is the ability's text, "up to three"; the fuse is the trooper's detonator's, 0.7 s at rest)
    hand: { count: 3, fuse: 0.7 },
  },
  // (no timed length: the record's active time is flagged infinite, so the E-11's own heat ends it)
  Ability_BlasterRifle_E11_Leia: { kind: 'weaponSwap', weapon: `${E}E11Leia/W_BlasterRifle_E11_Leia`, ...taken(`${K}Affector_Leia_DmgReduction1`) },
  Ability_Leia_BubbleShield: {
    kind: 'deployShield',
    read: [
      ['health', `${K}Leia/Ability_Leia_BubbleShield`, 'PlayerAbilityPropertyOutputFloatModifierValue', 'Value', { is: 3000 }],
      ['seconds', `${K}Leia/Ability_Leia_BubbleShield`, 'PlayerAbilityPropertyOutputFloatModifierValue', 'Value', { is: 30 }],
      ['radius', `${K}Leia/Vehicle_Gadget_Leia_BubbleShield`, 'SphereQueryEntityData', 'Radius'],
      ['heal', `${K}Leia/Affector_Heal_Leia_BubbleShield`, 'HealingAffectorAsset', 'RankData.0.InitialHeal'],
      ['healEvery', `${K}Leia/Vehicle_Gadget_Leia_BubbleShield`, 'DelayEntityData', 'Delay', { is: 0.5 }],
    ],
  },
  // ── Lando ──
  Ability_GrenadeSmoke_Lando: {
    kind: 'cloud',
    read: [
      ['radius', 'Gameplay/Equipment/Grenades/Smoke/Lando_Smoke_Projectile', 'ExplosionEntityData', 'BlastRadius'],
      ['unseen', 'Gameplay/Equipment/Grenades/Smoke/Lando_Smoke_Projectile', 'BlockSpottingEntityData', 'Radius'],
      // (the graph's two floats: the smoke stands 7 s from its first bounce, and hides those within 6 m of it)
      ['seconds', 'Gameplay/Equipment/Grenades/Smoke/Lando_Smoke_Projectile', 'FloatEntityData', 'DefaultValue', { is: 7 }],
      ['hides', 'Gameplay/Equipment/Grenades/Smoke/Lando_Smoke_Projectile', 'FloatEntityData', 'DefaultValue', { is: 6 }],
      ['ttl', 'Gameplay/Equipment/Grenades/Smoke/Lando_Smoke_Projectile', 'WSGrenadeEntityData', 'TimeToLive'],
    ],
  },
  Ability_Lando_SharpShot: {
    kind: 'marks',
    read: [
      ['range', `${K}Lando/Prefabs/PF_SharpShot_Lando`, 'SphereQueryEntityData', 'Radius', { is: 40 }],
      ['marked', `${K}Lando/Prefabs/PF_SharpShot_Lando`, 'AffectorApplyEntityData', 'Duration', { is: 6 }],
      // (the flurry: one shot of the ability's own round at each mark, this far apart; set off by a second press
      // once the retrigger cooldown has passed, or by the active time's end)
      ['damage', 'Gameplay/Equipment/Shared/Projectiles/BlasterProjectile_Lando_Sharpshot', 'WSBulletEntityData', 'StartDamage'],
      ['every', `${K}Lando/Prefabs/PF_SharpShot_Lando`, 'DelayEntityData', 'Delay', { is: 0.15 }],
      ['retrigger', `${K}Lando/Ability_Lando_SharpShot`, 'RetriggerablePlayerAbilityAsset', 'RetriggerCooldown'],
    ],
    // (the ability's text: "up to five"; he marks what is inside 45° of his aim)
    hand: { count: 5, cone: 45 },
  },
  Ability_Lando_Disruptor: {
    kind: 'reveal',
    read: [
      ['radius', `${K}Lando/Lando_Disruptor_Projectile`, 'SphereQueryEntityData', 'Radius', { is: 12 }],
      ['shock', `${K}Lando/Lando_Disruptor_Projectile`, 'AffectorApplyEntityData', 'Duration', { is: 1.1 }],
      ['jam', `${K}Lando/Lando_Disruptor_Projectile`, 'AffectorApplyEntityData', 'Duration', { is: 2 }],
      ['retrigger', `${K}Lando/Ability_Lando_Disruptor`, 'DemolitionChargePlayerAbilityAsset', 'RetriggerCooldown'],
    ],
  },
  // ── Chewbacca ──
  Ability_Chewbacca_GrenadeStun: {
    kind: 'thrown',
    read: [
      ['radius', `${K}Chewbacca/Grenade_Projectile_ChewbaccaGrenadeStun_Main`, 'ExplosionEntityData', 'BlastRadius'],
      ['ttl', `${K}Chewbacca/Grenade_Projectile_ChewbaccaGrenadeStun_Main`, 'WSGrenadeEntityData', 'TimeToLive'],
      ['gravity', `${K}Chewbacca/Grenade_Projectile_ChewbaccaGrenadeStun_Main`, 'WSGrenadeEntityData', 'Gravity'],
      // (it splits into this many; each shocks for `shock` seconds within `reach`, and no one twice inside `immune`)
      ['splits', `${K}Chewbacca/Grenade_Projectile_ChewbaccaGrenadeStun_Main`, 'IntEntityData', 'DefaultValue', { is: 6 }],
      ['shock', `${K}Chewbacca/Ability_Chewbacca_GrenadeStun`, 'PlayerAbilityPropertyOutputFloatModifierValue', 'Value', { is: 0.75 }],
      ['reach', `${K}Chewbacca/Ability_Chewbacca_GrenadeStun`, 'PlayerAbilityPropertyOutputFloatModifierValue', 'Value', { is: 3 }],
      ['immune', `${K}Chewbacca/Grenade_Projectile_ChewbaccaGrenadeStun_Scatter`, 'AffectorApplyEntityData', 'Duration', { is: 3.5 }],
    ],
    // (one grenade, split where it first lands; how the six fly out is the officer's flash grenade's split, by hand: grenades.js)
    hand: { count: 1, fuse: 0 },
  },
  Ability_Weapon_FuriousBowcaster: { kind: 'weaponSwap', weapon: `${E}FuriousBowcaster/W_BlasterRifle_Bowcaster_Furious_Chewbacca` },
  Ability_Chewbacca_Leap: {
    kind: 'slam',
    ...merge(
      {
        read: [
          ['radius', `${K}Chewbacca/Prefabs/PF_LeapSlam_Chewbacca`, 'SphereQueryEntityData', 'Radius', { is: 4 }],
          ['damage.trooper', `${A}Affector_Damage_Chewbacca_LeapSlam_Trooper`, 'DamageAffectorAsset', 'RankData.0.InitialDamage'],
          ['damage.hero', `${A}Affector_Damage_Chewbacca_LeapSlam`, 'DamageAffectorAsset', 'RankData.0.InitialDamage'],
        ],
      },
      // (five ranks: the fifth is the ability's own, the first four a card's)
      taken(`${A}Affector_Chewbacca_DMGReduction`, 4),
    ),
    pushed: PUSHED,
    // (how far the leap carries: Chewbacca_Takeoff's 10 m/s turned by the aim, by hand)
    hand: { leap: 8 },
  },
  // ── Boba Fett ──
  Ability_BobaFett_Concussion_Rocket: {
    kind: 'thrown',
    read: [
      ['radius', `${K}BobaFett/Projectile_Boba_Concussion_Dart`, 'ExplosionEntityData', 'BlastRadius'],
      ['gravity', `${K}BobaFett/Projectile_Boba_Concussion_Dart`, 'WSGrenadeEntityData', 'Gravity'],
      ['speed', `${K}BobaFett/Projectile_Boba_Concussion_Dart`, 'WSGrenadeEntityData', 'InitialSpeed'],
      ['ttl', `${K}BobaFett/Projectile_Boba_Concussion_Dart`, 'WSGrenadeEntityData', 'TimeToLive'],
      ['flash.range', `${K}BobaFett/Affector_BobaConcussionFlash`, 'FlashAffectorAsset', 'FlashDistance'],
      ['flash.angle', `${K}BobaFett/Affector_BobaConcussionFlash`, 'FlashAffectorAsset', 'FlashAngle'],
      ['flash.seconds', `${K}BobaFett/Projectile_Boba_Concussion_Dart`, 'AffectorApplyEntityData', 'Duration', { is: 3 }],
      ['disrupt', `${K}BobaFett/Projectile_Boba_Concussion_Dart`, 'AffectorApplyEntityData', 'Duration', { is: 1.2 }],
    ],
    hand: { count: 1, fuse: 0 },
  },
  Ability_BobaFett_Ping: { kind: 'scan', read: [['range', `${K}BobaFett/Ability_BobaFett_Ping`, 'PlayerAbilityPropertyOutputFloatModifierValue', 'Value', { is: 30 }]] },
  Ability_BobaFett_RocketBarrage: {
    kind: 'barrage',
    read: [
      ['count', `${E}Wristlauncher/Gadget_WristLauncher_RocketBarrage`, 'FiringFunctionData', 'Ammo.MagazineCapacity'],
      ['rof', `${E}Wristlauncher/Gadget_WristLauncher_RocketBarrage`, 'FiringFunctionData', 'FireLogic.RateOfFire'],
      ...blast(`${E}Wristlauncher/WristLauncher_DefaultProjectile`),
      ['gravity', `${E}Wristlauncher/WristLauncher_DefaultProjectile`, 'WSMissileEntityData', 'Gravity'],
      ['ttl', `${E}Wristlauncher/WristLauncher_DefaultProjectile`, 'WSMissileEntityData', 'TimeToLive'],
    ],
    // (a missile's speed is its engine's push, not a field: 40 m/s by hand; the rockets land within 4 m of the aim)
    hand: { speed: 40, spread: 4 },
  },
  // ── Bossk ──
  Ability_Bossk_GrenadeDioxis: {
    kind: 'cloud',
    read: [
      ['radius', `${E}DioxisGrenadeBossk/Bossk_Projectile_DioxisGrenade`, 'ExplosionEntityData', 'BlastRadius'],
      ['reach', `${E}DioxisGrenadeBossk/Bossk_Projectile_DioxisGrenade`, 'SphereQueryEntityData', 'Radius'],
      // (the cloud stays the graph's 6 s after it bursts; the record's TimeToLive is the grenade's flight fuse)
      ['seconds', `${E}DioxisGrenadeBossk/Bossk_Projectile_DioxisGrenade`, 'FloatEntityData', 'DefaultValue', { is: 6 }],
      ['ttl', `${E}DioxisGrenadeBossk/Bossk_Projectile_DioxisGrenade`, 'WSGrenadeEntityData', 'TimeToLive'],
      ['first', `${A}Affector_Damage_Bossk_DioxisGrenade`, 'DamageAffectorAsset', 'RankData.0.InitialDamage'],
      ['perSecond', `${A}Affector_Damage_Bossk_DioxisGrenade`, 'DamageAffectorAsset', 'RankData.0.DamageToDealPerSecond'],
      ['tick', `${A}Affector_Damage_Bossk_DioxisGrenade`, 'DamageAffectorAsset', 'RankData.0.DamageInterval'],
    ],
  },
  Ability_Bossk_PredatorInstincts: { kind: 'weaponSwap', weapon: `${E}RelbyV10_Microgrenades/W_Bossk_Relby_V10_Microgrenades`, ...taken(`${A}Affector_Bossk_PredatorDMGReduction1`) },
  Ability_Bossk_ExplosiveTraps_New: {
    kind: 'mines',
    read: [
      ...blast(`${E}ExplosiveTrapsBossk/ExplosiveTraps_Bossk_Projectile`),
      ['trigger', `${E}ExplosiveTrapsBossk/ExplosiveTraps_Bossk_Projectile`, 'WSExplosionPackEntityData', 'SoldierDetonationData.Radius'],
      ['arm', `${E}ExplosiveTrapsBossk/ExplosiveTraps_Bossk_Projectile`, 'WSExplosionPackEntityData', 'SoldierDetonationData.SoldierDetonationActivationDelay'],
    ],
    // (the ability's text: "three"; laid 3 m apart ahead of him, gone after a minute: by hand)
    hand: { count: 3, apart: 3, life: 60 },
  },
  // ── Iden ──
  Ability_Iden_Droid_Stun: {
    kind: 'stunDroid',
    read: [
      ['damage', `${A}Affector_Damage_Iden_Droid_Electrocute`, 'DamageAffectorAsset', 'RankData.0.InitialDamage'],
      ['shock', `${K}Iden/Prefabs/PF_IdenDroid_Shared`, 'AffectorApplyEntityData', 'Duration', { is: 0.9 }],
      ['chain', `${K}Iden/Prefabs/PF_IdenDroid_Shared`, 'SphereQueryEntityData', 'Radius', { is: 5 }],
    ],
    // (how far ahead the droid finds its mark is its flight, not a field: 20 m inside 30° by hand. The record's
    // ActivationTime of 10 s is how long the droid may be held looking; here it finds its mark at the press)
    hand: { range: 20, cone: 30, activation: 0 },
  },
  Ability_Iden_Pulse_Cannon: { kind: 'weaponSwap', weapon: `${E}Iden_Pulse_Cannon/W_Iden_Pulse_Cannon` },
  Ability_Iden_Droid_Shield: { kind: 'selfShield', read: [['health', `${K}Iden/Iden_Shield_BurstShield`, 'ShieldHealthComponentData', 'MaxHealth']] },
};

// row[a.b] = value, with its source beside it
function put(row, key, value, source) {
  const keys = key.split('.');
  let at = row;
  for (const k of keys.slice(0, -1)) at = at[k] ??= {};
  const last = keys[keys.length - 1];
  at[last] = value;
  at[`${last}_source`] = source;
}

// the object a read names, and its place among the record's objects of that type: the first, the first whose
// field has the value `is`, or the one that applies the affector named
function find(asset, type, path, { is, affector } = {}) {
  const list = objectsOf(asset, type);
  const n = affector ? list.findIndex((o) => shortName(o.Affector?.$asset ?? '') === affector) : is === undefined ? (list.length ? 0 : -1) : list.findIndex((o) => pick(o, path) === is);
  return n < 0 ? null : { obj: list[n], n };
}

export function effectOf(root, id, { weaponRow = null } = {}) {
  const spec = EFFECTS[id];
  if (!spec) return null;
  const row = { kind: spec.kind };
  const missing = [];
  const value = (rec, type, path, opt) => {
    const asset = follow(root, rec);
    const hit = asset && find(asset, type, path, opt);
    const v = hit ? pick(hit.obj, path) : undefined;
    return typeof v === 'number' ? { v, source: `${rec}#${type}${hit.n ? `[${hit.n}]` : ''}.${path}` } : null;
  };
  for (const [key, rec, type, path, opt] of spec.read ?? []) {
    const r = value(rec, type, path, opt);
    if (r) put(row, key, r.v, r.source);
    else missing.push(`${key}: ${rec}#${type}.${path}`);
  }
  for (const [key, rec, type, path, levels] of spec.ranks ?? []) {
    const list = levels.map((n) => value(rec, type, path.replace('{n}', n))?.v);
    if (list.every((v) => typeof v === 'number')) put(row, key, list, `${rec}#${type}.${path.replace('{n}', `{${levels[0]}..${levels[levels.length - 1]}}`)}`);
    else missing.push(`${key}: ${rec}#${type}.${path}`);
  }
  if (spec.pushed) {
    // (the push the prefab applies is a state request; how far is in the affector's own name)
    const m = /_(\d+)m$/.exec(spec.pushed);
    if (follow(root, spec.pushed) && m) put(row, 'knock', Number(m[1]), `derived: the name of ${spec.pushed}`);
    else missing.push(`knock: ${spec.pushed}`);
  }
  if (spec.weapon) {
    const w = weaponRow?.(root, spec.weapon);
    // (named by its blueprint: two heroes' ability weapons end in the hero's name, as their primaries do)
    if (w?.blueprint) row.weapon = { ...w, id: shortName(spec.weapon), name: null };
    else missing.push(`weapon: ${spec.weapon}`);
  }
  if (spec.hand) row.hand = { source: 'hand', ...spec.hand };
  row._missing = missing;
  return row;
}
