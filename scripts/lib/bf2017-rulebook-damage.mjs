// The damage rulebook (the hulls plan's Task 7: docs/superpowers/plans/
// 2026-10-14-galaxy-space-hulls.md; the rules proven in bf2-re's
// findings/62-space-hits-and-damage.md): what a bolt does in space, as the
// game's records hold it, for src/lib/combat/damage.js to apply to every
// bolt the galaxy fires. Written by `node scripts/bf2017-data.mjs damage`
// into src/data/bf2017/damage.json.
//
// damageRulebook(root, { kits, header, … }) → { _notes, gridFrom, grid,
//   noRelation, squadBonus, fighters, capitals, stand, _missing }:
//
// - grid[attacker][target]: the material grid's damage relation for a pair
//   of properties (a Packed's bits 22–31: the attacker a bolt's
//   ProjectileEntityData.MaterialPair, the target what it hit), from
//   SB_Endor_01's grid, each property through that grid's own
//   MaterialIndexMap: { multiplier (DamageProtectionMultiplier), threshold
//   (DamageProtectionThreshold), collision { multiplier, threshold } }. A
//   bolt does multiplier × its damage when that reaches the threshold, else
//   nothing (findings/62 §3). A pair with no relation is the (default,
//   default) one, `noRelation`: 0× under 2, nothing, not 1× (its cell says
//   `none`).
// - fighters[kind]: hp, regenDelay, regenRate, property (the vehicle's own
//   VehicleEntityData.MaterialPair, what a fighter's health is judged by: the
//   part a bolt meets spends only that part's states, findings/62 §2),
//   vehicleDamageModifier and friendlyDamageModifier (DifficultyData's,
//   multiplayer Normal), bolt { projectile, damage, damageFar, falloff
//   [near, far] m, speed m/s, life s, property, blast }, ram { angle,
//   glancing, friend, enemy }.
// - capitals[kind]: parts[name] (a capital's hull part, named as
//   bf2017-hulls.mjs's partName names it; a module's part with health:
//   every one, or where the kind's hull is the site's, the ones its site map
//   names) { health in state order, states (each state's part; null where
//   it is the whole object), children (the parts nested under it), property,
//   damageMultiplier, friendlyFire, squad }, turrets[blueprint] { hp,
//   property, bolts },
//   site[name] { part, why }: the war's part names (a site hull's, the
//   war's objectives) on the game part whose numbers they take, or null
//   where the game has none.
// - stand[kind]: { as, why }: the game kind a kind the game never had takes
//   its numbers from.
//
// One assumption the finding leaves open (findings/62 Open): a hit's part is
// the Havok instance tag's bits 0–15, the exporter's reading of
// hknpShape::m_userData (PhysicsExport.cs:367), which the data fits; the
// game's code that keeps it was not followed.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cutAsset, deref, follow, isSequel, loadText, objectsOf, pointee, rootOf, shortName } from './bf2017-ebx.mjs';
import { CAPITAL_KITS, FIGHTER_PHYSICS, RES_META, SITE_OVER_GAME, partName, partProperties } from './bf2017-hulls.mjs';
import { readMap } from './bf2017-level.mjs';
import { physicsKey } from './bf2017-physics.mjs';
import { healthRow } from './bf2017-rulebook-air.mjs';
import { indexOf } from './bf2017-rulebook.mjs';
import { SPACE, piecesOf } from './bf2017-space.mjs';

// SB_Endor_01's grid, and the other space levels the era rule keeps, held to
// the same cells (findings/62 §3: the grids agree wherever two hold a pair)
export const GRID = 'levels/space/sb_endor_01/sb_endor_01/materialgrid_win32';
export const OTHER_GRIDS = ['levels/space/sb_droidbattleship_01/sb_droidbattleship_01/materialgrid_win32', 'levels/space/sb_fondor_01/sb_fondor_01/materialgrid_win32', 'levels/space/sb_kamino_01/sb_kamino_01/materialgrid_win32'];
// The properties space's bolts carry (findings/62 §1; the projectiles'
// MaterialPair): 216 the fighters' bolts, 72 the heavier ships' and most
// turrets', 61 the heavy turbolasers', 116 the bolts' blasts, 6 the Y-wing's
// ion turret, 81 a torpedo or missile and 80 its blast
// (Gameplay/Equipment/Shared/Projectiles/ProtonTorpedo's WSMissileEntityData
// and ExplosionEntityData). And what they hit: 68 a fighter, 222 a hero
// ship's parts, 129 a turret, 130 a deflector shield, 131 and 132 hulls, 206
// a capital's targets, 34, and 0, the grid's default. The records add theirs.
export const ATTACKERS = [216, 72, 61, 116, 6, 81, 80];
export const TARGETS = [68, 222, 129, 130, 131, 132, 206, 34, 0];
export const DIFFICULTY = 'Gameplay/Settings/GameDifficultySettings';
// the static models' damage modifier, linked over this field
// (findings/62 §4: × (1 + n × BonusPerSquadMate))
export const SQUAD_BONUS = 'Gameplay/GameModes/SpaceBattles/Objectives/PF_SpaceBattles_Objective_SquadDamageMultiplier';
export const SQUAD_FIELD = '0x5e24830a';

