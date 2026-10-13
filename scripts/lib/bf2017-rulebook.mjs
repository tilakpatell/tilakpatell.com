// The rulebooks' rows, built from the 2017 data dump (see bf2017-ebx.mjs for
// what an asset is). Each builder follows one kind's chain of `$asset`
// pointers and keeps the numbers the game's rules use, each with a
// `<key>_source` naming where it came from (`<asset>#<Type>.<path>`), so a
// value in a rulebook can always be checked against the record it came from.
//
// A link the export lacks (a `$asset` naming a record not there) never throws:
// the row keeps what it could read, leaves the rest out and lists the missing
// links in `_missing`.
//
// The weapon chain, as the A280C reads:
//
//   Ability_Weapon_* (SoldierWeaponPlayerAbilityAsset).Unlock
//   → U_* (SoldierWeaponUnlockAsset).NonStreamedBlueprint
//   → W_* (SoldierWeaponBlueprint): SoldierWeaponData (WeaponFiring, ZoomLevels,
//     MaxRangeMeterDistance), BlasterWeaponData.ProjectileParameters (damage
//     multipliers), WeaponOverheatModifier.HeatPerBullet,
//     OverheatComponentData.OverheatConfig
//   → WeaponFiring_* (WeaponFiringDataAsset).Data → WeaponFiringData (DeployTime,
//     WeaponSway) and its PrimaryFire → FiringFunctionData (FireLogic, Shot,
//     OverHeat, Ammo)
//   → Shot.ProjectileData → BlasterProjectile_* (GameDataContainerAsset).Data →
//     WSBulletEntityData: the damage fields are StartDamage, EndDamage,
//     DamageFalloffStartDistance, DamageFalloffEndDistance; the bolt's colour
//     is in its TrailEffect's name (FX_BlasterBolt_Rifle_Red)
//   → WeaponSway_* (GunSwayData.Dispersion[], CameraRecoilData)
//   → OverheatConfig_* (OverheatConfig: the heat bar and ActiveCooldownSettings)
//
// A weapon's display name is the string `ID_W_<id>` (ID_W_A280C → "A280C").

import { assetRefs, deref, follow, isSequel as isSequelName, objectsOf, pick, pointee, readIndex, rootOf, shortName } from './bf2017-ebx.mjs';
import { effectOf } from './bf2017-rulebook-effects.mjs';

export { isSequel } from './bf2017-ebx.mjs';

// ── sources ──────────────────────────────────────────────────────────────

const where = (asset, obj, path) => `${asset.name}#${obj.$type}.${path}`;

// Sets row[key] from obj at path with its source, when the value is there.
function take(row, key, asset, obj, path) {
  const v = obj ? pick(obj, path) : undefined;
  if (v === undefined || v === null) return undefined;
  row[key] = v;
  row[`${key}_source`] = where(asset, obj, path);
  return v;
}

export function withSources(row, sources) {
  for (const [k, s] of Object.entries(sources)) row[`${k}_source`] = s;
  return row;
}

