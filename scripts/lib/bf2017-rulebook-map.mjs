// The map rulebook (maps/<level>.json): where a level's modes put their
// spawns, spawn areas, objective and out-of-bounds volumes, the walkers'
// paths, locators and cameras, read from the level's mode layers
// (`Levels/MP/<Level>/<Layer>_*`, LayerData records), with the terrain and
// the vehicle spawns from the web build's map manifest.
//
//   AlternateSpawnEntityData       spawn points: Team, Priority, Enabled, Transform
//   SpawnLocationFinderShapeData   spawn areas: Team, Enabled, Points, Height
//   VolumeVectorShapeData          volumes: Points (on XZ, Y the floor), Height
//   SphereData, OBBData            spheres and boxes
//   AIWaypointsShapeData           paths: Points (the walkers' path). The
//                                  VehicleWaypointData it points at hold speeds
//                                  and stops, no positions.
//   Locator/LocalLocator/CameraEntityData   named transforms, cameras
//   CheckedLocalizedStringEntityData        the objective and stage strings (Sid)
//   Spatial/LogicPrefabReferenceObjectData  the mode's prefabs (capture points…)
//   SpaceBattleObjectiveListEntityData      a space level's Starfighter Assault:
//                                  its phases in order, each phase's objectives
//                                  (name, owning team, the attacker's and the
//                                  defender's instruction strings, as hashes),
//                                  its side objectives (the TIE bomber flights)
//
// A space level (`Levels/Space/<Level>/`) has no terrain; its capital ships
// and objectives are placed objects of the mode's own sub-level, read from
// the map manifest's instances (`placed`: mesh, position, rotation).
//
// Ids are `<layer>:<object index>`, stable while the export is.

import { readFileSync } from 'node:fs';
import { follow, isSequel, pointsOf, readWebJson, shortName, transformOf, webFile } from './bf2017-ebx.mjs';
import { indexOf } from './bf2017-rulebook.mjs';

// The mode layers by the game's own mode ids (UI/Data/GameModes/<id>'s
// GameModeId and AurebeshGameModeName: Domination "STRIKE", Mode1
// "SUPREMACY", Mode3 "EWOK HUNT", Mode5 and the Strike/Extraction maps'
// Extraction "EXTRACTION", Mode6 "HERO SHOWDOWN", Mode9 the co-op missions,
// ModeC "JETPACK CARGO", Mode7 "HERO STARFIGHTERS"; lane F's modes.json names them the same).
// Mode8 ("INSTANT ACTION") has no sub-level of its own: its Mode8_Shapes ride in Supremacy's maps.
export const MODE_LAYERS = { galacticAssault: 'FantasyBattle', hvv: 'HeroArena', blast: 'TeamDeathmatch', strike: 'Domination', supremacy: 'Mode1', extraction: 'Mode5', ewokHunt: 'Mode3', showdown: 'Mode6', coop: 'Mode9', jetpackCargo: 'ModeC', heroStarfighters: 'Mode7', arcade: 'PlanetaryMissions', starfighter: 'SpaceBattle' };
// (a level that names a mode's layer another way: Geonosis_01's hero arena, Naboo_02's Blast, Cloud City's Extraction, a space level's arcade)
const ALT_LAYERS = { HeroArena: ['HeroesVsVillains'], TeamDeathmatch: ['Blast'], Mode5: ['Extraction'], PlanetaryMissions: ['SpaceArcadeTeamBattle'] };
// A mode's objective prefabs: what a rule needs placed (a bomb, the carried
// objective and its drop-off, a capture point, the payload, an uplink)
const OBJECTIVE = /objective|bomb|ctf|flag|dropoff|capture|payload|extraction|commandpost|uplink|cargo|escort/i;