// The kinds the game never had, each standing in for the game kind of its
// class whose numbers it takes (the hulls design §2.4)
export const STAND = {
  acclamator: { as: 'venator', why: 'a Republic assault ship, flown beside the Venators; the game’s Republic capital is the Venator (SB_Kamino_01)' },
  bwing: { as: 'ywing', why: 'a Rebel bomber; the game’s Rebel bomber in Starfighter Assault is the Y-wing (Vehicles_Light_Orig_Space’s third kit)' },
  deathstar: { as: null, why: 'the world’s own sphere, flown round and never fired at: no hull (bf2017-hulls.mjs leaves it out) and no damage' },
  deathstar2: { as: null, why: 'the world’s own sphere, flown round and never fired at: no hull (bf2017-hulls.mjs leaves it out) and no damage' },
  delta7: { as: 'vwing', why: 'a Jedi interceptor of the Republic’s; the game’s Republic interceptor in Starfighter Assault is the V-wing (Vehicles_Light_Preq_Space’s second kit)' },
  executor: { as: 'destroyer', why: 'a Super Star Destroyer; the game’s Imperial flagship is the Imperial Star Destroyer (SB_Endor_01)' },
  ghost: { as: 'falcon', why: 'a Rebel light freighter flown by an ace; the game’s Rebel light freighter is the Millennium Falcon, a hero ship' },
  gozanti: { as: 'lightcruiser', why: 'an Imperial escort cruiser; the game’s Imperial escort is the Arquitens light cruiser (SB_Fondor_01)' },
  gunboat: { as: 'tiebomber', why: 'an Imperial assault gunboat, a heavy armoured craft; the game’s Imperial heavy craft in Starfighter Assault is the TIE bomber (Vehicles_Dark_Orig_Space’s third kit)' },
  hammerhead: { as: 'corvette', why: 'a Rebel corvette; the game’s Rebel corvette is the CR90' },
  houndstooth: { as: 'slave1', why: 'a bounty hunter’s ship; the game’s bounty hunter in space is Boba Fett’s Slave I, a hero ship' },
  ig2000: { as: 'slave1', why: 'a bounty hunter’s ship; the game’s bounty hunter in space is Boba Fett’s Slave I, a hero ship' },
  interdictor: { as: 'destroyer', why: 'an Imperial cruiser on a Star Destroyer’s wedge, its objectives a Star Destroyer’s (shield domes, bridge, reactor); the game’s is the Imperial Star Destroyer' },
  munificent: { as: 'providence', why: 'a Separatist frigate; the game’s Separatist warship of its line is the Providence-class dreadnought (SB_Kamino_01)' },
  punishingone: { as: 'slave1', why: 'a bounty hunter’s ship; the game’s bounty hunter in space is Boba Fett’s Slave I, a hero ship' },
  shuttle: { as: 'tiebomber', why: 'an Imperial Lambda-class shuttle, a slow armoured small craft the game flies in no space battle; the game’s Imperial heavy craft is the TIE bomber' },
  transport: { as: 'corvette', why: 'a Rebel GR-75 transport, a small capital ship; the game’s Rebel small capital is the CR90 corvette' },
  uwing: { as: 'xwing', why: 'the game flies its U-wing only as a gunship (Vehicle_Air_UWing_Gunship: a WSVehicleHealthComponentData, a door gunner’s rifle, no StarfighterHealthComponentData), never a starfighter; the galaxy flies it as a Rebel fighter, which the game’s is the T-65' },
};

// The game's fighters: each kind bf2017-hulls.mjs gives the game's flying
// asset, by its blueprint (the asset's name less `_Physics_Win32`), but a
// stand-in (the U-wing's asset is a gunship's)
export const FIGHTERS = Object.fromEntries(
  Object.entries(FIGHTER_PHYSICS)
    .filter(([kind]) => !STAND[kind])
    .map(([kind, file]) => [kind, `Gameplay/Vehicles/Air/${file.replace(/_Physics_Win32\.glb$/i, '')}`]),
);

// The vehicle turrets each capital's space level mounts on it (the records
// that fire its turbolasers: the Venator's and the Providence's are
// SB_Kamino_01's own); the Nebulon-B is a backdrop and mounts none
const CR90 = 'Gameplay/Vehicles/Corvette/CorvetteCR90';
const KAMINO = 'Levels/Space/SB_Kamino_01/ObjectiveShips';
const LUCREHULK = 'Gameplay/Vehicles/Capital/LucrehulkClass_DroidBattleShip/LucrehulkClass_DroidBattleShip_CannonA';
export const TURRETS = {
  destroyer: ['Gameplay/Vehicles/Capital/StarDestroyer/Turrets/StarDestroyer_TurretTurboLaser_Vehicle', 'Gameplay/Vehicles/Capital/StarDestroyer/Turrets/StarDestroyer_HeavyTurboLaser_02'],
  moncal: ['Gameplay/Vehicles/Capital/MC80/MC80_SmallGunTurret_AntiFighter', 'Gameplay/Vehicles/Capital/MC80/MC80_SmallGunTurret_Heavy'],
  corvette: ['LargeTurretTop', 'LargeTurretBottom', 'SmallTurretLeftA', 'SmallTurretLeftB', 'SmallTurretRightA', 'SmallTurretRightB'].map((t) => `${CR90}/CorvetteCR90_${t}`),
  venator: [`${KAMINO}/SpaceBattles_Venator/VenatorStarDestroyer_HeavyTurret`, `${KAMINO}/SpaceBattles_Venator/VenatorStarDestroyer_SideTurret`],
  providence: [`${KAMINO}/SpaceBattles_Dreadnaught/QuadLaser_Turret_01`, `${KAMINO}/SpaceBattles_Dreadnaught/QuadLaser_Turret_Heavy`],
  lucrehulk: [`${LUCREHULK}/LucrehulkClass_DroidBattleShip_QuadLaserCannon_01`, `${LUCREHULK}/LucrehulkClass_DroidBattleShip_QuadLaserCannon_02`],
  lightcruiser: ['Gameplay/Vehicles/Capital/ImperialCruiser/ImperialLightCruiser_Turrets_01'],
  nebulon: [],
};

