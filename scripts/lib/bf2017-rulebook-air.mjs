// The air rulebook (the sixth design's lane fighters: docs/superpowers/
// plans/2026-10-10-bf2017-accuracy-lane-fighters.md, task 1): every air
// vehicle of `Gameplay/Vehicles/Air/` the era rule allows, read from its
// blueprint and its layers, so Starfighter Assault flies on the game's
// numbers (src/lib/flight/starfighter.js, fighterWeapons.js) and fields the
// game's kits (galaxy/surface/missions/starfighter.js).
//
// airRulebook(root) → { vehicles, kits, heroes, names, refused, _missing }:
//
// - vehicles[id] (id the blueprint's folder, lower-cased: `xwing_t65`):
//   `handling` (the `_Handling` layer's StarfighterConfigEntityData, every
//   number, vector and curve of it: maxSpeed 100, boostMaxSpeed 115 and the
//   rest; the layer holds a config per game context, which differ in
//   MinSpeed alone on every kind: the first is taken and the others' minimum
//   speeds listed), `weapons` (the primary cannon: rate of fire from the
//   blueprint's firing function, the bolt from the `_Weapons` layer's
//   projectile override: speed, damage near and far, its falloff and life;
//   the overheat; the overcharged bolt where the layer has one), `health`
//   (StarfighterHealthComponentData, and the vehicle's regeneration delay
//   and rate), `targeting` (the locking target: its radius and heat), `camera`
//   (the `_Camera` layer's follow and cockpit configs), `abilities` (the
//   kit's gameplay record's abilities, each its kind, slot, recharge, active
//   and activation times; a torpedo's shots and lock time), `cards` (the
//   star cards it may take), `destruction` (the spin-out), `mesh` (the
//   blueprint's meshes, its engine effects and pilot apart), `class`
//   (fighter, interceptor or bomber: the kit's class record), `hero`.
// - kits[era][side]: the kinds each side flies in Starfighter Assault
//   (`Gameplay/Teams/Space/Vehicles_<Side>_<Era>_Space`), in the game's
//   order (fighter, interceptor, bomber).
// - heroes: `PF_KitLimitations_SpaceBattles`'s hero ships by side, its
//   limit at once and their price (Battle Points).
// - names[faction]: the bots' names in the mode (`AINames_*_SpaceBattles`).
//
// Every number names its record (`_source` on the object that holds it, or
// `<key>_source` beside it), as the rulebooks' test asks. The sequel's
// ships are refused and listed, by the manifest's rule and the few names it
// lacks (AIR_REFUSED).

import { deref, follow, isSequel, numbersOf, objectsOf, pointee, rootOf, shortName } from './bf2017-ebx.mjs';
import { indexOf } from './bf2017-rulebook.mjs';

// the sequel trilogy's ships the manifest's words don't catch, and the seasons' folders (S1, A3: the sequel's)
export const AIR_REFUSED = ['awingrz3', 'tieinterceptor_hask', 'tiestriker', 'millenniumfalcon_nt', 'kylorenship', 'resistancetransport', 'xwing_t70blackone', 'firstorder', 'resistance'];
export const refusedAir = (name) => isSequel(name) || /^(S1|A3)\//i.test(name) || AIR_REFUSED.some((k) => name.toLowerCase().includes(k));

const AIR = 'Gameplay/Vehicles/Air/';
const where = (asset, obj, path = '') => `${asset.name}#${obj.$type}${path ? `.${path}` : ''}`;
const camel = (k) => k.charAt(0).toLowerCase() + k.slice(1);
const vec = (v) => (v && typeof v === 'object' && 'x' in v ? ['x', 'y', 'z', 'w'].filter((k) => k in v).map((k) => v[k]) : null);
const CURVE_TYPES = { FloatCurveType_Smooth: 'smooth', FloatCurveType_Spline: 'spline', FloatCurveType_Linear: 'linear', FloatCurveType_Constant: 'constant' };