// The layers a mode's rules read, by suffix (art, automation, sound, the
// living world's ambient paths and the cinematics are not rules).
const RULE_LAYER = /_(Logic|Spawns|Spawns_Team\d|Shapes|Shapes_\w+|Inf_Shapes_\w+|OOBTeam\d|Gameplay|Global|DefendAreas|CaptureAreas|Skirmish_DefendAreas|Phase\d|Phase\d_(Empire|Rebel)Spawns|SpawnZones|Defend_Logic|Defend_Shapes|CombatAreas|FriendZones|Traps|Pickups|Teleport|Volumes)$/i;
// (a space level's launch points are its phases' own: SpaceBattle_Phase1, SpaceBattle_Phase2_EmpireSpawns…)
const phaseOf = (layer) => Number(layer.match(/_Phase(\d)/i)?.[1] ?? 0) || null;
const EXTRA_LAYERS = { Mode9: ['ModeDefend_Spawns_Team1', 'ModeDefend_Spawns_Team2'], SpaceBattle: ['SpaceBattle_ScriptedEvents', 'SpaceBattle_SecondaryObjective_Cruisers'] };
// the layers whose prefabs are the mode's (a space level's objectives sit in its scripted events and side objectives)
const PREFAB_LAYER = /_(Logic|Gameplay|ScriptedEvents|SecondaryObjective_\w+|Traps|Pickups|Teleport)$/i;
// what a space level's mode sub-level places that is not the battle: the end
// of round's star cards and its room, and the dressing no rule reads (decals,
// greebles, a hangar's boxes, crates and containers)
const NOT_PLACED = /starcard|nowhere|decal|greeble|detailpanel|box_m|crate|container|junk/i;

const PLACED = new Set(['AlternateSpawnEntityData', 'OBBData', 'LocatorEntityData', 'LocalLocatorEntityData', 'CameraEntityData']);
const teamOf = (t) => Number(String(t ?? '').replace(/^Team/, '')) || 0;
// (to a tenth of a millimetre)
const r3 = (v) => Math.round(v * 10000) / 10000;
const vec = (p) => [r3(p.x), r3(p.y), r3(p.z)];
const where = (layer, o) => `${layer}#${o.$type}`;

function kindOf(layer) {
  if (/OOB/.test(layer)) return 'oob';
  if (/Capture/.test(layer)) return 'capture';
  if (/Defend/.test(layer)) return 'defend';
  if (/CombatArea/i.test(layer)) return 'combat';
  return 'shape';
}

// A quaternion [x, y, z, w]'s yaw: the heading of its forward (+Z) axis.
const yawOfQuat = ([x, y, z, w]) => Math.atan2(2 * (x * z + w * y), 1 - 2 * (x * x + y * y));

export function levelName(root, level) {
  // (a whole path: S9_3/Hoth_02/Hoth_02, Levels/SP/A1/M0LIB/DS02)
  if (level.includes('/')) {
    const keys = [...indexOf(root).keys()];
    return keys.find((n) => n.toLowerCase() === level.toLowerCase()) ?? level;
  }
  const want = [`levels/mp/${level}/${level}`.toLowerCase(), `levels/space/${level}/${level}`.toLowerCase()];
  // (or under a season's folder: S5_1/Levels/MP/Geonosis_01/Geonosis_01)
  const keys = [...indexOf(root).keys()];
  return keys.find((n) => want.includes(n.toLowerCase())) ?? keys.find((n) => want.some((w) => n.toLowerCase().endsWith(`/${w}`))) ?? null;
}

// A string id's hash (LocalizedStringId.StringHash, signed) as English.json keys it
const hexOf = (n) => (typeof n === 'number' ? (n >>> 0).toString(16).toUpperCase().padStart(8, '0') : null);
const enumOf = (v, prefix) => String(v ?? '').replace(prefix, '');

