// What the heroes' and the reinforcements' abilities do, as the game's own
// gameplay data has it (bf2-re findings 33, 41, 46): an ability's prefab and
// everything it hands work to (the prefabs it references, the weapon its
// unlock names, that weapon's projectile and the projectile's own graph),
// read for the pieces the site's sim plays: the spheres it queries, the
// angle filters on them, every affector it applies (to its user or to the
// query's targets, to heroes or to troopers), the projectiles it fires and
// their explosions, and each affector's numbers (a damage, a multiplier on
// the damage taken, a shield, a heal, a regeneration, a character-state
// request with its trigger and impulse). Pure over a root: the reads go
// through bf2017-ebx.mjs's cache.
//
//   UNIT_KIND                        { abilityId: kind } the one judgement: how the sim plays an ability, by its name
//   effectOf(root, abilityName, identifier) → { prefab, spheres, filters, applies, projectiles, fired, shields, spotting, outputs }
//   affectorRow(root, name)         → { type, ranks: [...], request?, descriptors, stacking, _source } | null
//   requestOf(root, ref)            → { trigger, floats, ints, maxDuration } (an `AllRequests` character-state request)

import { fieldHash, outputRoles } from './bf2017-abilities.mjs';
import { deref, follow, pointee, rootOf, shortName } from './bf2017-ebx.mjs';

const TARGET_LIST = fieldHash('TargetList');
const HERO_SIDES = [4161031954, 1555918390]; // Affector_Hero_LightSide, Affector_Hero_DarkSide
const HERO_PASS = 309214835;
const HERO_FAIL = 1495681468;

// How the sim plays each of Hoth's hero and reinforcement abilities (the game's name for it says what it is).
export const UNIT_KIND = {
  Ability_Luke_ForcePush: 'push',
  Ability_Luke_ForceRepulse: 'repulse',
  Ability_Luke_Dash: 'rush',
  Ability_Leia_ThermalDetonator_Fake: 'grenade',
  Ability_BlasterRifle_E11_Leia: 'weapon',
  Ability_Leia_BubbleShield: 'bubble',
  Ability_HanSolo_DemolitionGrenade: 'grenade',
  Ability_HanSolo_Sharpshooterz: 'weapon',
  Ability_HanSolo_ShoulderCharges: 'rush',
  Ability_Chewbacca_GrenadeStun: 'grenade',
  Ability_Weapon_FuriousBowcaster: 'weapon',
  Ability_Chewbacca_Leap: 'slam',
  Ability_GrenadeSmoke_Lando: 'grenade',
  Ability_Lando_SharpShot: 'sharpShot',
  Ability_Lando_Disruptor: 'pulse',
  Ability_Yoda_ForceAbsorb: 'repulse',
  Ability_Yoda_ForceBarrier: 'barrier',
  Ability_Yoda_DashAttack_CharacterState: 'rush',
  DefaultAbility_ObiWan_AllOutPush: 'push',
  Ability_ObiWan_RestrictiveMindTrick: 'push',
  DefaultAbility_ObiWan_DefensiveRush: 'rush',
  DefaultAbility_Anakin_PullDominance: 'pull',
  DefaultAbility_Anakin_HeroicImpact: 'slam',
  DefaultAbility_Anakin_ImpassionateStrike: 'rush',
  Ability_BobaFett_Concussion_Rocket: 'grenade',
  Ability_BobaFett_Ping: 'scan',
  Ability_BobaFett_RocketBarrage: 'grenade',
  Ability_Bossk_GrenadeDioxis: 'grenade',
  Ability_Bossk_PredatorInstincts: 'scan',
  Ability_Bossk_ExplosiveTraps_New: 'grenade',
  Ability_DarthVader_SaberThrowCharacterState: 'throw',
  Ability_Vader_FocusRage: 'buff',
  Ability_DarthVader_ForceChoke_02: 'choke',
  Ability_Emperor_ChainLightningCS: 'chain',
  Ability_Emperor_DarkAura: 'aura',
  Ability_Emperor_ElectrocuteCS: 'choke',
  Ability_DarthMaul_SaberThrowCharacterState: 'throw',
  Ability_Maul_ForceChoke: 'choke',
  Ability_DarthMaul_SpinAttackCharacterState: 'rush',
  Ability_Iden_Droid_Stun: 'pulse',
  Ability_Iden_Pulse_Cannon: 'weapon',
  Ability_Iden_Droid_Shield: 'bubble',
  DefaultAbility_Grievous_ThrustSurge: 'rush',
  DefaultAbility_Grievous_UnrelentingAdvance: 'buff',
  DefaultAbility_Grievous_ClawRush: 'rush',
  DefaultAbility_Dooku_LightningStun: 'push',
  DefaultAbility_Dooku_Duelist: 'buff',
  DefaultAbility_Dooku_ExposeWeakness: 'weaken',
  Ability_Special_WookieWarrior_ThermalImploder: 'grenade',
  Ability_Special_Weapon_WookieWarrior_BowcasterFrenzy: 'weapon',
  Ability_WookieeWarrior_Slam: 'slam',
  Ability_Special_Shared_JumpPack: 'jumpPack',
  Ability_Special_RebelJumpTrooper_RocketLauncher: 'weapon',
  Ability_Special_Shared_JumpPack_Dash: 'jumpPack',
  Ability_Nest_EwokRebel: 'grenade',
  Ability_EwokRebel_Vision: 'scan',
  Ability_EwokRebel_Horn: 'buff',
  Ability_Special_SonicImploder: 'grenade',
  Ability_Special_Shared_Splice: 'buff',
  Ability_Shared_Fortify: 'buff',
  Ability_Special_JumpTrooper_RocketLauncher: 'weapon',
  Ability_ISBAgent_CombatRush: 'buff',
  Ability_ISBAgent_Scanner: 'scan',
  Ability_ISBAgent_Command: 'barrier',
};