// a FloatCurve as points [x, y, inX, inY, outX, outY] (the tangents as the
// game's offsets from the point) and its kind per point
export function curveOf(c) {
  if (!c?.Points) return null;
  return {
    points: c.Points.map((p) => [p.X, p.Y, p.InTangentOffsetX, p.InTangentOffsetY, p.OutTangentOffsetX, p.OutTangentOffsetY]),
    kinds: c.Points.map((p) => CURVE_TYPES[p.CurveType] ?? 'linear'),
    min: c.MinX,
    max: c.MaxX,
  };
}

// every value of a config object: numbers and booleans as they are, vectors
// as arrays, curves resolved (`skip` keys left out)
function configOf(asset, obj, skip = ['Flags', 'Realm']) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('$') || skip.includes(k)) continue;
    if (typeof v === 'number' || typeof v === 'boolean') out[camel(k)] = v;
    else if (vec(v)) out[camel(k)] = vec(v);
    else if (typeof v?.$ref === 'number') {
      const c = curveOf(deref(asset, v));
      if (c) out[camel(k)] = c;
    }
  }
  return out;
}

// a record of the vehicle's folder by its suffix (`_Handling`), ignoring case
function layer(root, blueprint, suffix) {
  const dir = blueprint.slice(0, blueprint.lastIndexOf('/') + 1).toLowerCase();
  const want = `_${suffix}`.toLowerCase();
  const hits = [...indexOf(root).keys()].filter((n) => n.toLowerCase().startsWith(dir) && n.toLowerCase().endsWith(want) && !n.slice(dir.length).includes('/'));
  // (the blueprint's own name first: the Y-wing's folder holds the BTL's too)
  hits.sort((a, b) => Number(!a.toLowerCase().startsWith(blueprint.toLowerCase())) - Number(!b.toLowerCase().startsWith(blueprint.toLowerCase())));
  return hits.length ? follow(root, hits[0]) : null;
}

export function handlingRow(asset) {
  const configs = objectsOf(asset, 'StarfighterConfigEntityData');
  if (!configs.length) return null;
  const c = configs[0];
  const row = configOf(asset, c);
  return { ...row, configs: configs.length, minSpeeds: [...new Set(configs.map((x) => x.MinSpeed))], _source: where(asset, c) };
}

// a projectile's bolt: `{ asset, obj }` of its WSBulletEntityData
function boltOf(root, v) {
  const p = v?.$ref !== undefined ? null : pointee(root, v);
  if (!p) return null;
  const obj = p.obj.$type === 'GameDataContainerAsset' ? deref(p.asset, p.obj.Data) : p.obj;
  return obj ? { asset: p.asset, obj } : null;
}

function projectileRow(root, override, missing) {
  const fp = override.FireProjectileData;
  const bolt = boltOf(root, fp?.ProjectileData);
  if (!bolt) {
    if (fp?.ProjectileData?.$asset) missing.push(`projectile: ${fp.ProjectileData.$asset}`);
    return null;
  }
  const b = bolt.obj;
  const blast = deref(bolt.asset, b.Explosion);
  return {
    projectile: shortName(bolt.asset.name),
    speed: fp.Speed,
    speed_source: `${override.$type}.FireProjectileData.Speed`,
    damage: b.StartDamage,
    damageFar: b.EndDamage,
    falloff: [b.DamageFalloffStartDistance, b.DamageFalloffEndDistance],
    life: b.TimeToLive,
    ...(blast ? { blast: blast.BlastDamage, blastRadius: blast.BlastRadius } : {}),
    _source: where(bolt.asset, b),
  };
}

