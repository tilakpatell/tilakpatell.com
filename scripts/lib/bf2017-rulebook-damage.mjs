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
// - capitals[kind]: parts[name] (a hull part as bf2017-hulls.mjs's partName
//   names it, a kit module's part whose chain begins on it; none where the
//   kind's hull is the site's, and none that no attacker can hurt unless the
//   site names it) { health in state order, states (each state's part; null
//   where it is the whole object), children (the parts nested under it),
//   properties (each state's part's), property (the first's),
//   damageMultiplier, friendlyFire, squad }; turrets[blueprint]
//   { hp, property, bolts }; and the site's choices (`source: 'site'`, not
//   records): site[name] for the war's part names (`hull` and universe/
//   wars.js's SUBSYSTEMS ids), each the game record whose numbers it takes
//   ({ record, objective, health, properties, squad, … }, or record null
//   where the game has none) and the hull `parts` a hit on it is; and
//   turretParts, the hull parts each turret record stands for.
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
import { KITS, SPACE, instanceOf, piecesOf, rotate } from './bf2017-space.mjs';

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
  delta7: { as: 'vwing', why: 'a Jedi interceptor the galaxy flies in the Republic’s squadrons; the game’s Republic interceptor in Starfighter Assault is the V-wing (Vehicles_Light_Preq_Space’s second kit), and Yoda’s Jedi starfighter is a hero ship with a hero’s 2,400 hit points and lighter rams, not a squadron’s' },
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
const LUCREHULK = 'Gameplay/Vehicles/Capital/LucrehulkClass_DroidBattleShip';
export const TURRETS = {
  destroyer: ['Gameplay/Vehicles/Capital/StarDestroyer/Turrets/StarDestroyer_TurretTurboLaser_Vehicle', 'Gameplay/Vehicles/Capital/StarDestroyer/Turrets/StarDestroyer_HeavyTurboLaser_02'],
  moncal: ['Gameplay/Vehicles/Capital/MC80/MC80_SmallGunTurret_AntiFighter', 'Gameplay/Vehicles/Capital/MC80/MC80_SmallGunTurret_Heavy'],
  corvette: ['LargeTurretTop', 'LargeTurretBottom', 'SmallTurretLeftA', 'SmallTurretLeftB', 'SmallTurretRightA', 'SmallTurretRightB'].map((t) => `${CR90}/CorvetteCR90_${t}`),
  venator: [`${KAMINO}/SpaceBattles_Venator/VenatorStarDestroyer_HeavyTurret`, `${KAMINO}/SpaceBattles_Venator/VenatorStarDestroyer_SideTurret`],
  providence: [`${KAMINO}/SpaceBattles_Dreadnaught/QuadLaser_Turret_01`, `${KAMINO}/SpaceBattles_Dreadnaught/QuadLaser_Turret_Heavy`],
  lucrehulk: [`${LUCREHULK}/LucrehulkClass_DroidBattleShip_CannonA/LucrehulkClass_DroidBattleShip_QuadLaserCannon_01`, `${LUCREHULK}/LucrehulkClass_DroidBattleShip_CannonA/LucrehulkClass_DroidBattleShip_QuadLaserCannon_02`],
  lightcruiser: ['Gameplay/Vehicles/Capital/ImperialCruiser/ImperialLightCruiser_Turrets_01'],
  nebulon: [],
};

// ── the site's choices ──
//
// What follows is the site's, not the game's: which game record each of the
// war's part names takes its numbers from, and which hull parts a turret
// record stands for. Each says why; the numbers it then carries are the
// record's, with their sources.