// The war's part names (a site hull's `hull` and its objectives: universe/
// wars.js's SUBSYSTEMS ids) on each game capital's part whose numbers they
// take, where the game has one: the site's hull of the Lucrehulk and the
// Arquitens (bf2017-hulls.mjs's SITE_OVER_GAME), a stand-in's, and the war's
// objectives on a game hull
export const SITE_NAMES = ['hull', 'gen-port', 'gen-star', 'bridge', 'reactor'];
const NONE = 'no part of the game’s for it: the war keeps its own';
export const SITE = {
  destroyer: {
    hull: ['stardestroyer_hull_01_sb_endor#1', 'the main hull’s plating (p132; its part 0 is the default)'],
    'gen-port': ['stardestroyer_deflectorshield_01#0', 'the deflector shield domes on the bridge tower'],
    'gen-star': ['stardestroyer_deflectorshield_01#0', 'the deflector shield domes on the bridge tower'],
    bridge: ['stardestroyer_detailscommandbridge_01', 'the command bridge module (p132: no bolt hurts it in the game)'],
    reactor: ['stardestroyer_solarionizationreactor_01#0', 'the solar ionization reactor’s bulb under the hull'],
  },
  moncal: {
    hull: ['mc80_mainhull_01', 'the main hull'],
    'gen-port': ['mc80_largenodule_01#1', 'the top port nodule, SB_Endor_01’s target TL01 (its first state its p132 shell)'],
    'gen-star': ['mc80_largenodule_04#1', 'the top starboard nodule, SB_Endor_01’s target TR01 (its first state its p132 shell)'],
    bridge: [null, 'the MC80’s bridge is its main hull’s: no module of its own'],
    reactor: [null, 'no reactor module (SB_Endor_01’s engine target is a collision object of the level’s, not the kit’s)'],
  },
  venator: {
    hull: ['venatorstardestroyer_hull_01', 'the main hull'],
    'gen-port': ['venatorstardestroyer_controltower_left#0', 'the port bridge tower’s top'],
    'gen-star': ['venatorstardestroyer_controltower_right#0', 'the starboard bridge tower’s top'],
    bridge: ['venatorstardestroyer_controltower_01#0', 'the bridge tower module'],
    reactor: [null, NONE],
  },
  providence: { hull: ['providenceclassdreadnaught_01', 'its one module, the whole ship'] },
  lucrehulk: {
    hull: ['lucrehulkclass_droidbattleship_mainhull_01#2', 'the main hull ring’s plating'],
    'gen-port': ['lucrehulkclass_droidbattleship_transmissiontowerpowergenerator_01#0', 'a transmission tower’s power generator, an objective of SB_DroidBattleShip_01’s'],
    'gen-star': ['lucrehulkclass_droidbattleship_transmissiontowerpowergenerator_01#0', 'a transmission tower’s power generator, an objective of SB_DroidBattleShip_01’s'],
    bridge: ['lucrehulkclass_droidbattleship_controlbridgetower_01_left', 'the control bridge tower’s arm, an objective of SB_DroidBattleShip_01’s'],
    reactor: [null, 'the core is the level’s own object, not the kit’s'],
  },
  lightcruiser: { hull: ['imperialcruiser_hull_01', 'the hull module, its only one with physics: the whole ship'] },
  corvette: { hull: ['corvettecr90_01#0', 'the hull part, whose last state is the wreck'] },
  nebulon: { hull: ['frigatenebulonb_01', 'its one part (p34: no relation, so no bolt hurts it)'] },
};