export function weaponsRow(root, bp, weapons, missing) {
  // (the blueprint's own cannon: a WeaponComponentData whose firing is in the blueprint)
  const cannon = objectsOf(bp, 'WeaponComponentData')
    .map((w) => deref(bp, w.WeaponFiring))
    .find(Boolean);
  const fn = cannon && deref(bp, cannon.PrimaryFire);
  const row = {};
  if (fn) {
    row.rateOfFire = fn.FireLogic.RateOfFire;
    row.rateOfFire_source = where(bp, fn, 'FireLogic.RateOfFire');
  }
  const oh = objectsOf(bp, 'OverheatConfig')[0];
  if (oh) row.overheat = { perShot: oh.HeatPerBullet, dropPerSecond: oh.HeatDropPerSecond, overheatedDrop: oh.OverheatedDropMultiplier, penalty: oh.OverHeatPenaltyTime, _source: where(bp, oh) };
  if (weapons) {
    // (the layer's projectile overrides: the cannon's own, and the one an ability's unlock names: the overcharge)
    const overrides = objectsOf(weapons, 'FireProjectileEntityOverrideData');
    const own = overrides.find((o) => !/Abilities\//.test(o.FireProjectileData?.UnlockAsset?.$asset ?? '')) ?? overrides[0];
    const charged = overrides.find((o) => o !== own && /Abilities\//.test(o.FireProjectileData?.UnlockAsset?.$asset ?? ''));
    if (own) row.bolt = projectileRow(root, own, missing);
    if (charged) row.overcharged = { ...projectileRow(root, charged, missing), by: shortName(charged.FireProjectileData.UnlockAsset.$asset) };
    const ohs = objectsOf(weapons, 'OverheatComponentOverrideEntityData').filter((o) => o.HeatPerBullet > 0);
    if (ohs.length) row.overheatOverrides = ohs.map((o) => ({ perShot: o.HeatPerBullet, dropPerSecond: o.HeatDropPerSecond, overheatedDrop: o.OverheatedDropMultiplier, penalty: o.OverHeatPenaltyTime, _source: where(weapons, o) }));
  }
  return row;
}

export function healthRow(bp) {
  const h = objectsOf(bp, 'StarfighterHealthComponentData')[0];
  if (!h) return null;
  const row = { max: h.MaxHealth, repair: h.RepairAmount, damageScale: h.StarfighterDamageScale, collisionAngle: h.CollisionAngle, glancing: h.GlancingDamageModifier, friendlyRam: h.FriendlyDamage, enemyRam: h.EnemyDamage, _source: where(bp, h) };
  const v = objectsOf(bp, 'VehicleEntityData')[0];
  const regen = v ? numbersOf(v).filter(([p]) => /Regeneration(Delay|Rate)$/.test(p)) : [];
  for (const [p, n] of regen) {
    const key = p.endsWith('Delay') ? 'regenDelay' : 'regenRate';
    row[key] = n;
    row[`${key}_source`] = where(bp, v, p);
  }
  return row;
}

export function targetingRow(bp) {
  const t = objectsOf(bp, 'LockingTargetComponentData')[0];
  if (!t) return null;
  return { radius: t.Radius, heat: t.LockableInfo?.HeatSignature ?? null, lockTimeScale: t.LockingTimeMultiplier, lockable: t.IsLockable, _source: where(bp, t) };
}

export function cameraRow(asset) {
  if (!asset) return null;
  const out = {};
  for (const [type, key] of [['FollowCameraConfigEntityData', 'follow'], ['CockpitCameraConfigEntityData', 'cockpit'], ['RearViewCameraConfigEntityData', 'rear']]) {
    const o = objectsOf(asset, type)[0];
    if (o) out[key] = { ...configOf(asset, o), _source: where(asset, o) };
  }
  return Object.keys(out).length ? out : null;
}

export function destructionRow(asset) {
  if (!asset) return null;
  const out = {};
  for (const [type, key] of [['StarfighterSpinoutPhysicsActionData', 'spinout'], ['StarfighterOverlapConfigEntityData', 'overlap']]) {
    const o = objectsOf(asset, type)[0];
    if (o) out[key] = { ...configOf(asset, o), _source: where(asset, o) };
  }
  return Object.keys(out).length ? out : null;
}

// an ability record: its kind, slot and times (a vehicle weapon's shots too; a torpedo's lock from its missile controller)
export function abilityOf(root, name) {
  const p = pointee(root, name);
  if (!p) return null;
  const a = p.obj;
  const row = { id: shortName(name), kind: a.$type.replace(/PlayerAbilityAsset$/, '').toLowerCase(), slot: (a.Category ?? '').replace('PlayerAbilityCategory_', '').toLowerCase() || null };
  for (const [k, key] of [['RechargeTime', 'recharge'], ['ActiveTime', 'active'], ['ActivationTime', 'activation'], ['DelayBetweenShots', 'betweenShots'], ['ProjectileCount', 'shots'], ['DumbFireCooldown', 'dumbFireCooldown']]) if (typeof a[k] === 'number') row[key] = a[k];
  if (a.InfiniteActiveTime) row.active = null;
  row._source = where(p.asset, a);
  // (a torpedo or missile: the missile controller of its own name, `StarFighterMissileController_<Name>`)
  const tail = shortName(name).replace(/^(VehicleWeaponAbility_|Ability_)/, '');
  const ctl = follow(root, `Gameplay/Vehicles/Abilities/Starfighters/StarFighterMissileController_${tail}`);
  const lock = ctl && objectsOf(ctl, 'WSManualLockingWeaponData')[0];
  const target = lock && deref(ctl, lock.TargetLockController);
  if (target) row.lock = { time: target.LockTime, release: target.ReleaseTime, _source: where(ctl, target) };
  return row;
}

const CLASSES = { Class_Vehicle_Fighter: 'fighter', Class_Vehicle_Interceptor: 'interceptor', Class_Vehicle_Bomber: 'bomber' };

// the kits: blueprint → { kit, gameplay record, its identifier, class, abilities }
function kitsOf(root) {
  const out = new Map();
  for (const [name, e] of indexOf(root)) {
    if (e.type !== 'WSVehicleCustomizationKitAsset' || refusedAir(name)) continue;
    const kit = follow(root, name);
    const k = kit && rootOf(kit);
    if (!k?.Blueprint?.$asset?.startsWith(AIR)) continue;
    const gp = k.Gameplay?.$asset ? pointee(root, k.Gameplay) : null;
    const g = gp?.obj;
    const coll = g && gp.asset.objects.find((o) => o?.$type === 'PlayerAbilityCollection');
    const custom = g && gp.asset.objects.find((o) => o?.$type === 'PlayerAbilityCustomization');
    out.set(k.Blueprint.$asset, {
      kit: name,
      gameplay: gp?.asset.name ?? null,
      identifier: g?.Identifier ?? null,
      class: CLASSES[shortName(g?.Class?.$asset ?? '')] ?? null,
      class_source: g?.Class ? where(gp.asset, g, 'Class') : null,
      abilities: (coll?.Abilities ?? []).filter((a) => a?.$asset).map((a) => a.$asset),
      cards: (custom?.AdditionalAbilities ?? []).filter((a) => a?.$asset).map((a) => shortName(a.$asset)),
    });
  }
  return out;
}

const idOf = (blueprint) => blueprint.slice(AIR.length).split('/')[0].toLowerCase();

export function airRow(root, blueprint, kit, missing = []) {
  const bp = follow(root, blueprint);
  if (!bp) return null;
  const row = { id: idOf(blueprint), blueprint, kit: kit?.kit ?? null, class: kit?.class ?? null, ...(kit?.class_source ? { class_source: kit.class_source } : {}) };
  const handling = layer(root, blueprint, 'Handling');
  row.handling = handling ? handlingRow(handling) : null;
  row.weapons = weaponsRow(root, bp, layer(root, blueprint, 'Weapons'), missing);
  row.health = healthRow(bp);
  row.targeting = targetingRow(bp);
  row.camera = cameraRow(layer(root, blueprint, 'Camera'));
  row.destruction = destructionRow(layer(root, blueprint, 'Destruction'));
  // (the kit's passive rows are its star cards: named, not timed)
  const all = (kit?.abilities ?? []).filter((n) => !refusedAir(n)).map((n) => abilityOf(root, n) ?? (missing.push(`ability: ${n}`), null)).filter(Boolean);
  row.abilities = all.filter((a) => a.kind !== 'passive');
  row.cards = [...new Set([...all.filter((a) => a.kind === 'passive').map((a) => a.id), ...(kit?.cards ?? [])])];
  const meshes = objectsOf(bp, 'MeshComponentData').map((m) => m.Mesh?.$asset).filter(Boolean);
  row.mesh = { body: meshes.filter((m) => !/^fx\/|\/pilots\//i.test(m)), engines: meshes.filter((m) => /^fx\//i.test(m)).length, pilot: meshes.find((m) => /\/pilots\//i.test(m)) ?? null, _source: `${bp.name}#MeshComponentData.Mesh` };
  return row;
}

// the kit lists' kinds by era and side, in the game's order
function kitLists(root, byKit) {
  const out = {};
  for (const era of ['Orig', 'Preq']) {
    out[era.toLowerCase()] = {};
    for (const side of ['Light', 'Dark']) {
      const name = `Gameplay/Teams/Space/Vehicles_${side}_${era}_Space`;
      const list = follow(root, name);
      const kits = list ? (rootOf(list).Kits ?? []).filter((k) => k?.$asset).map((k) => k.$asset) : [];
      out[era.toLowerCase()][side.toLowerCase()] = kits.map((k) => byKit.get(k)).filter(Boolean);
      out[era.toLowerCase()][`${side.toLowerCase()}_source`] = `${name}#WSVehicleCustomizationKitList.Kits`;
    }
  }
  return out;
}

// the hero ships the mode's kit limitation names, by side (light the first limitation's groups, dark the other's)
function heroesOf(root, kits) {
  const lim = follow(root, 'Gameplay/GameModes/SpaceBattles/PF_KitLimitations_SpaceBattles');
  if (!lim) return null;
  const byId = new Map([...kits].filter(([, k]) => k.identifier !== null).map(([bp, k]) => [k.identifier >>> 0, bp]));
  const rows = objectsOf(lim, 'KitLimitationEntityData');
  const sets = [...new Map(rows.map((r) => [JSON.stringify(r.LimitationGroups.map((g) => g.Limitations.map((l) => l.KitId))), r])).values()];
  const sides = sets.map((r) => r.LimitationGroups.flatMap((g) => g.Limitations.map((l) => byId.get(l.KitId >>> 0)).filter((bp) => bp && !refusedAir(bp)).map(idOf)));
  // (the light side's is the one with the Falcon)
  const light = sides.findIndex((s) => s.includes('millenniumfalcon'));
  const price = objectsOf(lim, 'IntEntityData').find((i) => i.DefaultValue > 100);
  return {
    light: sides[light] ?? [],
    dark: sides[1 - light] ?? sides.find((_, i) => i !== light) ?? [],
    atOnce: sets[0]?.MaxKitCount ?? null,
    price: price?.DefaultValue ?? null,
    _source: where(lim, sets[0] ?? rows[0]),
  };
}

const FACTIONS = { Empire: 'empire', Rebel_Resistance: 'rebel', Republic: 'republic', Separatists: 'separatists' };
function namesOf(root) {
  const out = {};
  for (const [file, key] of Object.entries(FACTIONS)) {
    const name = `Gameplay/GameModes/SpaceBattles/AINames_${file}_SpaceBattles`;
    const a = follow(root, name);
    if (a) out[key] = rootOf(a).Names;
  }
  return out;
}

export function airRulebook(root) {
  const missing = [];
  const refused = [];
  const kits = kitsOf(root);
  const blueprints = [...indexOf(root)]
    .filter(([n, e]) => e.type === 'VehicleBlueprint' && n.startsWith(AIR) && n.split('/').length === 5 && !/_SP$/i.test(n))
    .map(([n]) => n)
    .filter((n) => (refusedAir(n) ? (refused.push(idOf(n)), false) : true))
    .sort();
  const vehicles = {};
  // (the gunships, the LAAT and the U-wing, fly on another model: no starfighter handling)
  const gunships = [];
  for (const b of blueprints) {
    const row = airRow(root, b, kits.get(b), missing);
    if (row?.handling) vehicles[row.id] = row;
    else gunships.push(idOf(b));
  }
  const byKit = new Map([...kits.values()].map((k) => [k.kit, null]));
  for (const [bp, k] of kits) if (vehicles[idOf(bp)]) byKit.set(k.kit, idOf(bp));
  const heroes = heroesOf(root, kits);
  for (const id of [...(heroes?.light ?? []), ...(heroes?.dark ?? [])]) if (vehicles[id]) vehicles[id].hero = true;
  return { vehicles, kits: kitLists(root, byKit), heroes, names: namesOf(root), refused: [...new Set(refused)].sort(), gunships, _missing: [...new Set(missing)] };
}