// The war's part names: a site hull's `hull` and its objectives (universe/
// wars.js's SUBSYSTEMS ids)
export const SITE_NAMES = ['hull', 'gen-port', 'gen-star', 'bridge', 'reactor'];
// Each game capital's: the record (and, for a module with several chains,
// the part its chain begins on), the prefab that makes it the level's
// objective where one does, and why the site chose it. The hull parts a hit
// on it is are the record's own module's where it is a kit module, else the
// kit modules inside the record's box where its level places it; a site
// hull's are the part of the name. Where the game has no record for a name,
// the war keeps its own.
const SB = 'Levels/Space';
const ISD = 'Objects/Props/Landmarks/_GalacticEmpire/StarDestroyer_01';
const MC80 = 'Gameplay/Vehicles/Capital/MC80';
const VENATOR = `${KAMINO}/SpaceBattles_Venator`;
const OWN = (ship) => `no record of the game’s stands for it on the ${ship}, so the war keeps its own`;
export const SITE = {
  destroyer: {
    hull: { record: `${ISD}/StarDestroyer_Hull_01_SB_ENDOR`, part: 1, why: 'the site maps the war’s hull to the Star Destroyer’s main hull module because no record of the game’s makes its hull an objective; the module is p132, which no bolt hurts' },
    'gen-port': { record: `${ISD}/StarDestroyer_DeflectorShield_01`, why: 'the site maps the war’s port shield generator to the deflector shield domes on the bridge tower because they are this ship’s shield in the game (a team’s record with hit points, though no level makes it an objective) and the war puts its generators there; the two domes are one module placed twice, so both generators take the same parts' },
    'gen-star': { record: `${ISD}/StarDestroyer_DeflectorShield_01`, why: 'the site maps the war’s starboard shield generator to the deflector shield domes because they are this ship’s shield in the game and the war puts its generators there; the two domes are one module placed twice, so both generators take the same parts' },
    bridge: { record: `${ISD}/StarDestroyer_DetailsCommandBridge_01`, why: 'the site maps the war’s bridge to the command bridge module, where the war puts it, because no record of the game’s makes the Star Destroyer’s bridge an objective; the module is p132, so no bolt hurts it' },
    reactor: { record: `${ISD}/StarDestroyer_SolarIonizationReactor_01`, objective: 'Gameplay/GameModes/SpaceBattles/Objectives/PF_SpaceBattles_StarDestroyer_Objective_01', why: 'the site maps the war’s reactor to the solar ionization reactor because it is the Star Destroyer’s objective in the game (SB_Fondor_01’s SpaceBattle_Logic places the prefab that links it)' },
  },
  moncal: {
    hull: { record: `${MC80}/MC80_MainHull_01`, why: 'the site maps the war’s hull to the MC80’s main hull module because no record of the game’s makes its hull an objective; the module is p132' },
    'gen-port': { record: `${MC80}/MC80_LargeNodule_03`, objective: `${SB}/SB_Endor_01/Objectives/PF_SpaceBattles_MC80_target_TR02`, why: 'the site maps the war’s gen-port to the nodule nearest its marker on the drawn MC80 (SB_Endor_01’s target TR02) because SB_Endor_01’s MC80 targets are its nodules and the war puts its generators on the ship’s back' },
    'gen-star': { record: `${MC80}/MC80_LargeNodule_02`, objective: `${SB}/SB_Endor_01/Objectives/PF_SpaceBattles_MC80_target_TL02`, why: 'the site maps the war’s gen-star to the nodule nearest its marker on the drawn MC80 (SB_Endor_01’s target TL02) because SB_Endor_01’s MC80 targets are its nodules and the war puts its generators on the ship’s back' },
    bridge: { record: null, why: 'no record of the game’s makes the MC80’s bridge an objective or a module of its own, so the war keeps its own bridge' },
    reactor: { record: `${SB}/SB_Endor_01/Objects/Endor_Engine_targetCollision`, objective: `${SB}/SB_Endor_01/Objectives/PF_SpaceBattles_MC80_Target_FinalStage_Engines`, why: 'the site maps the war’s reactor to the game’s last MC80 target, its engines, because the game has no reactor objective and the war puts its reactor among the engines' },
  },
  venator: {
    hull: { record: 'Gameplay/Vehicles/Capital/VenatorClass_StarDestroyer/VenatorStarDestroyer_Hull_01', why: 'the site maps the war’s hull to the Venator’s main hull module because no record of the game’s makes its hull an objective; the module is p132' },
    'gen-port': { record: null, why: 'the game’s Venator has no shield objective (SB_Kamino_01’s are its two bridge towers, its engines and its hangar laser), so the war keeps its own generators on the towers’ domes' },
    'gen-star': { record: null, why: 'the game’s Venator has no shield objective, so the war keeps its own generators on the towers’ domes' },
    bridge: { record: `${VENATOR}/HealthStateCollisionObjects/VenatorControlTowerLeft_HealthState`, objective: `${VENATOR}/PF_SB_Venator_Bridge_Left`, why: 'the site maps the war’s bridge to SB_Kamino_01’s Left bridge objective because the war’s bridge marker stands on that tower, on the drawn model’s +x side (wars.js calls it starboard; facing +z it is the ship’s left, the game’s Left); the other tower’s objective (PF_SB_Venator_Bridge_Right) has no war part to take it' },
    reactor: { record: `${VENATOR}/HealthStateCollisionObjects/VenatorStarDestroyer_EnginesLeft_HealthState`, objective: `${VENATOR}/PF_SB_Venator_Engines_Left`, why: 'the site maps the war’s reactor to the first of SB_Kamino_01’s two engine objectives because the game has no reactor and puts the Venator’s last objectives at its engines; the kit’s engine modules are one set of names, so a hit on either side’s engines is a hit on it' },
  },
  providence: {
    hull: { record: 'Gameplay/Vehicles/Capital/ProvidenceClassDreadnaught/ProvidenceClassDreadnaught_01', objective: `${KAMINO}/SpaceBattles_Dreadnaught/PF_SpaceBattles_ProvidenceClassDreadnaught_01`, why: 'the site maps the war’s hull to the dreadnought’s one module because it is the whole ship and SB_Kamino_01’s objective; it is p132, so no bolt hurts it' },
  },
  lucrehulk: {
    hull: { record: `${LUCREHULK}/LucrehulkClass_DroidBattleShip_MainHull_01`, part: 2, why: 'the site maps the war’s hull to the main hull ring’s plating because no record of the game’s makes the Lucrehulk’s hull an objective; it is p132' },
    'gen-port': { record: `${LUCREHULK}/LucrehulkClass_DroidBattleShip_TransmissionTowerPowerGenerator_01`, objective: `${SB}/SB_DroidBattleShip_01/Objectives/PF_LucrehulkClass_DroidBattleShip_TransmissionTowerPowerGenerator`, why: 'the site maps the war’s shield generators to SB_DroidBattleShip_01’s power generators because they are the game’s generator objectives and stand on the ring either side, where the war puts its generators (the core’s protector shields sit at the core instead)' },
    'gen-star': { record: `${LUCREHULK}/LucrehulkClass_DroidBattleShip_TransmissionTowerPowerGenerator_01`, objective: `${SB}/SB_DroidBattleShip_01/Objectives/PF_LucrehulkClass_DroidBattleShip_TransmissionTowerPowerGenerator`, why: 'the site maps the war’s starboard shield generator to SB_DroidBattleShip_01’s power generators because they are the game’s generator objectives and stand on the ring, where the war puts its generators' },
    bridge: { record: `${LUCREHULK}/LucrehulkClass_DroidBattleShip_ControlBridgeTower_01_Left`, objective: `${SB}/SB_DroidBattleShip_01/Objectives/PF_LucrehulkClass_DroidBattleShip_ControlTower_LeftArm_01`, why: 'the site maps the war’s bridge to SB_DroidBattleShip_01’s control tower objective (its left arm, the right one’s twin) because it is the Lucrehulk’s bridge' },
    reactor: { record: `${SB}/SB_DroidBattleShip_01/Objects/LucrehulkClass_DroidBattleShip_TheCore_ConceptObjective_01`, objective: `${SB}/SB_DroidBattleShip_01/Objects/PF_DroidBattleShip_CoreObjective_Temp_01`, why: 'the site maps the war’s reactor to SB_DroidBattleShip_01’s “Reactor” objective, the core, because it is the game’s reactor of the Lucrehulk' },
  },
  lightcruiser: {
    hull: { record: 'Gameplay/Vehicles/Capital/ImperialCruiser/ImperialCruiser_Hull_01', objective: 'Gameplay/Vehicles/SpaceBattles/ImperialLightCruiser/PF_SpaceBattles_ImperialCruiser', why: 'the site maps the war’s hull to the Arquitens’ hull module because it is the whole ship and SB_Fondor_01’s cruiser objective' },
  },
  corvette: {
    hull: { record: `${CR90}/CorvetteCR90_01`, part: 0, objective: `${CR90}/PF_CorvetteCR90_01`, why: 'the site maps the war’s hull to the CR90’s hull chain (its last state the wreck) because the whole corvette is the game’s objective (SB_Endor_01’s corvettes); its other part counts as the hull too' },
  },
  nebulon: {
    hull: { record: 'Objects/Props/Landmarks/_RebelAlliance/BD_FrigateNebulonB_01/FrigateNebulonB_01', why: 'the site maps the war’s hull to the frigate’s one part because the game’s Nebulon-B is a backdrop with no objective; it is p34, with no relation, so no bolt hurts it' },
  },
};
const SHIPS = { destroyer: 'Star Destroyer', moncal: 'MC80', venator: 'Venator', providence: 'Providence', lucrehulk: 'Lucrehulk', lightcruiser: 'Arquitens', corvette: 'CR90', nebulon: 'Nebulon-B' };