// A space battle's phases and side objectives, as the objective list has them
function spaceBattle(asset, o, base) {
  const at = (r) => (typeof r?.$ref === 'number' ? asset.objects[r.$ref] : null);
  const info = (r) => {
    const p = at(r);
    const out = p ? { instruction: hexOf(at(p.InstructionMessageStringId)?.StringHash), completion: hexOf(at(p.CompletionMessageStringId)?.StringHash) } : null;
    // (a primary objective's words are the phase's strings, not its own: none here)
    return out && (out.instruction || out.completion) ? out : null;
  };
  const objective = (r) => {
    const x = at(r);
    return x ? { name: x.Name, team: teamOf(x.OwningTeam), icon: enumOf(x.IconType, 'SpaceBattleObjectiveType_'), metric: enumOf(x.Metric, 'SpaceBattleObjectiveMetric_'), showHealth: Boolean(x.ShowHealth), attack: info(x.AttackingTeamInfo), defend: info(x.DefendingTeamInfo) } : null;
  };
  return {
    ...base,
    attacker: teamOf(o.AttackingTeam),
    defender: teamOf(o.DefendingTeam),
    phases: (o.PhaseList ?? []).map(at).filter(Boolean).map((p) => ({ name: p.Name, objectives: (p.Objectives ?? []).map(objective).filter(Boolean) })),
    secondary: (o.SecondaryObjectives ?? []).map(objective).filter(Boolean),
  };
}

// a vector turned by a quaternion [x, y, z, w]
function turn([x, y, z, w], [vx, vy, vz]) {
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
}

// A space level's placed objects in a sub-level (its capital ships, their
// nodules and engines, the corvettes, the mines): from the map manifest's
// instances, those of kind `object`
function placedIn(root, manifest, rel, sub) {
  const s = manifest.subworlds.findIndex((n) => shortName(n.name ?? n).toLowerCase() === sub.toLowerCase());
  const file = s >= 0 && manifest.bin?.file ? webFile(root, `${rel.slice(0, rel.lastIndexOf('/') + 1)}${manifest.bin.file}`) : null;
  if (!file) return [];
  const buf = readFileSync(file);
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const out = [];
  for (const g of manifest.groups) {
    if (g.sub !== s || g.kind !== 'object') continue;
    const mesh = manifest.meshes[g.mesh]?.file ?? '';
    if (NOT_PLACED.test(mesh) || isSequel(mesh)) continue;
    for (let i = g.offset; i < g.offset + g.count; i++) {
      const p = [0, 1, 2].map((k) => r3(v.getFloat32(manifest.bin.position + (i * 3 + k) * 4, true)));
      const q = [0, 1, 2, 3].map((k) => r3(v.getInt16(manifest.bin.quaternion + (i * 4 + k) * 2, true) / 32767));
      // (the middle of its bounds, turned and moved as the instance is, and half their diagonal: where to aim at it, and how big)
      const { min = [0, 0, 0], max = [0, 0, 0] } = manifest.meshes[g.mesh];
      const c = turn(q, [0, 1, 2].map((k) => (min[k] + max[k]) / 2));
      out.push({ mesh: shortName(mesh).replace(/_mesh\.glb$/, ''), at: p, quat: q, centre: p.map((x, k) => r3(x + c[k])), r: r3(Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2), _source: `web/${rel}#instances.${i}` });
    }
  }
  return out;
}

// The names of the mode prefabs' input fields (djb2-xor, as the graphs hash
// them: scripts/lib/bf2017-rulebook-map.mjs's djb): those the modes read
const INPUT_NAMES = ['DefendingTeam', 'AttackingTeam', 'BombALocation', 'BombBLocation', 'BombAName', 'BombBName', 'CheckpointPosition1', 'CheckpointPosition2', 'CheckpointPosition3', 'CP1Overtime', 'CP2Overtime', 'CP3Overtime', 'NumberCheckPoints', 'ObjectiveIndex', 'CaptureDuration', 'MaxReinforcements', 'MaxBoardingTickets', 'Team', 'Owner', 'VisibleMaxDistance'];
export const djb = (name) => {
  let h = 5381;
  for (const c of Buffer.from(name)) h = ((h * 33) ^ c) >>> 0;
  return h;
};
const INPUT_BY_HASH = new Map(INPUT_NAMES.map((n) => [djb(n), n]));
const fieldName = (f) => {
  const h = Number.parseInt(String(f ?? '').replace(/^0x/, ''), 16);
  return INPUT_BY_HASH.get(h >>> 0) ?? String(f);
};