const NOTES = [
  'A bolt’s damage is `damage` out to falloff[0] metres, falling to damageFar at falloff[1] and damageFar beyond. What it hits takes the cell’s multiplier × that when the product reaches the cell’s threshold, else nothing; a pair with no relation takes noRelation’s cell, 0× under 2 (findings/62 §3).',
  'A fighter’s health loses multiplier(bolt.property, fighter.property) × damage × vehicleDamageModifier, the product held to the threshold: fighter.property is its VehicleEntityData.MaterialPair’s whichever part the bolt met, since a part’s own relation spends only that part’s states, which reach the health only through a weak spot, and no starfighter has one (findings/62 §2). A friend’s bolt is × friendlyDamageModifier while friendly fire is off. A turret is a vehicle and takes a bolt the same way, against its own property.',
  'A capital’s part (a static model’s) loses multiplier(bolt.property, part.property) × damage when that reaches the threshold, then × (1 + n × squadBonus.perMate) where `squad` (n the shooter’s squadmates who hit it within squadBonus.cooldown seconds, at most 1 unless eachMate) and × damageMultiplier; a friend’s bolt does nothing unless friendlyFire (findings/62 §4).',
  'A part starts at health[0] and is spent down its states: a hit never takes it past the next state’s health, where it is held and moves to that state, and the rest of the hit goes back through the same rule (the threshold checked again, so a rest under it is dropped; the squad bonus and damageMultiplier applied again); in the last state it falls to 0. Only a hit on the part its state names (`states`, null for the whole object) spends it, and a state whose part is no longer the part hit sends its `children` FLT_MAX (findings/62 §4).',
  'Assumed, as findings/62 leaves it open: a hit’s part is the Havok instance tag’s bits 0–15 (the exporter’s reading of hknpShape::m_userData, PhysicsExport.cs:367, which the data fits); the game’s code that keeps it was not followed.',
];

// ── the grid ──

// A Packed's property: bits 22–31 (FUN_1474bf830's `>> 0x16`), the grid's
// default (0) without its valid bit, 11 (findings/62 §1)
export const propertyOf = (packed) => ((packed >>> 11) & 1 ? packed >>> 22 : 0);

// The damage relation of (attacker, target) and where it sits, or null where
// its cell holds none: the row MaterialIndexMap[attacker], the column
// MaterialIndexMap[target], a row past the grid its DefaultMaterialIndex
// (FUN_1474bf390, FUN_1474bf830; the cell's PhysicsPropertyProperties)
export function gridOf(asset) {
  const g = rootOf(asset);
  const row = (p) => {
    const r = g.MaterialIndexMap[p];
    return r === undefined || r >= g.InteractionGrid.length ? g.DefaultMaterialIndex : r;
  };
  return (a, t) => {
    const [i, j] = [row(a), row(t)];
    const list = g.InteractionGrid[i]?.Items?.[j]?.PhysicsPropertyProperties ?? [];
    const k = list.findIndex((r) => deref(asset, r)?.$type === 'MaterialRelationDamageData');
    if (k < 0) return null;
    const d = deref(asset, list[k]);
    return {
      multiplier: d.DamageProtectionMultiplier,
      threshold: d.DamageProtectionThreshold,
      collision: { multiplier: d.CollisionDamageMultiplier, threshold: d.CollisionDamageThreshold },
      _source: `${asset.name}#MaterialGridData.InteractionGrid.${i}.Items.${j}.PhysicsPropertyProperties.${k}`,
    };
  };
}

// A grid cut to the rows and columns of `properties` (and the default's),
// their cells' damage relations alone: a test fixture of a few KB
export function cutGrid(asset, properties) {
  const g = rootOf(asset);
  const rowOf = (p) => g.MaterialIndexMap[p] ?? g.DefaultMaterialIndex;
  const rows = new Set([...properties, propertyOf(g.DefaultMaterial.Packed)].map(rowOf));
  const objects = [];
  const at = new Map();
  const keep = (ref) => {
    const o = deref(asset, ref);
    if (o?.$type !== 'MaterialRelationDamageData') return null;
    if (!at.has(o)) at.set(o, objects.push(o));
    return { $ref: at.get(o) };
  };
  const cells = (r, i) => ({ Items: rows.has(i) ? r.Items.map((it, j) => (rows.has(j) ? { PhysicsPropertyProperties: (it.PhysicsPropertyProperties ?? []).map(keep).filter(Boolean) } : {})) : [] });
  return { ...asset, root: 0, objects: [{ ...g, MaterialProperties: [], InteractionGrid: g.InteractionGrid.map(cells) }, ...objects] };
}

// ── what a bolt is ──

const where = (asset, obj, path = '') => `${asset.name}#${obj.$type}${path ? `.${path}` : ''}`;

// a projectile record's bolt: { asset, obj } of its WSBulletEntityData
function projectileOf(root, v) {
  const p = pointee(root, v);
  const obj = p && (p.obj.$type === 'GameDataContainerAsset' ? deref(p.asset, p.obj.Data) : p.obj);
  return obj ? { asset: p.asset, obj } : null;
}

// A bolt as the damage reads it (findings/20: StartDamage falling to
// EndDamage between the falloff distances; findings/62 §1: its property),
// fired at `speed` (the weapon's, named by `speedSource`), with its blast
// where its projectile has an explosion
function boltRow(root, ref, speed, speedSource, missing) {
  const b = projectileOf(root, ref);
  if (!b) {
    missing.push(`projectile: ${ref?.$asset}`);
    return null;
  }
  const o = b.obj;
  const row = {
    projectile: shortName(b.asset.name),
    damage: o.StartDamage,
    damageFar: o.EndDamage,
    falloff: [o.DamageFalloffStartDistance, o.DamageFalloffEndDistance],
    speed,
    speed_source: speedSource,
    life: o.TimeToLive,
    property: propertyOf(o.MaterialPair?.Packed ?? 0),
    property_source: where(b.asset, o, 'MaterialPair'),
    _source: where(b.asset, o),
  };
  const e = deref(b.asset, o.Explosion);
  if (e) row.blast = { damage: e.BlastDamage, radius: e.BlastRadius, property: propertyOf(e.MaterialPair?.Packed ?? 0), _source: where(b.asset, e) };
  return row;
}