// The hull parts each turret record stands for, where the kit has the gun:
// a hit there is a hit on that turret (its hp and property, by a vehicle's
// rule) and it fires that record's bolts. The kit's guns are props (the Star
// Destroyer's heavy turbolaser a static model of its own 5,000, the MC80's
// main turret p132, the Venator's turrets p0 wrecks): the vehicle record is
// the gun the game fires.
export const TURRET_PARTS = {
  destroyer: {
    parts: { 'stardestroyer_heavyturbolaser_01#0': 'StarDestroyer_HeavyTurboLaser_02', 'stardestroyer_heavyturbolaser_01#2': 'StarDestroyer_HeavyTurboLaser_02' },
    why: 'the site gives the kit’s heavy turbolaser guns (its two, each a part) the game’s heavy turbolaser turret because that vehicle is the gun the game fires from a Star Destroyer; the small turbolaser turret has no kit part',
  },
  moncal: { parts: { mc80_mainturret: 'MC80_SmallGunTurret_Heavy' }, why: 'the site gives the kit’s one gun, its main turret, the MC80’s heavy turret because it fires the heavy turbolaser bolt; the anti-fighter turret has no kit part' },
  venator: { parts: { ventatorstardestroyer_turret_01_wreck: 'VenatorStarDestroyer_HeavyTurret' }, why: 'the site gives the kit’s turret modules (wrecks) the Venator’s heavy turret, the gun SB_Kamino_01 mounts on its Venator; the side turret has no kit part' },
};