const where = (asset, obj, path) => `${asset.name}#${obj.$type}.${path}`;
const conns = (doc) => rootOf(doc).PropertyConnections ?? [];
const obj = (doc, r) => (r && r.$ref != null ? doc.objects[r.$ref] : null);

// (the prefabs a prefab hands work to: the gameplay ones; never the looks, the sound, the HUD or the shared AOE drawings)
const FOLLOW = /^Gameplay\/(Kits|Prefabs\/Abilities|Prefabs\/Projectiles|Equipment)\//i;
const SKIP = /PF_AOE_|PF_BB_|_VFX|VFXLogic|\/FX_|Sound|_VO_|Hud|\/UI_|Rumble|LatencyCompensation|_FX$|_FX_/i;

// the records an ability's work runs through, each once: [{ name, doc, depth }]
export function docsOf(root, abilityName, maxDepth = 3) {
  const out = [];
  const seen = new Set();
  const visit = (name, depth) => {
    if (!name || depth > maxDepth || seen.has(name.toLowerCase())) return;
    seen.add(name.toLowerCase());
    const doc = follow(root, name);
    if (!doc) return;
    out.push({ name: doc.name ?? name, doc, depth });
    const r = rootOf(doc);
    // (an unlock names its weapon's blueprint; an ability, its prefab and its unlock)
    if (r.$type === 'SoldierWeaponUnlockAsset') return visit(r.NonStreamedBlueprint?.$asset, depth + 1);
    if (/PlayerAbilityAsset$/.test(r.$type)) {
      visit(r.Blueprint?.$asset, depth + 1);
      visit(r.Unlock?.$asset, depth + 1);
      return;
    }
    doc.objects.forEach((o, i) => {
      if (!o) return;
      const bp = i > 0 ? o.Blueprint?.$asset : null;
      if (bp && FOLLOW.test(bp) && !SKIP.test(bp)) visit(bp, depth + 1);
      for (const p of [o.FireProjectileData?.ProjectileBlueprint, o.ProjectileBlueprint, o.Shot?.ProjectileData, o.Vehicle]) if (p?.$asset && !SKIP.test(p.$asset)) visit(p.$asset, depth + 1);
      if (o.$type === 'SoldierWeaponData' && o.WeaponFiring?.$asset) visit(o.WeaponFiring.$asset, depth + 1);
      if (o.$type === 'WeaponFiringDataAsset') {
        const fn = deref(doc, deref(doc, o.Data)?.PrimaryFire);
        if (fn?.Shot?.ProjectileData?.$asset) visit(fn.Shot.ProjectileData.$asset, depth + 1);
      }
    });
  };
  visit(abilityName, 0);
  return out;
}