// a record of a blueprint's folder by its suffix (`_Weapons`), the
// blueprint's own first (as the air rulebook finds a layer)
function layerOf(root, blueprint, suffix) {
  const dir = blueprint.slice(0, blueprint.lastIndexOf('/') + 1).toLowerCase();
  const want = `_${suffix}`.toLowerCase();
  const hits = [...indexOf(root).keys()].filter((n) => n.toLowerCase().startsWith(dir) && n.toLowerCase().endsWith(want) && !n.slice(dir.length).includes('/'));
  hits.sort((a, b) => Number(!a.toLowerCase().startsWith(blueprint.toLowerCase())) - Number(!b.toLowerCase().startsWith(blueprint.toLowerCase())));
  return hits.length ? follow(root, hits[0]) : null;
}

// The multiplayer Normal row of the game's difficulties (the one a
// multiplayer game takes: findings/62 §2, thunk_FUN_1467d2aa0)
export function difficultyOf(root) {
  const a = follow(root, DIFFICULTY);
  const list = a ? rootOf(a).Difficulties ?? [] : [];
  const i = list.findIndex((r) => {
    const d = deref(a, r);
    return d?.GameType === 'PersistenceGameType_Multiplayer' && d.ReadableName === 'Normal';
  });
  if (i < 0) return null;
  const d = deref(a, list[i]);
  const at = `${a.name}#${rootOf(a).$type}.Difficulties.${i}`;
  return { vehicle: d.VehicleDamageModifier, vehicle_source: `${at}.VehicleDamageModifier`, friendly: d.FriendlyDamageModifier, friendly_source: `${at}.FriendlyDamageModifier` };
}

// ── a fighter ──

export function fighterRow(root, blueprint, { difficulty, missing }) {
  const bp = follow(root, blueprint);
  const h = bp && healthRow(bp);
  const v = bp && objectsOf(bp, 'VehicleEntityData')[0];
  if (!h || !v) {
    missing.push(`fighter: ${blueprint}`);
    return null;
  }
  // (the cannon's own projectile override: not the one an ability's unlock names, the overcharge)
  const weapons = layerOf(root, blueprint, 'Weapons');
  const own = weapons && objectsOf(weapons, 'FireProjectileEntityOverrideData').find((o) => !/Abilities\//.test(o.FireProjectileData?.UnlockAsset?.$asset ?? ''));
  if (!own) missing.push(`weapons: ${blueprint}_Weapons`);
  return {
    hp: h.max,
    hp_source: `${h._source}.MaxHealth`,
    regenDelay: h.regenDelay,
    regenDelay_source: h.regenDelay_source,
    regenRate: h.regenRate,
    regenRate_source: h.regenRate_source,
    property: propertyOf(v.MaterialPair?.Packed ?? 0),
    property_source: where(bp, v, 'MaterialPair'),
    vehicleDamageModifier: difficulty.vehicle,
    vehicleDamageModifier_source: difficulty.vehicle_source,
    friendlyDamageModifier: difficulty.friendly,
    friendlyDamageModifier_source: difficulty.friendly_source,
    bolt: own ? boltRow(root, own.FireProjectileData.ProjectileData, own.FireProjectileData.Speed, where(weapons, own, 'FireProjectileData.Speed'), missing) : null,
    // (StarfighterHealthComponentData's CollisionAngle, GlancingDamageModifier, FriendlyDamage and EnemyDamage)
    ram: { angle: h.collisionAngle, glancing: h.glancing, friend: h.friendlyRam, enemy: h.enemyRam, _source: h._source },
  };
}

// ── a capital ──

// The blueprints a prefab links to the squad bonus (findings/62 §4), each
// with the record that links it: a reference to the blueprint linked over
// SQUAD_FIELD to the bonus's prefab, or to its record's interface, which a
// reference to that record links on in turn (the Star Destroyer's reactor
// three prefabs up). Read from the blueprints under LINK_SCOPE that name
// the field, the sequel's left out.
const LINK_SCOPE = /^(Gameplay\/Vehicles\/(Capital|Corvette|SpaceBattles)\/|Gameplay\/GameModes\/SpaceBattles\/|Levels\/Space\/|Objects\/Props\/Landmarks\/)/i;
export function squadLinks(root) {
  const BONUS = SQUAD_BONUS.toLowerCase();
  const edges = [];
  for (const [name, e] of indexOf(root)) {
    if (!/Blueprint$/.test(e.type) || !LINK_SCOPE.test(name) || isSequel(name)) continue;
    const text = loadText(root, name);
    if (!text?.includes(SQUAD_FIELD)) continue;
    const asset = JSON.parse(text);
    for (const o of asset.objects)
      for (const l of o?.LinkConnections ?? []) {
        if (l.SourceField !== SQUAD_FIELD) continue;
        const [s, t] = [deref(asset, l.Source), deref(asset, l.Target)];
        if (!s || !t) continue;
        const from = (s.Blueprint?.$asset ?? name).toLowerCase();
        const to = t.Blueprint?.$asset?.toLowerCase() === BONUS ? BONUS : t.$type === 'InterfaceDescriptorData' ? name.toLowerCase() : null;
        if (to && to !== from) edges.push({ from, to, at: name });
      }
  }
  const linked = new Map();
  for (const e of edges) if (e.to === BONUS && !linked.has(e.from)) linked.set(e.from, [e.at]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const e of edges)
      if (e.to !== BONUS && linked.has(e.to) && !linked.has(e.from)) {
        linked.set(e.from, [e.at, ...linked.get(e.to)]);
        grew = true;
      }
  }
  return new Map([...linked].map(([bp, chain]) => [bp, `${chain.at(-1)}#LinkConnections.${SQUAD_FIELD}${chain.length > 1 ? ` (through ${chain.slice(0, -1).map(shortName).join(', ')})` : ''}`]));
}