// The notes the file opens with, by a key each (what reads them reads them by key)
const NOTES = {
  bolt: 'A bolt’s damage is `damage` out to falloff[0] metres, falling to damageFar at falloff[1] and damageFar beyond. What it hits takes the cell’s multiplier × that when the product reaches the cell’s threshold, else nothing; a pair with no relation takes noRelation’s cell, 0× under 2 (findings/62 §3).',
  fighter: 'A fighter’s health loses multiplier(bolt.property, fighter.property) × damage × vehicleDamageModifier when multiplier × damage reaches the threshold. fighter.property is the property of its VehicleEntityData.MaterialPair, whichever part the bolt met, because a part’s own relation spends only that part’s states, which reach the health only through a weak spot, and no starfighter has one (findings/62 §2). A friend’s bolt is × friendlyDamageModifier while friendly fire is off. A turret is a vehicle and takes a bolt the same way, against its own property.',
  capital: 'A capital’s part (a static model’s) loses multiplier(bolt.property, part.property) × damage when that reaches the threshold, then × (1 + n × squadBonus.perMate) where `squad` (n the shooter’s squadmates who hit it within squadBonus.cooldown seconds, at most 1 unless eachMate) and × damageMultiplier; a friend’s bolt does nothing unless friendlyFire (findings/62 §4).',
  chain: 'A part starts at health[0] and is spent down its states: a hit never takes it past the next state’s health, where it is held and moves to that state, and the rest of the hit goes back through the same rule (the threshold checked again, so a rest under it is dropped; the squad bonus and damageMultiplier applied again); in the last state it falls to 0. Only a hit on the part its state names (`states`, null for the whole object) spends it, and a state whose part is no longer the part hit sends its `children` FLT_MAX (findings/62 §4). A chain whose first state is one more than its second on a part no bolt hurts (an MC80 nodule’s 201 then 200, a Venator bridge’s 700 then 699) cannot be started by a bolt; what moves it on was not read.',
  blast: 'A blast (a bolt’s `blast`, its ExplosionEntityData) reaches a vehicle through its health component’s slot 43 (FUN_141bea1c0), which applies the record’s damage without a grid multiplier; that was read only so far (findings/62 §3), and whether a blast is held to the grid on a static model was not: `blast` is the record’s, its property beside it, for the damage rules to apply as they rule.',
  site: 'The `site` and `turretParts` blocks are the site’s choices (source: site), not records: which game record each of the war’s part names takes (its numbers then the record’s, with their sources) and which hull parts a turret record stands for, each with why. A hull part no site entry names counts as the hull.',
  precedence: 'A hit on a part a `site` entry names spends that entry’s chain (the war’s part), not the part’s own chain in `parts`, which stays as the record has it; a hit on a part `turretParts` names is a hit on that turret.',
  assumed: 'Assumed, as findings/62 leaves it open: a hit’s part is the Havok instance tag’s bits 0–15 (the exporter’s reading of hknpShape::m_userData, PhysicsExport.cs:367, which the data fits); the game’s code that keeps it was not followed.',
};

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
// (one of several objects of a type: its index in the record's objects)
const whereAt = (asset, obj, path) => `${asset.name}#${obj.$type}[${asset.objects.indexOf(obj)}].${path}`;

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