// which way an applied affector's targets come: a hero filter's first output is the heroes, its second everyone else
function vsOf(doc, i) {
  for (const c of conns(doc)) {
    if (c.Target?.$ref !== i) continue;
    const src = obj(doc, c.Source);
    if (src?.$type !== 'AffectorQueryFilterEntityData' || !(src.DescriptorIds ?? []).some((d) => HERO_SIDES.includes(d >>> 0))) continue;
    if (c.SourceFieldId >>> 0 === HERO_PASS) return 'hero';
    if (c.SourceFieldId >>> 0 === HERO_FAIL) return 'trooper';
  }
  return null;
}

// whom it lands on: the prefab's own user (its TargetList fed by the interface: the soldier the prefab runs on), else the query's
function toOf(doc, i) {
  if (rootOf(doc).$type !== 'LogicPrefabBlueprint') return 'targets';
  const feeds = conns(doc).filter((c) => c.Target?.$ref === i && (c.TargetFieldId | 0) === TARGET_LIST);
  return feeds.length && feeds.every((c) => obj(doc, c.Source)?.$type === 'InterfaceDescriptorData') ? 'self' : 'targets';
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function projectileOf(name, doc) {
  const out = { blueprint: name };
  const e = obj(doc, rootOf(doc).Object) ?? doc.objects.find((o) => /Missile|Grenade|Bullet|Projectile/.test(o?.$type ?? '') && o.$type.endsWith('EntityData'));
  if (e) {
    out.entity = e.$type;
    for (const [k, f] of [
      ['speed', 'InitialSpeed'],
      ['maxSpeed', 'MaxSpeed'],
      ['gravity', 'Gravity'],
      ['ttl', 'TimeToLive'],
      ['engineTtl', 'EngineTimeToLive'],
      ['bounce', 'CollisionSpeedMultiplier'],
      ['minBounce', 'MinBounceSpeed'],
      ['startDamage', 'StartDamage'],
      ['endDamage', 'EndDamage'],
    ]) {
      const v = num(e[f]);
      if (v != null) out[k] = v;
    }
    out._source = where(doc, e, 'InitialSpeed');
  }
  const blasts = doc.objects.filter((o) => o?.$type === 'ExplosionEntityData' && (o.BlastDamage > 0 || o.BlastRadius > 0));
  if (blasts.length) {
    const x = blasts.reduce((a, b) => (b.BlastDamage > a.BlastDamage ? b : a));
    out.explosion = { inner: x.InnerBlastRadius ?? 0, damage: x.BlastDamage ?? 0, radius: x.BlastRadius ?? 0, impulse: x.BlastImpulse ?? 0, _source: where(doc, x, 'BlastDamage') };
  }
  return out;
}

export function effectOf(root, abilityName, identifier = null) {
  const docs = docsOf(root, abilityName);
  const fx = { prefab: null, spheres: [], filters: [], applies: [], projectiles: [], fired: [], shields: [], spotting: [], outputs: {} };
  const ability = docs[0]?.doc;
  if (!ability) return fx;
  fx.prefab = rootOf(ability).Blueprint?.$asset ?? null;
  for (const { name, doc } of docs) {
    const r = rootOf(doc);
    if (r.$type === 'ProjectileBlueprint') fx.projectiles.push(projectileOf(name, doc));
    if (r.$type === 'LogicPrefabBlueprint') {
      for (const [hash, role] of Object.entries(outputRoles(doc, identifier))) fx.outputs[hash] ??= { ...role, in: shortName(name) };
    }
    doc.objects.forEach((o, i) => {
      if (!o) return;
      if (o.$type === 'AffectorApplyEntityData' && o.Affector?.$asset) fx.applies.push({ affector: o.Affector.$asset, duration: o.Duration ?? 0, rank: o.Rank ?? 0, to: toOf(doc, i), vs: vsOf(doc, i), _source: where(doc, o, 'Duration') });
      else if (o.$type === 'SphereQueryEntityData' && o.Radius > 0) fx.spheres.push({ radius: o.Radius, types: (o.FilteredTypes ?? '').replace(/^QueryEntityFilter_/, ''), _source: where(doc, o, 'Radius') });
      else if (o.$type === 'DynamicQueryFilterEntityData') {
        const d = o.InputData ?? {};
        const f = {};
        if (d.FilterOutAngle > 0) f.angle = d.FilterOutAngle;
        if (d.FilterOutDistance > 0) f.distance = d.FilterOutDistance;
        if (d.FilterOutTargetFacingAngle > 0) f.facing = d.FilterOutTargetFacingAngle;
        if (d.MaxTargetAngleFromForwardDirection > 0) f.fromForward = d.MaxTargetAngleFromForwardDirection;
        if (o.MaxResults > 0) f.max = o.MaxResults;
        if (Object.keys(f).length) fx.filters.push({ ...f, _source: where(doc, o, 'InputData') });
      } else if (o.$type === 'FiringFunctionData') {
        const s = o.Shot ?? {};
        const v = s.InitialSpeed ?? {};
        fx.fired.push({ rof: o.FireLogic?.RateOfFire ?? null, speed: [v.x ?? 0, v.y ?? 0, v.z ?? 0], projectile: s.ProjectileData?.$asset ?? null, perShot: s.NumberOfBulletsPerShell ?? 1, _source: where(doc, o, 'Shot.InitialSpeed') });
      } else if (o.$type === 'ShieldControllerEntityData') fx.shields.push({ shield: o.Shield?.$asset ?? null, radius: o.ShieldRadius ?? null, _source: where(doc, o, 'ShieldRadius') });
      else if (o.$type === 'SpottingEntityData' && o.Duration > 0) fx.spotting.push({ seconds: o.Duration, _source: where(doc, o, 'Duration') });
    });
  }
  return fx;
}

// an `AllRequests` character-state request: the trigger it raises and the values it sets with it
export function requestOf(root, ref) {
  const p = ref?.$asset ? pointee(root, ref) : null;
  if (!p?.obj) return null;
  const { asset, obj: o } = p;
  const name = (c) => (c?.$class ? (pointee(root, c)?.obj?.Name ?? null) : null);
  const vars = o.VariationList ?? {};
  const read = (list) => Object.fromEntries((list ?? []).map((v) => deref(asset, v)).filter(Boolean).map((v) => [name(v.VariationChannel), v.VariationValue]));
  return { trigger: name(o.TriggerToSet), floats: read(vars.FloatVariations), ints: read(vars.IntVariations), maxDuration: o.MaxDuration ?? null, _source: where(asset, o, 'TriggerToSet') };
}

// the numbers of the affector kinds the sim plays, per rank
const FIELDS = {
  DamageAffectorAsset: { damage: 'InitialDamage', perSecond: 'DamageToDealPerSecond', interval: 'DamageInterval', delay: 'DelayInitialDamageTime' },
  DamageMultiplierAffectorAsset: { multiplier: 'DamageMultiplier' },
  DamageShieldAffectorAsset: { start: 'StartValue', full: 'FullValue', chargeStep: 'ChargeUpStepValue', chargeEvery: 'ChargeUpStepDelay', drainStep: 'DepleteStepValue', drainEvery: 'DepleteStepDelay', drainAfter: 'DelayUntilDepletionStart' },
  HealingAffectorAsset: { heal: 'InitialHeal', perSecond: 'HealthToRestorePerSecond' },
  SoldierHealthRegenerationAffectorAsset: { rate: 'RegenerationRate', delay: 'RegenerationDelay', max: 'MaxRegenerationAmount' },
  MaxHealthAffectorAsset: { maxHealth: 'MaxHealth' },
};

export function affectorRow(root, name) {
  const asset = follow(root, name);
  if (!asset) return null;
  const a = rootOf(asset);
  const row = { type: a.$type, stacking: (a.StackingPolicy ?? '').replace(/^AffectorStackingPolicy_/, ''), descriptors: (a.DescriptorIds ?? []).map((d) => d >>> 0), _source: where(asset, a, 'RankData') };
  const fields = FIELDS[a.$type];
  if (fields) {
    const ranks = a.RankData?.length ? a.RankData : [a];
    row.ranks = ranks.map((r) => Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, num(r[f])]).filter(([, v]) => v != null)));
  }
  if (a.$type === 'CharacterStateAffectorAsset') row.request = requestOf(root, a.RankData?.[0]?.Request);
  if (a.$type === 'RemoveAffectorAsset' || a.DescriptorToRemoveId != null) row.removes = (a.DescriptorToRemoveId ?? 0) >>> 0;
  return row;
}