export function squadBonusOf(root) {
  const a = follow(root, SQUAD_BONUS);
  const m = a && objectsOf(a, 'SquadDamageBonusModifierEntityData')[0];
  return m ? { perMate: m.BonusPerSquadMate, cooldown: m.Cooldown, eachMate: m.ApplyBonusPerSquadMate, _source: where(a, m) } : null;
}

// the index's names by their lower case (a physics asset names its module's
// blueprint in lower case)
const lowered = new Map();
function byLower(root) {
  if (!lowered.has(root)) lowered.set(root, new Map([...indexOf(root).keys()].map((n) => [n.toLowerCase(), n])));
  return lowered.get(root);
}

// A kit module's parts with health (its blueprint's PartComponentData, one
// a chain): each named for the physics part its first state is
// (HealthStateData.PartIndex: the part a hit must name to spend it,
// findings/62 §4's `iVar6 == iVar16`), with that part's property from the
// asset's header. `file` the kit's model file (a physics asset's own name
// for a one-asset capital); a module with no physics asset is no part of the
// hull, and has none.
export function moduleParts(root, file, { header, squad, missing }) {
  const res = /_physics_win32$/i.test(file) ? String(file).toLowerCase() : physicsKey(file);
  const name = byLower(root).get(res.replace(/_physics_win32$/, ''));
  const bp = name && follow(root, name);
  if (!bp) {
    missing.push(`module: ${file}`);
    return {};
  }
  const rb = objectsOf(bp, 'RigidBodyData').find((r) => r.Asset?.$asset);
  if (!rb) return {};
  if (rb.Asset.$asset.toLowerCase() !== res) missing.push(`physics: ${name} has ${rb.Asset.$asset}`);
  const h = header(res);
  if (!h) {
    missing.push(`header: ${res}`);
    return {};
  }
  const props = partProperties(h, res);
  const ws = objectsOf(bp, 'WSStaticModelHealthComponentData')[0];
  const link = squad.get(name.toLowerCase());
  // (a state's PartIndex 4294967295, −1, is the whole object)
  const index = (s) => (s.PartIndex >= 0 && s.PartIndex < h.parts ? s.PartIndex : null);
  const chains = new Map();
  for (const pc of objectsOf(bp, 'PartComponentData')) {
    const states = (pc.HealthStates ?? []).map((r) => deref(bp, r)).filter(Boolean);
    if (!states.length) continue;
    if (index(states[0]) === null) missing.push(`part: ${name}'s first state names part ${states[0].PartIndex} of ${h.parts}`);
    else chains.set(pc, { states, name: partName(file, index(states[0]), h.parts) });
  }
  const out = {};
  for (const [pc, { states, name: key }] of chains) {
    const first = index(states[0]);
    const row = {
      health: states.map((s) => s.Health),
      states: states.map((s) => (index(s) === null ? null : partName(file, index(s), h.parts))),
      _source: where(bp, pc, 'HealthStates'),
      property: props[first],
      property_source: `${res}#HavokPhysicsData.Materials[PartSlots[${first}]]`,
    };
    // (the part components nested in its Components, which a state leaving its part sends FLT_MAX: the Star Destroyer's heavy turbolaser's second gun)
    const children = (pc.Components ?? []).map((r) => chains.get(deref(bp, r))?.name).filter(Boolean);
    if (children.length) Object.assign(row, { children, children_source: where(bp, pc, 'Components') });
    if (ws) Object.assign(row, { damageMultiplier: ws.DamageMultiplier, damageMultiplier_source: where(bp, ws, 'DamageMultiplier'), friendlyFire: ws.EnableFriendlyFire, friendlyFire_source: where(bp, ws, 'EnableFriendlyFire') });
    if (link) Object.assign(row, { squad: true, squad_source: link });
    out[key] = row;
  }
  return out;
}