// A record with health (a kit module's blueprint, or a level's objective
// object): its physics asset (`res`), that asset's header and part
// properties, and its chains, one a PartComponentData with HealthStates,
// each begun on the part its first HealthStateData.PartIndex names (the part
// a hit must name to spend it: findings/62 §4's `iVar6 == iVar16`). Null,
// with a line in `missing`, where the record or its header is not there; a
// record with no physics asset has no chains.
function healthOf(root, name, { header, squad, missing }) {
  const bp = follow(root, name);
  if (!bp) {
    missing.push(`record: ${name}`);
    return null;
  }
  const rb = objectsOf(bp, 'RigidBodyData').find((r) => r.Asset?.$asset);
  if (!rb) return { bp, chains: [] };
  const res = rb.Asset.$asset.toLowerCase();
  const h = header(res);
  if (!h) {
    missing.push(`header: ${res}`);
    return null;
  }
  const props = partProperties(h, res);
  const ws = objectsOf(bp, 'WSStaticModelHealthComponentData')[0];
  // (a state's PartIndex 4294967295, −1, is the whole object)
  const index = (s) => (s.PartIndex >= 0 && s.PartIndex < h.parts ? s.PartIndex : null);
  const chains = [];
  for (const pc of objectsOf(bp, 'PartComponentData')) {
    const states = (pc.HealthStates ?? []).map((r) => deref(bp, r)).filter(Boolean);
    if (!states.length) continue;
    const first = index(states[0]);
    if (first === null) missing.push(`part: ${bp.name}'s first state names part ${states[0].PartIndex} of ${h.parts}`);
    else chains.push({ pc, states, first, indices: states.map(index) });
  }
  return { bp, res, h, props, ws, link: squad.get(bp.name.toLowerCase()), chains, index };
}

// a chain's numbers: its health and each state's property, the record's
// multiplier, friendly fire and squad link
function chainRow(r, c) {
  const at = c.indices.filter((i) => i !== null);
  const row = {
    health: c.states.map((s) => s.Health),
    _source: whereAt(r.bp, c.pc, 'HealthStates'),
    properties: c.indices.map((i) => (i === null ? null : r.props[i])),
    properties_source: `${r.res}#HavokPhysicsData.Materials[PartSlots[${[...new Set(at)].join(',')}]]`,
  };
  if (r.ws) Object.assign(row, { damageMultiplier: r.ws.DamageMultiplier, damageMultiplier_source: where(r.bp, r.ws, 'DamageMultiplier'), friendlyFire: r.ws.EnableFriendlyFire, friendlyFire_source: where(r.bp, r.ws, 'EnableFriendlyFire') });
  if (r.link) Object.assign(row, { squad: true, squad_source: r.link });
  return row;
}