// The numeric leaves that name no source: neither a `<key>_source` beside
// them (or beside the array they sit in), nor an object `_source`, nor a
// `source: 'hand'` on an ancestor. (Copied into src/data/bf2017/rulebook.test.js.)
export function checkSources(json) {
  const bad = [];
  // (a source names a record and a path, `<asset>#<Type>…`, a web build file, or how it was derived)
  const real = (s) => typeof s === 'string' && /^(derived: \S|web\/\S|[^#\s]+#\S)/.test(s);
  const walk = (v, path, covered) => {
    if (typeof v === 'number') return covered || bad.push(path);
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}.${i}`, covered));
    const all = covered || v.source === 'hand' || real(v._source);
    for (const [k, x] of Object.entries(v)) {
      if (k.endsWith('_source') || k === '_from') continue;
      walk(x, path ? `${path}.${k}` : k, all || real(v[`${k}_source`]));
    }
  };
  walk(json, '', false);
  return bad;
}

// ── helpers ──────────────────────────────────────────────────────────────

const indexes = new Map();
export function indexOf(root) {
  if (!indexes.has(root)) indexes.set(root, readIndex(root));
  return indexes.get(root);
}

// The pointee of an `$asset`, or a line in `missing` when the export lacks it.
function reach(root, v, missing, what) {
  if (!v?.$asset) return null;
  const p = pointee(root, v);
  if (!p) missing.push(`${what}: ${v.$asset}`);
  return p;
}

// The first `$asset` an object holds under a key.
const refNamed = (obj, key) => assetRefs(obj).find((r) => r.key === key)?.name ?? null;

const FAMILIES = { Rifles: 'rifle', Pistols: 'pistol', Heavy: 'heavy', LongRange: 'sniper', ShortRange: 'shortRange', Heroes: 'hero', Special: 'special', Specials: 'special', Grenades: 'grenade', Gadgets: 'gadget', Creature: 'creature' };
const familyOf = (name) => {
  const folder = name.split('/')[2] ?? '';
  return FAMILIES[folder] ?? folder.toLowerCase();
};

// `W_BlasterRifle_A280C` → `a280c`.
export const weaponId = (blueprintName) => shortName(blueprintName).split('_').pop().toLowerCase();

const COLOURS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'white'];
const colourIn = (name) => COLOURS.find((c) => new RegExp(`_${c}(_|$)`, 'i').test(name)) ?? null;

// A weapon's blueprint from its ability, its unlock or itself.
function weaponChain(root, name) {
  const chain = { ability: null, unlock: null, blueprint: null, broken: null };
  let asset = follow(root, name);
  for (let hops = 0; asset && hops < 3; hops++) {
    const r = rootOf(asset);
    if (r.$type === 'SoldierWeaponBlueprint') {
      chain.blueprint = asset;
      break;
    }
    const next = r.$type === 'SoldierWeaponUnlockAsset' ? r.NonStreamedBlueprint : r.Unlock;
    if (!next?.$asset) break;
    if (r.$type === 'SoldierWeaponUnlockAsset') chain.unlock = asset;
    else chain.ability = asset;
    asset = follow(root, next);
    // (a hop the export lacks: the chain stops there, and says where)
    if (!asset) chain.broken = next.$asset;
  }
  return chain;
}

const STANCES = ['stand', 'crouch', 'prone', 'moving', 'zoomStand', 'zoomCrouch', 'zoomProne', 'zoomMoving'];

// ── weapons ──────────────────────────────────────────────────────────────

export function weaponRow(root, name) {
  const { blueprint, broken } = weaponChain(root, name);
  if (!blueprint) return broken ? { id: weaponId(name), asset: name, _missing: [`weapon chain: ${broken}`] } : null;
  const missing = [];
  const data = objectsOf(blueprint, 'SoldierWeaponData')[0];
  const row = { id: weaponId(blueprint.name), name: `ID_W_${weaponId(blueprint.name).toUpperCase()}`, family: familyOf(blueprint.name), blueprint: blueprint.name };

  const firingName = refNamed(data, 'WeaponFiring');
  const firing = firingName ? follow(root, firingName) : null;
  if (firingName && !firing) missing.push(`firing: ${firingName}`);
  const wfd = firing && deref(firing, rootOf(firing).Data);
  const fn = wfd && deref(firing, wfd.PrimaryFire);
  if (fn) {
    const f = (row.firing = {});
    take(f, 'rof', firing, fn, 'FireLogic.RateOfFire');
    if (fn.FireLogic.FireLogicType === 'fltBurstFire') {
      take(f, 'burst', firing, fn, 'Shot.NumberOfBulletsPerBurst');
      take(f, 'burstsPerMinute', firing, fn, 'FireLogic.BurstsPerMinute');
    }
    take(f, 'speed', firing, fn, 'Shot.InitialSpeed.z');
    take(f, 'bulletsPerShot', firing, fn, 'Shot.NumberOfBulletsPerShot');
    take(f, 'deploy', firing, wfd, 'DeployTime');
    if (fn.FireLogic.FireLogicType === 'fltHoldAndRelease') {
      f.charge = {};
      for (const [k, p] of [['maxHold', 'MaxHoldTime'], ['minPower', 'MinPowerModifier'], ['maxPower', 'MaxPowerModifier'], ['perSecond', 'PowerIncreasePerSecond']]) take(f.charge, k, firing, fn, `FireLogic.HoldAndRelease.${p}`);
    }
    f.mode = fn.FireLogic.FireLogicType.replace(/^flt/, '').replace(/Fire$/, '').toLowerCase();

    const capacity = fn.Ammo?.MagazineCapacity;
    // (a magazine of −1 is a blaster that heats; so is one whose own overheat config heats a bullet, whatever
    // magazine its firing data keeps: Boba Fett's EE-3 holds 10,000, Bossk's micro-grenades 1,000)
    const lost = [];
    const heats = capacity !== -1 && objectsOf(blueprint, 'OverheatComponentData').length ? heatOf(root, blueprint, firing, fn, lost) : null;
    if (capacity === -1) row.heat = heatOf(root, blueprint, firing, fn, missing);
    else if (heats?.perBullet > 0) {
      row.heat = heats;
      missing.push(...lost);
    } else {
      row.ammo = {};
      take(row.ammo, 'magazine', firing, fn, 'Ammo.MagazineCapacity');
      take(row.ammo, 'magazines', firing, fn, 'Ammo.NumberOfMagazines');
      take(row.ammo, 'reload', firing, fn, fn.FireLogic.ReloadTimeBulletsLeft > 0 ? 'FireLogic.ReloadTimeBulletsLeft' : 'FireLogic.ReloadTime');
    }

    const bolt = reach(root, fn.Shot?.ProjectileData, missing, 'projectile');
    const bullet = bolt && (deref(bolt.asset, rootOf(bolt.asset).Data) ?? bolt.obj);
    if (bullet) {
      const d = (row.damage = { projectile: bolt.asset.name });
      take(d, 'start', bolt.asset, bullet, 'StartDamage');
      take(d, 'end', bolt.asset, bullet, 'EndDamage');
      take(d, 'startDistance', bolt.asset, bullet, 'DamageFalloffStartDistance');
      take(d, 'endDistance', bolt.asset, bullet, 'DamageFalloffEndDistance');
      take(d, 'timeToLive', bolt.asset, bullet, 'TimeToLive');
      const blaster = objectsOf(blueprint, 'BlasterWeaponData')[0];
      take(d, 'min', blueprint, blaster, 'ProjectileParameters.MinDamageMultiplier');
      take(d, 'max', blueprint, blaster, 'ProjectileParameters.MaxDamageMultiplier');
      // (the explosion a record of its own, or kept in the projectile's: the bowcaster's bolt, a micro-grenade)
      const inner = deref(bolt.asset, bullet.Explosion);
      const blast = inner ? { asset: bolt.asset, obj: inner } : reach(root, bullet.Explosion, missing, 'explosion');
      if (blast) {
        d.blast = {};
        for (const [k, p] of [['damage', 'BlastDamage'], ['inner', 'InnerBlastRadius'], ['radius', 'BlastRadius'], ['shockwave', 'ShockwaveRadius'], ['impulse', 'BlastImpulse']]) take(d.blast, k, blast.asset, blast.obj, p);
      }
      row.colour = colourIn(bullet.TrailEffect3P?.$asset ?? bullet.TrailEffect1P?.$asset ?? '');
    }

    const sway = reach(root, wfd.WeaponSway, missing, 'sway');
    if (sway) {
      const gun = objectsOf(sway.asset, 'GunSwayData')[0];
      row.dispersion = (gun?.Dispersion ?? []).slice(0, STANCES.length).map((d, i) => ({
        stance: STANCES[i],
        min: d.MinAngle,
        max: d.MaxAngle,
        perShot: d.IncreasePerShot,
        decay: d.DecreasePerSecond,
        noFireDelay: d.NoFireTimeThreshold,
        _source: where(sway.asset, gun, `Dispersion.${i}`),
      }));
      const recoil = objectsOf(sway.asset, 'CameraRecoilData')[0];
      row.recoil = {};
      take(row.recoil, 'spring', sway.asset, recoil, 'SpringConstant');
      take(row.recoil, 'damping', sway.asset, recoil, 'SpringDamping');
    }
  }

  row.zoom = (data?.ZoomLevels ?? []).map((ref) => deref(blueprint, ref)).filter(Boolean).map((z) => ({ fov: z.RenderFov, zoomIn: z.AnimationSettings?.ZoomInSpeed, zoomOut: z.AnimationSettings?.ZoomOutSpeed, _source: where(blueprint, z, 'RenderFov') }));
  take(row, 'range', blueprint, data, 'MaxRangeMeterDistance');
  const folder = blueprint.name.slice(0, blueprint.name.lastIndexOf('/') + 1);
  row.mods = [...indexOf(root).keys()].filter((n) => n.startsWith(folder) && /^U_.*_(Barrel|Cell|Scope)$/.test(n.slice(folder.length))).map(shortName);
  row._missing = missing;
  return row;
}

function heatOf(root, blueprint, firing, fn, missing) {
  const heat = {};
  const mod = objectsOf(blueprint, 'WeaponOverheatModifier')[0];
  const ref = objectsOf(blueprint, 'OverheatComponentData')[0]?.OverheatConfig;
  // (a hero's ability weapon keeps its config in the blueprint itself, a `$ref` and not a record of its own)
  const own = deref(blueprint, ref);
  const conf = own ? { asset: blueprint, obj: own } : reach(root, ref, missing, 'overheat config');
  const cfg = conf && (own ?? deref(conf.asset, rootOf(conf.asset).Data) ?? conf.obj);
  const or = (key, a, aPath, b, bObj, bPath) => (pick(a.obj, aPath) > 0 ? take(heat, key, a.asset, a.obj, aPath) : bObj && take(heat, key, b, bObj, bPath));
  if (mod?.HeatPerBullet > 0) take(heat, 'perBullet', blueprint, mod, 'HeatPerBullet');
  else if (cfg) take(heat, 'perBullet', conf.asset, cfg, 'HeatPerBullet');
  if (cfg) {
    take(heat, 'dropPerSecond', conf.asset, cfg, 'HeatDropPerSecond');
    take(heat, 'dropDelay', conf.asset, cfg, 'OverheatDropDelay');
    // (a weapon whose heat rises on its own is an ability's clock: Sharpshooter's 0.04 a second)
    if (cfg.HeatIncreasePerSecond > 0) take(heat, 'risePerSecond', conf.asset, cfg, 'HeatIncreasePerSecond');
  } else take(heat, 'dropPerSecond', firing, fn, 'OverHeat.HeatDropPerSecond');
  // (the firing data's threshold and penalty, the config's when it has none)
  or('threshold', { asset: firing, obj: fn }, 'OverHeat.OverHeatThreshold', conf?.asset, cfg, 'OverHeatThreshold');
  or('penalty', { asset: firing, obj: fn }, 'OverHeat.OverHeatPenaltyTime', conf?.asset, cfg, 'OverHeatPenaltyTime');
  if (!cfg) return heat;
  take(heat, 'overheatedDrop', conf.asset, cfg, 'OverheatedDropMultiplier');
  take(heat, 'warning', conf.asset, cfg, 'HeatWarningThreshold');
  const ac = cfg.ActiveCooldownSettings;
  const band = ac?.DifficultyInterval?.[0];
  const sup = band && deref(conf.asset, band.SuperZoneInterval);
  // (active cooling is its window and the super zone inside it: a config that gives no super zone, Bossk's
  // micro-grenades', the dual RK-3's, has no cooling the gun model can run, and the row says none)
  if (ac?.EnableActiveCooldown && sup) {
    const c = (heat.cooling = {});
    withSources(Object.assign(c, { window: [band.Start, band.End] }), { window: where(conf.asset, cfg, 'ActiveCooldownSettings.DifficultyInterval.0.{Start,End}') });
    take(c, 'shrink', conf.asset, cfg, 'ActiveCooldownSettings.DifficultyIncrementation.OnSuccess');
    take(c, 'reset', conf.asset, cfg, 'ActiveCooldownSettings.DifficultyIncrementation.OnFailure');
    take(c, 'successPenalty', conf.asset, cfg, 'ActiveCooldownSettings.SuccessPenaltyTime');
    take(c, 'failurePenalty', conf.asset, cfg, 'ActiveCooldownSettings.FailurePenaltyTime');
    take(c, 'minHeat', conf.asset, cfg, 'ActiveCooldownSettings.MinimumTriggerHeat');
    if (cfg.VentingSettings?.EnableVenting) take(c, 'vent', conf.asset, cfg, 'VentingSettings.Duration');
    withSources(Object.assign(c, { super: [sup.Start, sup.End] }), { super: where(conf.asset, sup, '{Start,End}') });
  }
  return heat;
}

// ── abilities and star cards ─────────────────────────────────────────────
//
// An ability is a `*PlayerAbilityAsset`: its timings on the root, its slot in
// `Category`, its star-card ranks as `PlayerAbilityPropertyOutputModifier`s
// (an output, named only by its hash, and one value per `PlayerAbilityLevel_N`)
// and card-gated overrides as `PlayerAbilityPropertyModifier`s (`ActiveTime`
// values behind a `RequiredUnlockId`). A star card (`SC_*`) is itself an ability.

const KINDS = { BasicPlayerAbilityAsset: 'active', CharacterStatePlayerAbilityAsset: 'state', PassivePlayerAbilityAsset: 'passive', SoldierWeaponPlayerAbilityAsset: 'weapon', InactiveSoldierWeaponPlayerAbilityAsset: 'weapon' };
const slotOf = (category) => (category ?? '').replace(/^PlayerAbilityCategory_/, '').toLowerCase() || null;
const levelOf = (s) => Number(String(s ?? '').replace(/^PlayerAbilityLevel_/, '')) || 0;
const hex = (n) => (n >>> 0).toString(16).toUpperCase().padStart(8, '0');

export function abilityRow(root, name) {
  const asset = follow(root, name);
  if (!asset) return null;
  const r = rootOf(asset);
  const row = { id: shortName(asset.name), asset: asset.name, kind: KINDS[r.$type] ?? 'active', slot: slotOf(r.Category) };
  take(row, 'activation', asset, r, 'ActivationTime');
  if (!r.InfiniteActiveTime) take(row, 'active', asset, r, 'ActiveTime');
  take(row, 'recharge', asset, r, 'RechargeTime');
  if (r.TriggerCost !== undefined) take(row, 'cost', asset, r, 'TriggerCost');
  row.channels = (r.BlockingChannels ?? []).map((ref) => deref(asset, ref)?.Channel).filter(Boolean).map((c) => `${shortName(c.$asset)}:${c.$class}`);
  if (row.kind === 'weapon') {
    const { blueprint } = weaponChain(root, name);
    if (blueprint) row.weapon = weaponId(blueprint.name);
  }
  const ranks = new Map();
  const add = (level, m) => {
    if (!ranks.has(level)) ranks.set(level, []);
    ranks.get(level).push(m);
  };
  for (const ref of r.AbilityModifiers ?? []) {
    const mod = deref(asset, ref);
    if (!mod) continue;
    for (const vref of mod.Values ?? []) {
      const v = deref(asset, vref);
      if (!v) continue;
      if (mod.$type === 'PlayerAbilityPropertyOutputModifier' && typeof v.Value === 'number') {
        for (let l = levelOf(v.MinAbilityLevel); l <= levelOf(v.MaxAbilityLevel); l++) add(l, { property: hex(mod.OutputHash), op: 'set', value: v.Value, _source: where(asset, v, 'Value') });
      } else if (typeof v.ActiveTime === 'number') {
        add(0, { property: 'ActiveTime', op: 'set', value: v.ActiveTime, unlock: hex(mod.RequiredUnlockId ?? 0), _source: where(asset, v, 'ActiveTime') });
      }
    }
  }
  row.ranks = [...ranks.keys()].sort((a, b) => a - b).map((level) => ({ level, level_source: `${asset.name}#PlayerAbilityPropertyOutputModifier.Values.MinAbilityLevel`, modifiers: ranks.get(level) }));
  // (what a blaster hero's ability does, from the records its prefab reaches: bf2017-rulebook-effects.mjs)
  const effect = effectOf(root, row.id, { weaponRow });
  if (effect) row.effect = effect;
  return row;
}

// Whom an ability blocks, and when: the record's `BlockedPlayerAbilityIds` (each the `Identifier` of another
// ability's record) with its two flags, `ApplyBlockPlayerAbilitiesDuringActivation` and `…DuringActive`. The ids
// are named among the rows given and the records in `also` (the heroes' dodge, which no kit lists among its
// three); an id none of them carries (an emote, a melee) is left out. Each row gains
// `blocking: { whom: [ability ids], activation, active }`.
export const BLOCKABLE = ['Gameplay/Kits/Hero/Ability_Evade_CharacterState'];
export function linkBlocks(root, rows, also = BLOCKABLE) {
  const named = new Map();
  const idOf = (name) => {
    const asset = follow(root, name);
    return asset && typeof rootOf(asset).Identifier === 'number' ? rootOf(asset).Identifier >>> 0 : null;
  };
  for (const r of Object.values(rows)) if (idOf(r.asset) !== null) named.set(idOf(r.asset), r.id);
  for (const name of also) if (idOf(name) !== null) named.set(idOf(name), shortName(name));
  for (const r of Object.values(rows)) {
    const a = follow(root, r.asset);
    const rec = a && rootOf(a);
    if (!rec) continue;
    r.blocking = { whom: [...new Set((rec.BlockedPlayerAbilityIds ?? []).map((id) => named.get(id >>> 0)).filter(Boolean))], activation: Boolean(rec.ApplyBlockPlayerAbilitiesDuringActivation), active: Boolean(rec.ApplyBlockPlayerAbilitiesDuringActive) };
  }
  return rows;
}

// A star card: an `SC_*` ability, or a `U_*` unlock naming one.
export function cardRow(root, name) {
  const asset = follow(root, name);
  if (!asset) return null;
  if (rootOf(asset).$type !== 'ValueUnlockAsset') return abilityRow(root, name);
  const folder = name.slice(0, name.lastIndexOf('/') + 1);
  const sc = [...indexOf(root).keys()].find((n) => n.startsWith(folder) && /\/SC_[^/]*$/.test(n));
  return sc ? abilityRow(root, sc) : null;
}

// ── classes ──────────────────────────────────────────────────────────────

// A level's code in the kit and team names (Kit_L_Assault_Orig_HO).
export const MAP_CODES = { hoth_01: 'HO', endor_01: 'EN', mos_eisley_01: 'MOS', yavin_01: 'YA', deathstar02_01: 'DS', scarif_01: 'SCAR', kashyyyk_01: 'KASH', kamino_01: 'KAM', theed_01: 'THEE', geonosis_01: 'GEO', bespin_01: 'BES' };
export const mapCode = (level) => MAP_CODES[level.toLowerCase()] ?? level.toUpperCase();

// A soldier kit (`Kit_*`, WSSoldierCustomizationKitAsset): its gameplay asset
// (`GP_*`) holds the spawn affectors (health, regeneration), the default
// abilities (one per slot) and the unlockable ones (weapons, `SC_*` cards);
// its `PlayerAbilityModifiers` name the default weapon (`DefaultWeapon_*` →
// a weapon unlock).
export function kitRow(root, kitName) {
  const kit = follow(root, kitName);
  if (!kit) return null;
  const k = rootOf(kit);
  const missing = [];
  const row = { kit: kit.name, factionAsset: k.WSFaction ? shortName(k.WSFaction.$asset) : null };
  const gp = reach(root, k.Gameplay, missing, 'gameplay');
  for (const v of (gp && gp.obj.AffectorsAppliedOnSpawn) ?? []) {
    const a = reach(root, v, missing, 'affector');
    if (!a) continue;
    if (a.obj.$type === 'MaxHealthAffectorAsset') take(row, 'health', a.asset, a.obj, 'MaxHealth');
    if (a.obj.$type === 'SoldierHealthRegenerationAffectorAsset') {
      row.regen = {};
      take(row.regen, 'rate', a.asset, a.obj, 'RankData.0.RegenerationRate');
      take(row.regen, 'delay', a.asset, a.obj, 'RankData.0.RegenerationDelay');
    }
  }
  for (const v of k.PlayerAbilityModifiers ?? []) {
    const m = reach(root, v, missing, 'default weapon');
    const unlock = m && m.obj.UnlockToCreate && reach(root, m.obj.UnlockToCreate, missing, 'weapon unlock');
    const bp = unlock?.obj.NonStreamedBlueprint?.$asset;
    if (bp) Object.assign(row, { weapon: weaponId(bp), weapon_source: `${m.asset.name}#${m.obj.$type}.UnlockToCreate`, weaponUnlock: unlock.asset.name });
  }
  const custom = gp && deref(gp.asset, gp.obj.Abilities);
  const listed = (key) => (custom?.[key] ?? []).filter((v) => v?.$asset);
  row.abilities = listed('DefaultAbilities')
    .map((v) => ({ v, a: follow(root, v) }))
    .filter(({ a }) => a && ['left', 'middle', 'right'].includes(slotOf(rootOf(a).Category)))
    .map(({ v, a }) => ({ slot: slotOf(rootOf(a).Category), id: shortName(v.$asset), asset: v.$asset }));
  row.abilities.sort((a, b) => ['left', 'middle', 'right'].indexOf(a.slot) - ['left', 'middle', 'right'].indexOf(b.slot));
  // (the primary weapon a hero or a reinforcement spawns with: its default ability in the primary slot)
  const primary = listed('DefaultAbilities').find((v) => slotOf(rootOf(follow(root, v) ?? { root: 0, objects: [{}] }).Category) === 'primary');
  row.primaryAsset = primary ? primary.$asset : null;
  const extra = listed('AdditionalAbilities').map((v) => v.$asset);
  row.cards = extra.filter((n) => shortName(n).startsWith('SC_')).map(shortName);
  row.cardAssets = extra.filter((n) => shortName(n).startsWith('SC_'));
  row.weapons = extra.filter((n) => /\/Ability_Weapon_[^/]*$/.test(n)).map((n) => weaponChain(root, n).blueprint).filter(Boolean).map((b) => weaponId(b.name));
  row.weaponAssets = extra.filter((n) => /\/Ability_Weapon_[^/]*$/.test(n));
  // (no DefaultWeapon_* on the kit: the weapon table's primary part, at its default index)
  if (!row.weapon) {
    const unlocks = new Set(
      row.weaponAssets
        .map((n) => {
          const a = follow(root, n);
          if (!a) missing.push(`weapon ability: ${n}`);
          return a ? rootOf(a).Unlock?.$asset : null;
        })
        .filter(Boolean),
    );
    const table = deref(kit, k.WeaponTable);
    for (const ref of table?.UnlockParts ?? []) {
      const part = deref(kit, ref);
      const pickd = part?.SelectableUnlocks?.[part.DefaultSelectionIndex ?? 0];
      if (!part?.SelectableUnlocks?.some((u) => unlocks.has(u?.$asset)) || !pickd) continue;
      const unlock = follow(root, pickd);
      if (!unlock) missing.push(`weapon unlock: ${pickd.$asset}`);
      const bp = unlock && rootOf(unlock).NonStreamedBlueprint?.$asset;
      if (bp) Object.assign(row, { weapon: weaponId(bp), weapon_source: `${kit.name}#CustomizationUnlockParts.SelectableUnlocks.${part.DefaultSelectionIndex ?? 0}`, weaponUnlock: pickd.$asset });
      break;
    }
  }
  row._missing = missing;
  return row;
}

export function classRow(root, cls, era, faction, { level = 'hoth_01' } = {}) {
  const folder = `Gameplay/Kits/MP/${cls}/`;
  const kitName = `${folder}Kit_${faction}_${cls}_${era}_${mapCode(level)}`;
  const kit = kitRow(root, kitName);
  if (!kit) return null;
  const kits = [...indexOf(root).keys()].filter((n) => n.startsWith(`${folder}Kit_${faction}_${cls}_${era}_`) && !/Skirmish/.test(n)).map(shortName);
  return { id: `${faction}-${era}-${cls}`.toLowerCase(), cls: cls.toLowerCase(), era, faction, name: [`ID_C_${cls.toUpperCase()}_TROOPER`, `ID_C_${cls.toUpperCase()}`], ...kit, kits };
}

// ── heroes, reinforcements, vehicles ─────────────────────────────────────

// A kit's side, from the side affector its gameplay asset applies on spawn
// (Affector_Hero_DarkSide, Affector_Special_LightSide).
function sideOf(root, kit) {
  const gp = kit && follow(root, rootOf(kit).Gameplay);
  const names = (gp ? rootOf(gp).AffectorsAppliedOnSpawn ?? [] : []).map((v) => v?.$asset ?? '');
  if (names.some((n) => /DarkSide/.test(n))) return 'dark';
  if (names.some((n) => /LightSide/.test(n))) return 'light';
  return null;
}

// A hero (`Gameplay/Kits/Hero/<Hero>/…/Kit_Hero_*`): a kit row, its side, its
// armour star-card health levels (`Affector_Health_*Armor1..4`), its saber
// (the deflect unlock, the soldier blueprint's specialisation) and the clip
// family its blueprint names (Hero_Lightsaber_DarthVader → DarthVader).
export function heroRow(root, kitName, { side = null } = {}) {
  const kit = follow(root, kitName);
  const base = kitRow(root, kitName);
  if (!base) return null;
  const folder = kitName.split('/').slice(0, 4).join('/') + '/';
  const names = [...indexOf(root).keys()].filter((n) => n.startsWith(folder));
  const armour = names.filter((n) => /\/Affector_Health_[^/]*Armor\d$/.test(n)).sort();
  const blueprint = rootOf(kit).Blueprint?.$asset ?? '';
  const deflect = names.find((n) => /\/U_Lightsaber_Deflect_[^/]*$/.test(n));
  const primary = base.primaryAsset;
  const id = folder.split('/')[3].toLowerCase();
  // (a hero whose kit applies no regeneration on spawn, Leia: her own regeneration record in her folder)
  if (!base.regen) {
    const own = names.filter((n) => /\/Affector_[^/]*HealthRegen$/.test(n)).map((n) => follow(root, n)).find((a) => a && rootOf(a).$type === 'SoldierHealthRegenerationAffectorAsset');
    if (own) {
      base.regen = {};
      take(base.regen, 'rate', own, rootOf(own), 'RankData.0.RegenerationRate');
      take(base.regen, 'delay', own, rootOf(own), 'RankData.0.RegenerationDelay');
    }
  }
  return {
    ...base,
    id,
    name: [`ID_CHAR_${id.toUpperCase()}`],
    side: side ?? sideOf(root, kit),
    armour: armour.map((n) => follow(root, n)).filter(Boolean).map((a) => rootOf(a).MaxHealth),
    ...(armour.length ? { armour_source: armour.map((n) => `${n}#MaxHealthAffectorAsset.MaxHealth`).join(' ') } : {}),
    primary: primary ? shortName(primary) : null,
    primaryAsset: primary,
    // (the weapons rulebook's row for that primary: a blaster hero's own gun)
    ...(primary && weaponChain(root, primary).blueprint ? { weapon: weaponId(weaponChain(root, primary).blueprint.name), weapon_source: `${primary}#${rootOf(follow(root, primary)).$type}.Unlock` } : {}),
    saber: /Lightsaber/.test(blueprint) ? { blueprint: shortName(blueprint), deflect: deflect ? shortName(deflect) : null } : null,
    clipPrefix: shortName(blueprint).replace(/^Hero_(Lightsaber|Weapon)_?/, '') || null,
  };
}

const REINFORCEMENT_KINDS = { Class_Special_Enforcer: 'enforcer', Class_Special_Jumptrooper: 'aerial', Class_Special_Infiltrator: 'infiltrator' };

// A reinforcement (`Gameplay/Kits/Specials/<Name>/Kit_Special_*`): a kit row
// and its kind, from the class its gameplay asset names.
export function reinforcementRow(root, kitName) {
  const kit = follow(root, kitName);
  const base = kitRow(root, kitName);
  if (!base) return null;
  const gp = follow(root, rootOf(kit).Gameplay);
  const cls = gp && rootOf(gp).Class?.$asset;
  return { ...base, id: kitName.split('/')[3], kind: REINFORCEMENT_KINDS[shortName(cls ?? '')] ?? null, side: sideOf(root, kit) };
}

const VEHICLE_KINDS = { Ground: 'ground', Air: 'air', Stationary: 'stationary', Mount: 'mount', Capital: 'capital', Corvette: 'capital', SpaceBattles: 'air' };
const ROLES = { EST_Driver: 'driver', EST_Gunner: 'gunner', EST_Passenger: 'passenger', EST_Pilot: 'driver' };

// A vehicle, from its kit (`Kit_Vehicle_*` → its VehicleBlueprint) or its
// blueprint: health from the `*HealthComponentData`, seats from the entry
// components in `EntryOrderNumber` order, weapons from each
// `WeaponComponentData`'s firing data (inline in the blueprint), abilities
// from the ability set component, overheat from the blueprint's config.
export function vehicleRow(root, name) {
  const first = follow(root, name);
  if (!first) return null;
  const missing = [];
  const isKit = rootOf(first).$type === 'WSVehicleCustomizationKitAsset';
  const bp = isKit ? reach(root, rootOf(first).Blueprint, missing, 'blueprint')?.asset : first;
  const row = { id: shortName(name), blueprint: bp?.name ?? null, kind: VEHICLE_KINDS[(bp?.name ?? '').split('/')[2]] ?? null };
  if (!bp) return Object.assign(row, { _missing: missing });
  // (the largest; a mount's is 1, its rider takes the hits)
  const health = bp.objects.filter((o) => /HealthComponentData$/.test(o?.$type ?? '') && o.MaxHealth > 0).sort((a, b) => b.MaxHealth - a.MaxHealth)[0];
  take(row, 'health', bp, health, 'MaxHealth');
  row.seats = bp.objects
    .filter((o) => /EntryComponentData$/.test(o?.$type ?? ''))
    .sort((a, b) => (a.EntryOrderNumber ?? 0) - (b.EntryOrderNumber ?? 0))
    .map((e) => ({ role: ROLES[e.HudData?.SeatType] ?? (e.EntryOrderNumber === 0 ? 'driver' : 'gunner'), camera: e.CameraIndex ?? null, _source: where(bp, e, 'EntryOrderNumber') }));
  row.weapons = objectsOf(bp, 'WeaponComponentData').map((w) => {
    const wfd = deref(bp, w.WeaponFiring);
    const fn = wfd && deref(bp, wfd.PrimaryFire);
    const out = { name: w.DamageGiverName || null };
    if (!fn) return out;
    take(out, 'rof', bp, fn, 'FireLogic.RateOfFire');
    take(out, 'speed', bp, fn, 'Shot.InitialSpeed.z');
    const bolt = fn.Shot?.ProjectileData;
    const bullet = bolt?.$ref !== undefined ? { asset: bp, obj: deref(bp, bolt) } : reach(root, bolt, missing, 'vehicle projectile');
    const b = bullet?.obj && (bullet.obj.$type === 'GameDataContainerAsset' ? deref(bullet.asset, bullet.obj.Data) : bullet.obj);
    if (b) {
      take(out, 'damage', bullet.asset, b, 'StartDamage');
      take(out, 'damageEnd', bullet.asset, b, 'EndDamage');
      const blast = b.Explosion?.$ref !== undefined ? { asset: bullet.asset, obj: deref(bullet.asset, b.Explosion) } : reach(root, b.Explosion, missing, 'explosion');
      if (blast?.obj) take(out, 'blast', blast.asset, blast.obj, 'BlastDamage');
    }
    return out;
  });
  const set = objectsOf(bp, 'WSNonCustomizablePlayerAbilitySetComponentData')[0];
  row.abilities = (set?.Abilities ?? []).filter((v) => v?.$asset).map((v) => shortName(v.$asset));
  const oh = objectsOf(bp, 'OverheatConfig')[0];
  if (oh) {
    row.overheat = {};
    take(row.overheat, 'perBullet', bp, oh, 'HeatPerBullet');
    take(row.overheat, 'dropPerSecond', bp, oh, 'HeatDropPerSecond');
    take(row.overheat, 'penalty', bp, oh, 'OverHeatPenaltyTime');
  }
  row._missing = missing;
  return row;
}

// ── teams ────────────────────────────────────────────────────────────────

const kitsIn = (root, v, missing, what) => {
  const list = reach(root, v, missing, what);
  return (list?.obj.Kits ?? []).filter((k) => k?.$asset).map((k) => k.$asset);
};

// One side of a level's teams (`Gameplay/Teams/MP/<Era>/Team_<Side>_<Era>_<MAP>`):
// the kit lists it points at, by row id, the sequel era refused.
function sideRow(root, era, level, side, refused) {
  const name = `Gameplay/Teams/MP/${era}/Team_${side}_${era}_${mapCode(level)}`;
  const team = follow(root, name);
  if (!team) return null;
  const t = rootOf(team);
  const missing = [];
  // (a refused kit is listed; a refused ability or voice line is only dropped)
  const keep = (names) => names.filter((n) => (isSequelName(n) ? (refused.push(shortName(n)), false) : true));
  const drop = (names) => names.filter((n) => !isSequelName(n));
  const soldiers = keep((deref(team, t.Soldiers)?.Kits ?? []).filter((k) => k?.$asset).map((k) => k.$asset));
  return {
    team: name,
    faction: t.WSFaction ? shortName(t.WSFaction.$asset) : null,
    classes: soldiers.map((n) => {
      const [, , , cls] = n.split('/');
      return `${side[0]}-${era}-${cls}`.toLowerCase();
    }),
    classKits: soldiers,
    heroes: keep(kitsIn(root, t.Heroes, missing, 'heroes')).map((n) => n.split('/')[3].toLowerCase()),
    heroKits: keep(kitsIn(root, t.Heroes, missing, 'heroes')),
    reinforcements: keep(kitsIn(root, t.SpecialSoldiers, missing, 'specials')).map((n) => n.split('/')[3]),
    reinforcementKits: keep(kitsIn(root, t.SpecialSoldiers, missing, 'specials')),
    vehicles: keep(kitsIn(root, t.Vehicles, missing, 'vehicles')).map(shortName),
    vehicleKits: keep(kitsIn(root, t.Vehicles, missing, 'vehicles')),
    heroVehicles: keep(kitsIn(root, t.HeroVehicles, missing, 'hero vehicles')).map(shortName),
    abilities: drop((t.AllPlayerAbilities ?? []).filter((v) => v?.$asset).map((v) => v.$asset)).map(shortName),
    emotes: drop((t.AllPlayerEmotes ?? []).filter((v) => v?.$asset).map((v) => v.$asset)).map(shortName),
    voiceLines: drop((t.AllPlayerVoiceLines ?? []).filter((v) => v?.$asset).map((v) => v.$asset)).map(shortName),
    _missing: missing,
  };
}

export function teamRow(root, era, level) {
  const refused = [];
  const light = sideRow(root, era, level, 'Light', refused);
  const dark = sideRow(root, era, level, 'Dark', refused);
  return { era, level, light, dark, refused: [...new Set(refused)] };
}