// A vehicle turret: its WSVehicleHealthComponentData, its pair, and the
// bolts its override fires (the list where the record overrides the list,
// else the one; with no override, its firing functions' shots)
export function turretRow(root, blueprint, { missing }) {
  const bp = follow(root, blueprint);
  const hc = bp && objectsOf(bp, 'WSVehicleHealthComponentData')[0];
  const v = bp && objectsOf(bp, 'VehicleEntityData')[0];
  if (!hc || !v) {
    missing.push(`turret: ${blueprint}`);
    return null;
  }
  const o = objectsOf(bp, 'FireProjectileEntityOverrideData')[0];
  const shots =
    o?.OverrideFireProjectileDataList && o.FireProjectileDataList?.length
      ? o.FireProjectileDataList.map((f, i) => [f.ProjectileData, f.Speed, where(bp, o, `FireProjectileDataList.${i}.Speed`)])
      : o?.OverrideFireProjectileData
        ? [[o.FireProjectileData.ProjectileData, o.FireProjectileData.Speed, where(bp, o, 'FireProjectileData.Speed')]]
        : objectsOf(bp, 'FiringFunctionData')
            .filter((f) => f.Shot?.ProjectileData?.$asset)
            .map((f) => [f.Shot.ProjectileData, f.Shot.InitialSpeed?.z, where(bp, f, 'Shot.InitialSpeed.z')]);
  const seen = new Set();
  const bolts = shots
    .filter(([p, speed]) => !seen.has(`${p.$asset}@${speed}`) && seen.add(`${p.$asset}@${speed}`))
    .map(([p, speed, at]) => boltRow(root, p, speed, at, missing))
    .filter(Boolean);
  return { hp: hc.MaxHealth, hp_source: where(bp, hc, 'MaxHealth'), property: propertyOf(v.MaterialPair?.Packed ?? 0), property_source: where(bp, v, 'MaterialPair'), bolts };
}

// A capital: its modules' parts, its turrets and the war's names on its
// parts. Where its hull is the site's (bf2017-hulls.mjs's SITE_OVER_GAME),
// no hull part carries a module's name, so only the parts its site map
// names are kept.
export function capitalRow(root, kind, files, ctx) {
  let parts = {};
  for (const file of [...new Set(files)]) Object.assign(parts, moduleParts(root, file, ctx));
  if (SITE_OVER_GAME[kind]) {
    const named = new Set(Object.values(SITE[kind] ?? {}).map(([part]) => part));
    parts = Object.fromEntries(Object.entries(parts).filter(([name]) => named.has(name)));
  }
  const turrets = {};
  for (const t of ctx.turrets[kind] ?? []) {
    const row = turretRow(root, t, ctx);
    if (row) turrets[shortName(t)] = row;
  }
  const site = {};
  for (const n of SITE_NAMES) {
    const [part, why] = SITE[kind]?.[n] ?? [null, NONE];
    if (part !== null && !parts[part]) ctx.missing.push(`site: ${kind}'s ${n} names ${part}, not a part of its`);
    site[n] = { part, why };
  }
  return { parts, turrets, site };
}

// Each game capital's kit modules, as its fleet file was made of them:
// piecesOf over its space level's map (`maps` the folder holding maps/),
// or, for one made from one asset, that asset (bf2017-hulls.mjs's CAPITAL_KITS)
export function capitalModules(maps, kits = CAPITAL_KITS) {
  const levels = new Map();
  const out = {};
  for (const [kind, k] of Object.entries(kits)) {
    if (kind.includes('/')) continue;
    if (k.physics) {
      out[kind] = [k.physics];
      continue;
    }
    if (!levels.has(k.space)) {
      const base = join(maps, 'maps', SPACE[k.space].map);
      levels.set(k.space, piecesOf(readMap(JSON.parse(readFileSync(`${base}.json`, 'utf8')), readFileSync(`${base}.bin`)), { system: k.space }));
    }
    out[kind] = (levels.get(k.space).models[k.model]?.parts ?? []).map((p) => p.file);
  }
  return out;
}

// ── the rulebook ──

export function damageRulebook(root, { kits = {}, header = () => null, fighters = FIGHTERS, turrets = TURRETS, stand = STAND } = {}) {
  const missing = [];
  const difficulty = difficultyOf(root);
  if (!difficulty) throw new Error(`${DIFFICULTY}: no multiplayer Normal row in ${root}`);
  const ctx = { header, turrets, missing, squad: squadLinks(root) };
  const fighterRows = {};
  for (const [kind, bp] of Object.entries(fighters)) {
    const row = fighterRow(root, bp, { difficulty, missing });
    if (row) fighterRows[kind] = row;
  }
  const capitals = {};
  for (const [kind, files] of Object.entries(kits)) capitals[kind] = capitalRow(root, kind, files, ctx);

  // the grid's cells for every property here, held to the other levels' grids
  const bolts = [...Object.values(fighterRows).map((f) => f.bolt), ...Object.values(capitals).flatMap((c) => Object.values(c.turrets).flatMap((t) => t.bolts))].filter(Boolean);
  const attackers = [...new Set([...ATTACKERS, ...bolts.flatMap((b) => [b.property, b.blast?.property])].filter((p) => p !== undefined))].sort((a, b) => a - b);
  const hit = [...Object.values(fighterRows).map((f) => f.property), ...Object.values(capitals).flatMap((c) => [...Object.values(c.parts).map((p) => p.property), ...Object.values(c.turrets).map((t) => t.property)])];
  const targets = [...new Set([...TARGETS, ...hit])].sort((a, b) => a - b);
  const asset = follow(root, GRID);
  if (!asset) throw new Error(`${GRID}: not in ${root}`);
  const cell = gridOf(asset);
  const fallback = propertyOf(rootOf(asset).DefaultMaterial.Packed);
  const noRelation = cell(fallback, fallback);
  const grid = {};
  for (const a of attackers) grid[a] = Object.fromEntries(targets.map((t) => [t, cell(a, t) ?? { ...noRelation, none: true }]));
  const agrees = [];
  for (const name of OTHER_GRIDS) {
    const other = follow(root, name);
    if (!other) continue;
    const at = gridOf(other);
    const same = (x, y) => (x === null) === (y === null) && (x === null || (x.multiplier === y.multiplier && x.threshold === y.threshold && x.collision.multiplier === y.collision.multiplier && x.collision.threshold === y.collision.threshold));
    for (const a of attackers) for (const t of targets) if (!same(cell(a, t), at(a, t))) throw new Error(`${name} differs from ${GRID} at (${a}, ${t})`);
    agrees.push(name.split('/')[2]);
  }

  return {
    _notes: NOTES,
    gridFrom: { grid: GRID, indexMap: `${asset.name}#MaterialGridData.MaterialIndexMap`, agrees },
    grid,
    noRelation,
    squadBonus: squadBonusOf(root),
    fighters: fighterRows,
    capitals,
    stand: Object.fromEntries(Object.entries(stand).map(([k, s]) => [k, { ...s }])),
    _missing: [...new Set(missing)],
  };
}