// A kit module's parts with health: each chain named for the part it begins
// on, `property` that part's, `states` each state's part. `file` the kit's
// model file (a physics asset's own name for a one-asset capital); a module
// with no physics asset is no part of the hull, and has none.
export function moduleParts(root, file, ctx) {
  const res = /_physics_win32$/i.test(file) ? String(file).toLowerCase() : physicsKey(file);
  const name = byLower(root).get(res.replace(/_physics_win32$/, ''));
  if (!name) {
    ctx.missing.push(`module: ${file}`);
    return {};
  }
  const r = healthOf(root, name, ctx);
  if (!r?.h) return {};
  if (r.res !== res) ctx.missing.push(`physics: ${name} has ${r.res}`);
  const named = (i) => partName(file, i, r.h.parts);
  const out = {};
  for (const c of r.chains) {
    const key = named(c.first);
    if (out[key]) throw new Error(`${name}: two chains begin on part ${c.first}`);
    const row = chainRow(r, c);
    out[key] = { ...row, states: c.indices.map((i) => (i === null ? null : named(i))), property: row.properties[0], property_source: `${r.res}#HavokPhysicsData.Materials[PartSlots[${c.first}]]` };
  }
  // (the part components nested in a chain's Components, which a state leaving its part sends FLT_MAX: the Star Destroyer's heavy turbolaser's second gun)
  for (const c of r.chains) {
    const children = (c.pc.Components ?? []).map((ref) => r.chains.find((x) => x.pc === deref(r.bp, ref))).filter(Boolean).map((x) => named(x.first));
    if (children.length) Object.assign(out[named(c.first)], { children, children_source: whereAt(r.bp, c.pc, 'Components') });
  }
  return out;
}