// An interface field's value as the export prints it: a team, a number, a transform's position
function valueOf(v) {
  const s = String(v ?? '');
  let m = s.match(/^TeamId Team(\d)/);
  if (m) return Number(m[1]);
  m = s.match(/^(?:Int32|Float32|UInt32) (-?[\d.e+-]+)/);
  if (m) return Number(m[1]);
  m = s.match(/^LinearTransform \(.*\(([-\d.e]+),([-\d.e]+),([-\d.e]+)\)\)$/);
  if (m) return [r3(+m[1]), r3(+m[2]), r3(+m[3])];
  m = s.match(/^Boolean (True|False)/);
  if (m) return m[1] === 'True';
  return null;
}

const modeLayerOf = (modes, mode, names, dir) => [modes[mode], ...(ALT_LAYERS[modes[mode]] ?? [])].map((l) => l.toLowerCase()).find((l) => names.some((n) => n.slice(dir.length).toLowerCase() === l));

// A mode's sub-world wires the level's settings into its prefabs (property
// connections across its layers): a locator's position into a site field
// (Strike's BombALocation), the sub-world's interface values (Strike's
// DefendingTeam). Each prefab gains `inputs`: field → a value or a position.
function wire(root, row, mode, byGuid, subName) {
  const sub = subName ? follow(root, subName) : null;
  const top = sub?.objects?.[0];
  if (!top) return;
  const fields = new Map();
  for (const o of sub.objects) if (o?.$type === 'InterfaceDescriptorData') for (const f of o.Fields ?? []) fields.set(String(f.Name), valueOf(f.Value));
  for (const c of top.PropertyConnections ?? []) {
    const target = byGuid.get(c.Target?.$class);
    if (!target?.prefab || target.prefab.mode !== mode) continue;
    let value = null;
    if (c.Source?.$class) value = byGuid.get(c.Source.$class)?.at ?? null;
    else if (sub.objects[c.Source?.$ref]?.$type === 'InterfaceDescriptorData') value = fields.get(String(c.SourceField)) ?? null;
    if (value == null) continue;
    (target.prefab.inputs ??= {})[fieldName(c.TargetField)] = value;
    target.prefab.inputs_source = `${subName}#PropertyConnections`;
  }
}

// A campaign map's objectives (its mission's ObjectivesDefinition records: the
// tree of top-level and sub-level objectives, their strings and timings)
function campaignObjectives(root, all, name) {
  const mission = name.slice(0, name.lastIndexOf('/') + 1).toLowerCase();
  const defs = all.filter((n) => indexOf(root).get(n)?.type === 'ObjectivesDefinition' && n.toLowerCase().startsWith(mission) && n.slice(mission.length).split('/').length <= 2);
  return defs.flatMap((d) => {
    const asset = follow(root, d);
    if (!asset) return [];
    return asset.objects.flatMap((o, i) =>
      o?.$type === 'Objective'
        ? [{ id: o.ObjectiveId, name: o.ObjectiveName, level: o.ObjectiveLevel, parent: o.ParentId || null, index: o.Index, visibleTime: o.VisibleTime, completedTime: o.CompletedTime, dependsOn: (o.DependsOnObjectives ?? []).map((r) => asset.objects[r?.$ref]?.ObjectiveId).filter((x) => x != null), _source: `${d}#Objective.${i}` }]
        : [],
    );
  });
}