// ── the test fixtures ──

// A record cut to the objects `keep` names and what they reach, leaving
// out the fields that reach the rest of the object (its components, the
// debris a state spawns), its root only the connections `links` keeps
const DROP = ['Components', 'Objects', 'LoosePartPhysics'];
function cutTo(asset, keep, links = () => false) {
  const r = rootOf(asset);
  const stub = { $type: r.$type, ...(r.$guid ? { $guid: r.$guid } : {}), LinkConnections: (r.LinkConnections ?? []).filter(links) };
  const objects = asset.objects.map((o, i) => (i === asset.root ? stub : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).filter(([k]) => !DROP.includes(k))) : o));
  return cutAsset({ ...asset, objects }, keep);
}
const types = (...t) => (o) => t.includes(o?.$type);

// What the damage test reads, cut from the export to a few KB each: the
// grid's rows and columns for space's properties, the X-wing's blueprint,
// weapons and bolt, the CR90 and its prefab's squad link, the bonus's
// prefab, its top turret and bolt, and the difficulties' multiplayer Normal
// row; and the CR90's physics header to the end of its tables.
// → { records: [{ name, type, json }], headers: [{ res, bytes }] }
export function damageFixtures(root, headerBytes) {
  const index = indexOf(root);
  const records = [];
  const add = (name, json) => records.push({ name, type: index.get(name)?.type ?? rootOf(json).$type, json });
  add(GRID, cutGrid(follow(root, GRID), [...ATTACKERS, ...TARGETS]));
  const d = difficultyOf(root);
  const diff = follow(root, DIFFICULTY);
  const row = deref(diff, rootOf(diff).Difficulties[Number(d.vehicle_source.match(/Difficulties\.(\d+)/)[1])]);
  add(DIFFICULTY, cutAsset(diff, (o) => o === row));
  add(FIGHTERS.xwing, cutTo(follow(root, FIGHTERS.xwing), types('VehicleEntityData', 'StarfighterHealthComponentData')));
  const weapons = layerOf(root, FIGHTERS.xwing, 'Weapons');
  add(weapons.name, cutTo(weapons, types('FireProjectileEntityOverrideData')));
  for (const p of ['Gameplay/Vehicles/Projectiles/Projectile_Xwing', 'Gameplay/Vehicles/Projectiles/Projectile_CR90_LargeTurret', SQUAD_BONUS]) add(p, follow(root, p));
  add(`${CR90}/CorvetteCR90_01`, cutTo(follow(root, `${CR90}/CorvetteCR90_01`), types('RigidBodyData', 'PartComponentData', 'WSStaticModelHealthComponentData')));
  const prefab = follow(root, `${CR90}/PF_CorvetteCR90_01`);
  const squad = new Set(prefab.objects.flatMap((o) => (o?.LinkConnections ?? []).filter((l) => l.SourceField === SQUAD_FIELD).flatMap((l) => [l.Source.$ref, l.Target.$ref])));
  add(prefab.name, cutTo(prefab, (o, i) => squad.has(i), (l) => l.SourceField === SQUAD_FIELD));
  add(TURRETS.corvette[0], cutTo(follow(root, TURRETS.corvette[0]), types('VehicleEntityData', 'WSVehicleHealthComponentData', 'FireProjectileEntityOverrideData')));
  // (a header to the end of its tables: readHeader reads no further)
  const res = physicsKey('models/gameplay/vehicles/corvette/corvettecr90/corvettecr90_01_mesh.glb');
  const bytes = headerBytes(res);
  const dv = new DataView(bytes.buffer, bytes.byteOffset + RES_META);
  const end = RES_META + Math.max(Number(dv.getBigUint64(0x20, true)) + dv.getUint32(0x1c, true), Number(dv.getBigUint64(0x2c, true)) + dv.getUint32(0x28, true) * 4, 0x34);
  return { records, headers: [{ res, bytes: bytes.subarray(0, end) }] };
}