// A vehicle turret: its WSVehicleHealthComponentData, its pair, and the
// bolts its override fires (the list where the record overrides the list,
// else the one; with no override, its firing functions' shots)
export function turretRow(root, blueprint, { missing }) {
  const bp = typeof blueprint === 'string' ? follow(root, blueprint) : blueprint;
  const name = typeof blueprint === 'string' ? blueprint : blueprint?.name;
  const hc = bp && objectsOf(bp, 'WSVehicleHealthComponentData')[0];
  const v = bp && objectsOf(bp, 'VehicleEntityData')[0];
  if (!hc || !v) {
    missing.push(`turret: ${name}`);
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
  if (!bolts.length) {
    missing.push(`turret: ${name} fires no bolt`);
    return null;
  }
  return { hp: hc.MaxHealth, hp_source: where(bp, hc, 'MaxHealth'), property: propertyOf(v.MaterialPair?.Packed ?? 0), property_source: where(bp, v, 'MaterialPair'), bolts };
}

// One of the war's part names on a capital (the site's choice, SITE): the
// record's chain (its numbers and sources) and the hull parts a hit on it
// is. `files` the kit's model files, `inside` the kit files inside each
// level object's box (capitalModules).
function siteRow(root, kind, id, { files, inside }, ctx) {
  const pick = SITE[kind]?.[id] ?? { record: null, why: OWN(SHIPS[kind] ?? kind) };
  const out = { source: 'site', why: pick.why, record: pick.record };
  if (pick.objective) out.objective = pick.objective;
  if (pick.record === null) return { ...out, parts: [] };
  const r = healthOf(root, pick.record, ctx);
  const c = r && (pick.part === undefined ? r.chains.reduce((a, b) => (b.states.length > a.states.length ? b : a), r.chains[0]) : r.chains.find((x) => x.first === pick.part));
  if (!c) {
    ctx.missing.push(`site: ${kind}'s ${id}: no chain in ${pick.record}`);
    return { ...out, parts: [] };
  }
  // (a kit module's own parts; a level object's, the kit modules inside its box; a site hull's, the name's)
  const own = files.find((f) => physicsKey(f) === r.res || String(f).toLowerCase() === r.res);
  const modules = own ? [own] : (inside[pick.record] ?? []);
  if (!own && !SITE_OVER_GAME[kind] && !inside[pick.record]) ctx.missing.push(`site: ${kind}'s ${id}: where ${pick.record} stands on the kit`);
  const parts = SITE_OVER_GAME[kind]
    ? [id]
    : modules.flatMap((f) => {
        const n = ctx.header(/_physics_win32$/i.test(f) ? String(f).toLowerCase() : physicsKey(f))?.parts ?? 0;
        return Array.from({ length: n }, (_, i) => partName(f, i, n));
      });
  return { ...out, ...chainRow(r, c), parts: [...new Set(parts)] };
}

// A capital: its modules' parts, its turrets, the war's names on them and
// the turrets' parts. Where its hull is the site's (bf2017-hulls.mjs's
// SITE_OVER_GAME), no hull part carries a module's name: its parts are its
// site entries'.
export function capitalRow(root, kind, kit, ctx) {
  const k = Array.isArray(kit) ? { files: kit, inside: {} } : kit;
  const parts = {};
  if (!SITE_OVER_GAME[kind]) for (const file of [...new Set(k.files)]) Object.assign(parts, moduleParts(root, file, ctx));
  const turrets = {};
  for (const t of ctx.turrets[kind] ?? []) {
    const row = turretRow(root, t, ctx);
    if (row) turrets[shortName(t)] = row;
  }
  const site = Object.fromEntries(SITE_NAMES.map((id) => [id, siteRow(root, kind, id, k, ctx)]));
  const row = { parts, turrets, site };
  const tp = TURRET_PARTS[kind];
  if (tp && !SITE_OVER_GAME[kind]) {
    for (const [part, t] of Object.entries(tp.parts)) if (!turrets[t]) ctx.missing.push(`turretParts: ${kind}'s ${part} names ${t}, not a turret of its`);
    row.turretParts = { source: 'site', why: tp.why, parts: tp.parts };
  }
  return row;
}

// The kit files whose meshes' centres sit inside an object's box (10 % over)
// where its level's SpaceBattle sub-level places both: the object's place
// in the frame of its nearest kit anchor, against the parts of the kit's
// model (piecesOf's, in its anchor's frame)
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qinv = (q) => [-q[0], -q[1], -q[2], q[3]];
export function filesInside(map, model, mesh, margin = 1.1) {
  const kit = KITS.find((k) => k.kit === model.kit);
  const sub = new Int32Array(map.instances.count).fill(-1);
  for (const g of map.groups) sub.fill(g.sub, g.first, g.first + g.count);
  const battle = [...Array(map.instances.count).keys()].filter((i) => /\/spacebattle$/i.test(String(map.subworlds[sub[i]]))).map((i) => instanceOf(map, i));
  const fileOf = (x) => String(map.meshes[x.mesh]?.file ?? '').toLowerCase();
  const want = `models/${String(mesh).toLowerCase()}.glb`;
  const o = battle.find((x) => fileOf(x) === want);
  const anchors = kit?.anchor ? battle.filter((x) => kit.anchor.test(fileOf(x))) : [];
  if (!o || !anchors.length) return null;
  const far = (x) => Math.hypot(...x.at.map((v, k) => v - o.at[k]));
  const a = anchors.reduce((b, x) => (far(x) < far(b) ? x : b));
  const inv = qinv(a.quaternion);
  const at = rotate(inv, o.at.map((v, k) => v - a.at[k])).map((v, k) => v / a.scale[k]);
  const q = qmul(inv, o.quaternion);
  const box = map.meshes[o.mesh];
  const mid = (m) => m.min.map((v, k) => (v + m.max[k]) / 2);
  const meshes = new Map(map.meshes.map((m) => [m.file, m]));
  const out = new Set();
  for (const p of model.parts) {
    const m = meshes.get(p.file);
    if (!m) continue;
    const c = rotate(p.quaternion, mid(m).map((v, k) => v * p.scale[k])).map((v, k) => v + p.at[k]);
    const d = rotate(qinv(q), c.map((v, k) => v - at[k])).map((v, k) => v / (o.scale[k] / a.scale[k]));
    if (d.every((v, k) => Math.abs(v - mid(box)[k]) <= ((box.max[k] - box.min[k]) / 2) * margin)) out.add(p.file);
  }
  return [...out];
}

// Each game capital's kit modules, as its fleet file was made of them
// (piecesOf over its space level's map, `maps` the folder holding maps/;
// for one made from one asset, that asset: bf2017-hulls.mjs's CAPITAL_KITS),
// and the kit files inside each site record that is a level's object
export function capitalModules(root, maps, kits = CAPITAL_KITS) {
  const levels = new Map();
  const out = {};
  for (const [kind, k] of Object.entries(kits)) {
    if (kind.includes('/')) continue;
    if (k.physics) {
      out[kind] = { files: [k.physics], inside: {} };
      continue;
    }
    if (!levels.has(k.space)) {
      const base = join(maps, 'maps', SPACE[k.space].map);
      const map = readMap(JSON.parse(readFileSync(`${base}.json`, 'utf8')), readFileSync(`${base}.bin`));
      levels.set(k.space, { map, pieces: piecesOf(map, { system: k.space }) });
    }
    const { map, pieces } = levels.get(k.space);
    const model = pieces.models[k.model];
    const files = (model?.parts ?? []).map((p) => p.file);
    const inside = {};
    for (const pick of Object.values(SITE[kind] ?? {})) {
      if (!pick.record || SITE_OVER_GAME[kind] || files.some((f) => physicsKey(f) === pick.record.toLowerCase() + '_physics_win32')) continue;
      const mesh = objectsOf(follow(root, pick.record) ?? { objects: [] }, 'StaticModelEntityData')[0]?.Mesh?.$asset;
      const found = mesh && model && filesInside(map, model, mesh);
      if (found) inside[pick.record] = found;
    }
    out[kind] = { files, inside };
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
  for (const [kind, kit] of Object.entries(kits)) capitals[kind] = capitalRow(root, kind, kit, ctx);

  // the grid's cells for every property here, held to the other levels' grids
  const bolts = [...Object.values(fighterRows).map((f) => f.bolt), ...Object.values(capitals).flatMap((c) => Object.values(c.turrets).flatMap((t) => t.bolts))].filter(Boolean);
  const attackers = [...new Set([...ATTACKERS, ...bolts.flatMap((b) => [b.property, b.blast?.property])].filter((p) => p !== undefined))].sort((a, b) => a - b);
  const sited = Object.values(capitals).flatMap((c) => Object.values(c.site).flatMap((s) => s.properties ?? []));
  const hit = [...Object.values(fighterRows).map((f) => f.property), ...sited, ...Object.values(capitals).flatMap((c) => [...Object.values(c.parts).flatMap((p) => p.properties), ...Object.values(c.turrets).map((t) => t.property)])];
  const targets = [...new Set([...TARGETS, ...hit].filter((p) => p !== null))].sort((a, b) => a - b);
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

  // the parts no attacker here can hurt in any state (p132, p0, p34: 0×
  // or no relation) left out, but those the site or a turret names
  const hurts = (p) => p !== null && attackers.some((a) => grid[a][p].multiplier > 0);
  let dropped = 0;
  for (const c of Object.values(capitals)) {
    const named = new Set([...Object.values(c.site).flatMap((s) => s.parts), ...Object.keys(c.turretParts?.parts ?? {})]);
    for (const [name, p] of Object.entries(c.parts))
      if (!named.has(name) && !p.properties.some(hurts)) {
        delete c.parts[name];
        dropped++;
      }
  }
  const squadBonus = squadBonusOf(root);
  if (!squadBonus) missing.push(`squad bonus: ${SQUAD_BONUS}`);

  return {
    _notes: { ...NOTES, dropped: `${dropped} capital parts are left out: every state on a property no bolt here hurts (p132, p0, p34), and neither the site nor a turret names them; a hit on one does nothing.` },
    gridFrom: { grid: GRID, indexMap: `${asset.name}#MaterialGridData.MaterialIndexMap`, agrees },
    grid,
    noRelation,
    squadBonus,
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