export function mapRow(root, level, { modes = MODE_LAYERS } = {}) {
  // (the sequel era's levels are refused: SB_Resurgent_01, SB_SpaceBear_01, Jakku, Takodana…)
  if (isSequel(level)) throw new Error(`${level}: a sequel-era level, refused`);
  const name = levelName(root, level);
  // (a campaign map is a folder of detached sub-worlds: Levels/SP/A1/M0LIB/DS02/)
  const campaign = /(^|\/)SP\//i.test(name ?? level) && !indexOf(root).has(name);
  const dir = campaign ? `${name}/` : name ? name.slice(0, name.lastIndexOf('/') + 1) : `Levels/MP/${level}/`;
  const space = /^Levels\/Space\//i.test(dir);
  const all = [...indexOf(root).keys()];
  const names = all.filter((n) => n.toLowerCase().startsWith(dir.toLowerCase()) && !n.slice(dir.length).includes('/'));
  const row = { level: name, modes: [], spawns: [], polygons: [], volumes: [], spheres: [], boxes: [], waypoints: [], oob: { team1: [], team2: [] }, locators: [], cameras: [], prefabs: [], strings: [], unplaced: [], _missing: [] };
  const seen = new Set();
  // (each mode's objects by guid, for its sub-world's wiring: guid → a prefab row, or a locator's position)
  const byGuid = new Map();
  for (const [mode, named] of Object.entries(modes)) {
    // (any case: Kamino_01's hero showdown is `mode6`)
    const found = [named, ...(ALT_LAYERS[named] ?? [])].map((l) => names.find((n) => n.slice(dir.length).toLowerCase() === l.toLowerCase())).find(Boolean);
    if (!found) continue;
    const layer = found.slice(dir.length);
    row.modes.push(mode);
    // (any case: the droid battleship's are `Spacebattle_Phase1`)
    const layers = names.filter((n) => shortName(n).toLowerCase().startsWith(`${layer}_`.toLowerCase()) && RULE_LAYER.test(shortName(n))).concat((EXTRA_LAYERS[layer] ?? []).map((l) => `${dir}${l}`).filter((n) => names.includes(n)));
    for (const ln of layers) {
      const asset = follow(root, ln);
      if (!asset) {
        row._missing.push(`layer: ${ln}`);
        continue;
      }
      const lay = shortName(ln);
      asset.objects.forEach((o, i) => {
        if (!o) return;
        const id = `${lay}:${i}`;
        const base = { id, mode, layer: lay, _source: where(ln, o) };
        // (a placed object without a transform is listed missing, not read)
        if (PLACED.has(o.$type) && !transformOf(o)) {
          row._missing.push(`transform: ${id}`);
          return;
        }
        switch (o.$type) {
          case 'AlternateSpawnEntityData': {
            const t = transformOf(o);
            const key = `${mode}|${o.Team}|${vec(o.Transform.trans).map((v) => v.toFixed(2)).join(',')}`;
            if (seen.has(key)) return;
            seen.add(key);
            row.spawns.push({ ...base, team: teamOf(o.Team), priority: o.Priority, enabled: Boolean(o.Enabled), at: vec(o.Transform.trans), yaw: r3(t.yaw), ...(phaseOf(lay) ? { phase: phaseOf(lay) } : {}) });
            return;
          }
          case 'SpawnLocationFinderShapeData': {
            const p = pointsOf(o);
            row.polygons.push({ ...base, team: teamOf(o.Team), enabled: Boolean(o.Enabled), points: p.points.map(([x, z]) => [r3(x), r3(z)]), y: r3(p.y), height: p.height });
            return;
          }
          case 'VolumeVectorShapeData': {
            const p = pointsOf(o);
            const kind = kindOf(lay);
            row.volumes.push({ ...base, kind, points: p.points.map(([x, z]) => [r3(x), r3(z)]), y: r3(p.y), height: p.height, closed: p.closed });
            const team = lay.match(/OOBTeam(\d)/)?.[1];
            if (team) row.oob[`team${team}`]?.push(id);
            return;
          }
          case 'SphereData': {
            const p = pointsOf(o);
            row.spheres.push({ ...base, at: p.at.map(r3), r: r3(p.r) });
            return;
          }
          case 'OBBData': {
            const p = pointsOf(o);
            row.boxes.push({ ...base, at: p.at.map(r3), half: p.half.map(r3), yaw: r3(p.yaw) });
            return;
          }
          case 'AIWaypointsShapeData':
            row.waypoints.push({ ...base, points: (o.Points ?? []).map(vec), closed: Boolean(o.IsClosed) });
            return;
          case 'LocatorEntityData':
          case 'LocalLocatorEntityData': {
            const t = transformOf(o);
            if (t && o.$guid) byGuid.set(o.$guid, { at: t.at.map(r3), id });
            if (t) row.locators.push({ ...base, at: t.at.map(r3), yaw: r3(t.yaw) });
            return;
          }
          case 'CameraEntityData': {
            const t = transformOf(o);
            if (t) row.cameras.push({ ...base, at: t.at.map(r3), yaw: r3(t.yaw), pitch: r3(Math.asin(Math.max(-1, Math.min(1, o.Transform.forward.y)))), focalLength: o.FocalLength, aperture: o.Aperture, fov: o.Fov });
            return;
          }
          case 'SpaceBattleObjectiveListEntityData':
            row.spaceBattle = spaceBattle(asset, o, base);
            return;
          case 'CheckedLocalizedStringEntityData':
            if (o.Sid && !row.strings.includes(o.Sid)) row.strings.push(o.Sid);
            return;
          case 'SpatialPrefabReferenceObjectData':
          case 'LogicPrefabReferenceObjectData': {
            const t = transformOf(o);
            const bp = o.Blueprint?.$asset;
            if (!bp || !PREFAB_LAYER.test(lay) || isSequel(bp)) return;
            const at = t && /Spatial/.test(o.$type) ? { at: t.at.map(r3), yaw: r3(t.yaw) } : null;
            const prefab = { ...base, name: shortName(bp), blueprint: bp, ...(at ?? {}) };
            row.prefabs.push(prefab);
            if (o.$guid) byGuid.set(o.$guid, { prefab });
            return;
          }
          default:
        }
      });
    }
  }

  for (const mode of row.modes) wire(root, row, mode, byGuid, names.find((n) => n.slice(dir.length).toLowerCase() === modeLayerOf(modes, mode, names, dir)));
  // (an objective the extractor cannot place: no transform of its own and no site wired in; a mode on this map refuses to start until it is)
  for (const p of row.prefabs) if (!p.at && OBJECTIVE.test(p.name) && !Object.keys(p.inputs ?? {}).some((k) => /location|transform/i.test(k))) row.unplaced.push({ id: p.id, mode: p.mode, layer: p.layer, name: p.name, why: 'an objective prefab with no transform and no site wired to it', _source: p._source });
  if (campaign) row.objectives = campaignObjectives(root, all, name);
  // (the map's manifest where the bucket's index files it, else by its name)
  const filed = (readWebJson(root, 'maps/index.json') ?? []).find((r) => r.level.toLowerCase() === String(name).toLowerCase())?.file;
  const manifestFile = filed ?? `maps/${(name ?? '').toLowerCase()}.json`;
  const manifest = readWebJson(root, manifestFile);
  if (manifest) {
    const rel = `web/${manifestFile}`;
    const t = manifest.terrain?.[0];
    if (t) row.terrain = { ...t, _source: `${rel}#terrain.0` };
    // (a space level's: those of the level itself and of its modes' sub-levels, not the arcade's or the lobby's)
    const subs = !space ? null : new Set((manifest.subworlds ?? []).map((n, i) => [shortName(n.name ?? n), i]).filter(([n]) => n === shortName(name) || n === modes.starfighter).map(([, i]) => i));
    row.vehicleSpawns = (manifest.vehicleSpawns ?? []).flatMap((v, i) => (!isSequel(v.blueprint ?? '') && (!subs || v.sub == null || subs.has(v.sub)) ? [{ blueprint: v.blueprint, at: v.position.map(r3), yaw: r3(yawOfQuat(v.quaternion)), sub: v.sub ?? null, _source: `${rel}#vehicleSpawns.${i}` }] : []));
    // (a space level's battle stands in its mode's own sub-level)
    if (space) row.placed = Object.fromEntries(row.modes.filter((mode) => mode === 'starfighter').map((mode) => [mode, placedIn(root, manifest, rel.replace(/^web\//, ''), modes[mode])]));
  } else row._missing.push(`map manifest: ${manifestFile}`);

  const xs = [...row.spawns.map((s) => [s.at[0], s.at[2]]), ...row.volumes.flatMap((v) => v.points)];
  if (xs.length) {
    const pad = 50;
    row.bounds = {
      min: [Math.min(...xs.map((p) => p[0])) - pad, Math.min(...xs.map((p) => p[1])) - pad],
      max: [Math.max(...xs.map((p) => p[0])) + pad, Math.max(...xs.map((p) => p[1])) + pad],
      _source: 'derived: the spawns and volumes on XZ, padded 50 m',
    };
  }
  return row;
}
