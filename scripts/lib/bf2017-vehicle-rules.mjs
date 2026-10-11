// The vehicles' bodies and handling from the game's own records (lane P3 of
// the physics design: docs/superpowers/plans/2026-10-10-bf2017-phaseP3-
// vehicles.md), beside the soldier's, the bolts' and the ragdolls' builders
// in bf2017-physics-rules.mjs (whose loadAsset/deref/refused/checkSources
// this reads with; a file of its own as that one is near its 800 lines).
//
// A row is one VehicleBlueprint: its root rigid body (mass, centre of mass,
// the physics asset and which of its Havok roots collides and which takes
// rays), the other bodies (a walker's legs and feet, keyframed to its bones),
// the vehicle entity's thresholds (the speed it kills a soldier at, the top
// hit's height, the speed a crash starts to hurt it, upside down), and its
// crashed parts (the debris clusters its last health state spawns: each an
// ObjectBlueprint with a DebrisClusterData, its own body and push).
//
// The handling. The ground vehicles' `_Handling` layers hold no speeds
// themselves, but the layer places the engine's prefab
// (`Gameplay/Prefabs/Vehicles/PF_74Z_SpeederbikeEngine_Criterion` and its
// kin) and the prefab's physics actions do: a speeder's
// `SpeederBikePhysicsActionData` (`CruiseSpeedMPS`, `ReferenceMaxSpeed`,
// `ForceMinMax`, `TurnRate`) and `LinearRepulsorLiftPhysicsActionData`
// (`TargetHoverHeight`), a hover tank's `HoverTankPhysicsActionData`
// (`TargetLinearSpeed`, `BoostTargetSpeed`, `TargetYawVel`) and
// `HoverLiftPhysicsActionData` (`HoverSpringRestLength`). A walker has no
// physics action that moves it: the animation does, so its speeds are its
// clips' root travel (web/anims.jsonl's `distance` over `duration`; the
// soldier's sprint clip reads 5.90 m/s against its record's 5.97, so the
// clip's own clock is the game's) and its turn the turn clip's trajectory
// yaw over its duration (read from the clip's GLB). Every number names its
// record; a number the records don't give is `source: "hand"` in rides.js,
// not here.
//
//   vehicleRow(asset, { load, anims, turns }) → { id, name, kind ('hover' |
//     'walker' | 'flyer' | 'mount' | 'stationary' | 'ground'), mass,
//     centreOfMass, inertia, bodyMass, parts: [{ part, root, mass, motion }],
//     physics: { asset, collisionRoot, raycastRoot }, kill: { speed,
//     blockTime, topHitHeight, topHitAngle, mines }, crash: { speed,
//     magnifier }, upsideDown: { angle, damage, delay }, lowAltitude,
//     fleeRadius, bottom, crashed: [{ name, physics, mass, offset, push,
//     pushRandom, spin, lifetime }], handling?: { family, top, boost,
//     reverse, accel, turn, strafe, hover, prefab } | { family: 'walker',
//     top, boost, reverse, turn, clips }, _source }
//     load(name) → asset | null (layers, prefabs, crashed parts)
//     anims: Map(clip name → its web/anims.jsonl record)
//     turns: Map(clip name → radians its trajectory turns)
//   WALKER_CLIPS: { <blueprint folder>: { walk, run?, back?, turn? } } (which
//     clip is the walk: by hand, by the clips' names)
//   turnClips(anims) → the turn clips' names the walkers ask for
//   vehicleRulebook(root, { anims, turns }) → { rows, refused, skipped }

import fs from 'node:fs';
import path from 'node:path';
import { assetNames, deref, loadAsset, refused as refusedEra } from './bf2017-physics-rules.mjs';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const vec = (v) => (v && isNum(v.x) && isNum(v.y) && isNum(v.z) ? [v.x, v.y, v.z] : null);
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const shortId = (name) => name.split('/').pop().toLowerCase();

// the sequel era beyond the shared list: The Last Jedi's season (S1/), the
// new trilogy's prefix (NT_), its walker, cruiser and Star Destroyer
const SEQUEL_VEHICLE = /(^|\/)S1\/|(^|[/_])NT_|ATM6|MC85|FirstOrderSD|MillenniumFalcon_NT|BlackOne|QueenHoneyBee|SpaceBear/i;
const SPACE = /\/Capital\/|\/Corvette\/|^Levels\/Space\/|Objects\/Props\/Landmarks\/|NTCapitalShips|SpaceBattles/i;
export const refusedVehicle = (name) => refusedEra(name) || SEQUEL_VEHICLE.test(name);

// which clip is a walker's walk, run, back and turn: by hand, by the
// clips' names (lane V's rigSets.js plays the same ones)
export const WALKER_CLIPS = {
  'Gameplay/Vehicles/Ground/AT-ST/': { walk: 'C_ATST_Stand_Walk_FWD', run: 'C_ATST_Stand_Sprint_FWD', back: 'C_ATST_Stand_Walk_BWD', turn: 'A_ATST_Stand_Idle_Turn90' },
  'Gameplay/Vehicles/Ground/AT-AT_MP/': { walk: 'C_ATAT_Stand_Walk_FWD', back: 'C_ATAT_Stand_Walk_BWD' },
  'Gameplay/Vehicles/Ground/AT-AT/': { walk: 'C_ATAT_Stand_Walk_FWD', back: 'C_ATAT_Stand_Walk_BWD' },
  'Gameplay/Vehicles/Ground/AT_TE/': { walk: 'C_ATTE_Stand_Walk_FWD', back: 'C_ATTE_Stand_Walk_BWD', turn: 'C_ATTE_Stand_Turn_InPlace_Left' },
  'Gameplay/Vehicles/Mount/ATRT/': { walk: 'C_ATRT_Stand_Walk_FWD_Faster', run: 'C_ATRT_Stand_Run_FWD', back: 'C_ATRT_Stand_Walk_BWD_Faster' },
};
const clipsFor = (name) => Object.entries(WALKER_CLIPS).find(([dir]) => name.startsWith(dir))?.[1] ?? null;
export const turnClips = () => [...new Set(Object.values(WALKER_CLIPS).map((c) => c.turn).filter(Boolean))];

// the kind: a walker walks on the animation (WalkerComponentData); a hover
// is lifted by a repulsor or a hover action; the rest by where the game files it
function kindOf(name, types, handling) {
  if (types.has('WalkerComponentData')) return 'walker';
  if (/\/Vehicles\/Mount\//.test(name)) return 'mount';
  if (handling && handling.family !== 'walker') return 'hover';
  if (/\/Vehicles\/Air\//.test(name) || /\/Air\//.test(name)) return 'flyer';
  if (/\/Stationary\/|\/Capital\/|\/Corvette\/|Turret|Deployed|Gadget|Objective|Panel|Console|CoolingRod|FuelCell/i.test(name)) return 'stationary';
  if (/\/Vehicles\/Ground\//.test(name)) return 'ground';
  return 'stationary';
}

// the objects of an asset by type
function byType(asset) {
  const m = new Map();
  for (const o of asset.objects ?? []) {
    if (!m.has(o.$type)) m.set(o.$type, []);
    m.get(o.$type).push(o);
  }
  return m;
}

const ENGINE_TYPES = ['SpeederBikePhysicsActionData', 'HoverTankPhysicsActionData', 'LinearRepulsorLiftPhysicsActionData', 'HoverLiftPhysicsActionData'];

// The engine prefab a blueprint places, through its layers: the first
// asset reached (the blueprint's own prefab references, its layers', their
// prefabs', two deep) holding one of the engine's physics actions.
function enginePrefab(asset, load) {
  const seen = new Set([asset.name.toLowerCase()]);
  let level = [asset];
  for (let depth = 0; depth < 3 && level.length; depth++) {
    const next = [];
    for (const a of level)
      for (const o of a.objects ?? []) {
        if (o.$type !== 'LayerReferenceObjectData' && o.$type !== 'LogicPrefabReferenceObjectData') continue;
        const ref = o.Blueprint?.$asset;
        if (!ref || seen.has(ref.toLowerCase())) continue;
        seen.add(ref.toLowerCase());
        const sub = load(ref);
        if (!sub) continue;
        if (sub.objects?.some((x) => ENGINE_TYPES.includes(x.$type))) return sub;
        next.push(sub);
      }
    level = next;
  }
  return null;
}

// a speeder's or a hover tank's handling from its engine prefab
function engineHandling(prefab, mass, massSource) {
  const T = byType(prefab);
  const p = prefab.name;
  const h = { family: null };
  const put = (key, value, src) => {
    if (!isNum(value)) return;
    h[key] = r4(value);
    h[`${key}_source`] = src;
  };
  const bike = T.get('SpeederBikePhysicsActionData')?.[0];
  const lift = T.get('LinearRepulsorLiftPhysicsActionData')?.[0];
  const tank = T.get('HoverTankPhysicsActionData')?.[0];
  const tankLift = T.get('HoverLiftPhysicsActionData')?.[0];
  if (bike) {
    const S = '#SpeederBikePhysicsActionData';
    h.family = 'speeder';
    put('top', bike.CruiseSpeedMPS, `${S}.CruiseSpeedMPS`);
    put('boost', bike.ReferenceMaxSpeed, `${S}.ReferenceMaxSpeed`);
    // (thrust is a force; the root body's mass makes it an acceleration)
    if (isNum(bike.ForceMinMax?.y) && mass > 0) put('accel', bike.ForceMinMax.y / mass, `${S}.ForceMinMax.y ÷ ${massSource}`);
    if (isNum(bike.ForceMinMax?.x) && mass > 0) put('reverseAccel', -bike.ForceMinMax.x / mass, `${S}.ForceMinMax.x ÷ ${massSource}`);
    if (isNum(bike.AccelerationMinMax?.x)) put('reverse', -bike.AccelerationMinMax.x, `${S}.AccelerationMinMax.x`);
    // (the unit isn't in the data: read as radians a second, its curve's
    // multiplier by speed beside it)
    if (isNum(bike.TurnRate?.x)) put('turn', bike.TurnRate.x, `${S}.TurnRate.x`);
    const curve = bike.TurnRateCurve?.Points;
    if (curve?.length) {
      h.turnCurve = curve.map((pt) => [r4(pt.X), r4(pt.Y)]);
      h.turnCurve_source = `${S}.TurnRateCurve.Points (X m/s, Y × turn)`;
    }
    put('strafe', bike.StrafeSpeedMPS, `${S}.StrafeSpeedMPS`);
    const boostEnd = bike.BoostCurve?.Points?.find((pt) => pt.Y === 0);
    if (boostEnd) put('boostFades', boostEnd.X, `${S}.BoostCurve.Points (Y 0)`);
  }
  if (lift) {
    // (the target is the repulsor ray's length, and the ray starts rayY over the body's origin)
    put('hover', lift.TargetHoverHeight, '#LinearRepulsorLiftPhysicsActionData.TargetHoverHeight');
    put('rayY', lift.RayOriginLocal?.y, '#LinearRepulsorLiftPhysicsActionData.RayOriginLocal.y');
  }
  if (tank) {
    const S = '#HoverTankPhysicsActionData';
    h.family = 'tank';
    put('top', tank.TargetLinearSpeed?.y, `${S}.TargetLinearSpeed.y`);
    put('boost', tank.BoostTargetSpeed?.y, `${S}.BoostTargetSpeed.y`);
    put('strafe', tank.TargetLinearSpeed?.x, `${S}.TargetLinearSpeed.x`);
    put('back', tank.TargetLinearSpeed?.z, `${S}.TargetLinearSpeed.z`);
    if (isNum(tank.TargetYawVel)) put('turn', (tank.TargetYawVel * Math.PI) / 180, `${S}.TargetYawVel (degrees a second)`);
  }
  if (tankLift && !lift) put('hover', tankLift.HoverSpringRestLength, '#HoverLiftPhysicsActionData.HoverSpringRestLength');
  if (!h.family && h.hover == null) return null;
  h._source = p;
  return h;
}

// a walker's handling from its clips
function walkerHandling(name, anims, turns) {
  const clips = clipsFor(name);
  if (!clips || !anims) return null;
  const h = { family: 'walker', clips: {} };
  const speed = (key, clip) => {
    const a = clip && anims.get(clip);
    if (!a || !(a.distance > 0) || !(a.duration > 0)) return;
    h[key] = r4(a.distance / a.duration);
    h[`${key}_source`] = `web/anims.jsonl#${clip}.distance ÷ duration`;
    h.clips[key] = clip;
  };
  speed('top', clips.walk);
  speed('boost', clips.run);
  speed('back', clips.back);
  const a = clips.turn && anims.get(clips.turn);
  const yaw = clips.turn && turns?.get(clips.turn);
  if (a && isNum(yaw) && yaw > 0 && a.duration > 0) {
    h.turn = r4(yaw / a.duration);
    h.turn_source = `web/${a.file}#AITrajectory (its yaw) ÷ web/anims.jsonl#${clips.turn}.duration`;
    h.clips.turn = clips.turn;
  }
  return h.top != null ? h : null;
}

// the crashed parts a blueprint's health states spawn
function crashedParts(asset, load) {
  const out = [];
  const seen = new Set();
  for (const hs of asset.objects ?? []) {
    if (hs.$type !== 'HealthStateData') continue;
    for (const ref of hs.Objects ?? []) {
      const o = deref(asset, ref);
      const bp = o?.Blueprint?.$asset;
      if (!bp || seen.has(bp)) continue;
      seen.add(bp);
      const part = load(bp);
      const T = part && byType(part);
      const cluster = T?.get('DebrisClusterData')?.[0];
      const body = T?.get('RigidBodyData')?.[0];
      if (!cluster || !body) continue;
      const row = {};
      const C = '#DebrisClusterData';
      const at = vec(o.BlueprintTransform?.trans);
      if (at) {
        row.offset = at.map(r4);
        row.offset_source = 'vehicle#ObjectReferenceObjectData.BlueprintTransform.trans';
      }
      // (its shapes: `<name>_Physics_Win32`, written only when it's another)
      if (body.Asset?.$asset && body.Asset.$asset !== `${bp}_Physics_Win32`) row.physics = body.Asset.$asset;
      if (isNum(body.Mass)) {
        row.mass = body.Mass;
        row.mass_source = '#RigidBodyData.Mass';
      }
      const push = vec(cluster.PushVelocityMul);
      if (push) {
        row.push = push.map(r4);
        row.push_source = `${C}.PushVelocityMul`;
      }
      const rnd = vec(cluster.PushVelocityRndMul);
      if (rnd) {
        row.pushRandom = rnd.map(r4);
        row.pushRandom_source = `${C}.PushVelocityRndMul`;
      }
      const spin = vec(cluster.InitRotationRndMul);
      if (spin) {
        row.spin = spin.map(r4);
        row.spin_source = `${C}.InitRotationRndMul`;
      }
      if (isNum(cluster.RuntimeClusterLifetime)) {
        row.lifetime = cluster.RuntimeClusterLifetime;
        row.lifetime_source = `${C}.RuntimeClusterLifetime`;
      }
      row._source = bp;
      out.push(row);
    }
  }
  return out;
}

export function vehicleRow(asset, { load = () => null, anims = null, turns = null } = {}) {
  const name = asset.name;
  const T = byType(asset);
  const types = new Set(T.keys());
  const entity = T.get('VehicleEntityData')?.[0] ?? null;
  const bodies = T.get('RigidBodyData') ?? [];
  // the root body: the one the game drives (root controller, collision, both realms)
  const root = bodies.find((b) => b.IsRootController && b.RigidBodyType === 'RBTypeCollision') ?? bodies.find((b) => b.RigidBodyType === 'RBTypeCollision' && b.MotionType === 'RigidBodyMotionType_Dynamic') ?? bodies[0] ?? null;
  const row = { id: shortId(name) };
  const put = (o, key, value, src) => {
    if (!isNum(value)) return;
    o[key] = r4(value);
    o[`${key}_source`] = `#${src}`;
  };
  if (root) {
    put(row, 'mass', root.Mass, 'RigidBodyData.Mass');
    const com = vec(root.CenterOfMass);
    if (com && com.some((v) => v !== 0)) {
      row.centreOfMass = com.map(r4);
      row.centreOfMass_source = '#RigidBodyData.CenterOfMass';
    }
    if (root.LinearVelocityDamping >= 0) put(row, 'linearDamping', root.LinearVelocityDamping, 'RigidBodyData.LinearVelocityDamping');
    if (root.AngularVelocityDamping >= 0) put(row, 'angularDamping', root.AngularVelocityDamping, 'RigidBodyData.AngularVelocityDamping');
    if (root.DynamicFriction > 0) put(row, 'friction', root.DynamicFriction, 'RigidBodyData.DynamicFriction');
    if (root.Restitution >= 0) put(row, 'restitution', root.Restitution, 'RigidBodyData.Restitution');
    if (root.Asset?.$asset) {
      row.physics = root.Asset.$asset === `${name}_Physics_Win32` ? {} : { asset: root.Asset.$asset };
      put(row.physics, 'collisionRoot', root.CollisionRootShapeIndex, 'RigidBodyData.CollisionRootShapeIndex');
      put(row.physics, 'raycastRoot', root.RaycastRootShapeIndex, 'RigidBodyData.RaycastRootShapeIndex');
    }
  }
  // the other bodies on the client-and-server realm: a walker's legs and feet
  const parts = bodies.filter((b) => b !== root && b.RigidBodyType === 'RBTypeCollision' && b.Realm !== 'Realm_Client');
  if (parts.length) {
    row.parts = parts.map((b) => ({
      part: b.PartIndices?.[0] ?? null,
      part_source: '#RigidBodyData.PartIndices[0]',
      root: b.CollisionRootShapeIndex ?? null,
      root_source: '#RigidBodyData.CollisionRootShapeIndex',
      mass: b.Mass,
      mass_source: '#RigidBodyData.Mass',
      motion: String(b.MotionType ?? '').replace(/^RigidBodyMotionType_/, '').toLowerCase(),
    }));
  }
  const config = T.get('VehicleConfigData')?.[0];
  if (config) {
    put(row, 'bodyMass', config.BodyMass, 'VehicleConfigData.BodyMass');
    const inertia = vec(config.InertiaOverride);
    if (inertia && inertia.some((v) => v > 0)) {
      row.inertia = inertia.map(r4);
      row.inertia_source = '#VehicleConfigData.InertiaOverride';
    }
  }
  if (entity) {
    row.kill = {};
    put(row.kill, 'speed', entity.KillSoldierCollisionSpeedThreshold, 'VehicleEntityData.KillSoldierCollisionSpeedThreshold');
    put(row.kill, 'blockTime', entity.KillSoldierCollisionSpeedThresholdBlockTime, 'VehicleEntityData.KillSoldierCollisionSpeedThresholdBlockTime');
    put(row.kill, 'topHitHeight', entity.TopHitHeight, 'VehicleEntityData.TopHitHeight');
    put(row.kill, 'topHitAngle', entity.TopHitAngle, 'VehicleEntityData.TopHitAngle');
    put(row.kill, 'mines', entity.MinSpeedForMineActivation, 'VehicleEntityData.MinSpeedForMineActivation');
    row.crash = {};
    put(row.crash, 'speed', entity.VelocityDamageThreshold, 'VehicleEntityData.VelocityDamageThreshold');
    put(row.crash, 'magnifier', entity.VelocityDamageMagnifier, 'VehicleEntityData.VelocityDamageMagnifier');
    row.upsideDown = {};
    put(row.upsideDown, 'angle', entity.UpsideDownAngle, 'VehicleEntityData.UpsideDownAngle');
    put(row.upsideDown, 'damage', entity.UpsideDownDamage, 'VehicleEntityData.UpsideDownDamage');
    put(row.upsideDown, 'delay', entity.UpsideDownDamageDelay, 'VehicleEntityData.UpsideDownDamageDelay');
    put(row, 'lowAltitude', entity.VehicleLockableInfo?.LowAltitudeHeight, 'VehicleEntityData.VehicleLockableInfo.LowAltitudeHeight');
    put(row, 'fleeRadius', entity.AIFleeRadius, 'VehicleEntityData.AIFleeRadius');
    // (the hull's underside under the body's origin: the site's models stand
    // on their undersides, the game's bodies on their origins)
    const hull = entity.PartBoundingBoxes?.[0]?.min?.y;
    if (isNum(hull) && hull < 0) put(row, 'bottom', hull, 'VehicleEntityData.PartBoundingBoxes[0].min.y');
  }
  const engine = enginePrefab(asset, load);
  const handling = types.has('WalkerComponentData') || /\/Mount\/ATRT\//.test(name) ? walkerHandling(name, anims, turns) : engine ? engineHandling(engine, row.mass, 'vehicle#RigidBodyData.Mass') : null;
  row.kind = kindOf(name, types, handling);
  if (row.kind === 'walker') delete row.bottom;
  if (handling) row.handling = handling;
  const crashed = crashedParts(asset, load);
  if (crashed.length) row.crashed = crashed;
  row._source = name;
  return row;
}

// the VehicleBlueprints the export lists (<root>/data.tsv: name, type, file, bytes)
export function vehicleNames(root) {
  const file = path.join(root, 'data.tsv');
  if (!fs.existsSync(file)) return assetNames(root).filter((n) => !/_class_schematics$|_bpb$/.test(n));
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.split('\t'))
    .filter((c) => c[1] === 'VehicleBlueprint')
    .map((c) => c[0]);
}

// web/anims.jsonl as a map by clip name (only the clips asked for, when given)
export function readAnims(root, want = null) {
  const file = path.join(root, 'anims.jsonl');
  const out = new Map();
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line) continue;
    const m = /"name":"([^"]+)"/.exec(line);
    if (!m || (want && !want.has(m[1]))) continue;
    out.set(m[1], JSON.parse(line));
  }
  return out;
}

// How far a clip's AITrajectory turns (radians), first key to last, from the
// clip's GLB in the export (web/anims/<skeleton>/<clip>.glb)
export async function trajectoryTurn(file) {
  const { NodeIO } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
  const { MeshoptDecoder } = await import('meshoptimizer');
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read(file);
  for (const anim of doc.getRoot().listAnimations())
    for (const ch of anim.listChannels()) {
      if (ch.getTargetNode()?.getName() !== 'AITrajectory' || ch.getTargetPath() !== 'rotation') continue;
      const v = ch.getSampler().getOutput().getArray();
      if (v.length < 8) return 0;
      const yaw = (i) => 2 * Math.atan2(v[i + 1], v[i + 3]); // (a turn about y alone)
      const d = yaw(v.length - 4) - yaw(0);
      return Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
    }
  return 0;
}

export function vehicleRulebook(root, { anims = null, turns = null, names = null } = {}) {
  const load = (n) => loadAsset(root, n);
  const rows = {};
  const refused = [];
  const skipped = [];
  const all = names ?? vehicleNames(root);
  for (const lower of all) {
    const asset = loadAsset(root, lower);
    if (!asset || asset.objects?.[asset.root]?.$type !== 'VehicleBlueprint') continue;
    if (refusedVehicle(asset.name)) {
      refused.push(asset.name);
      continue;
    }
    // (space: the capitals' and corvettes' turrets, the space levels' ships;
    // the fighters are air.json's)
    if (SPACE.test(asset.name)) {
      skipped.push(asset.name);
      continue;
    }
    const row = vehicleRow(asset, { load, anims, turns });
    if (!row.mass && !row.handling) {
      skipped.push(asset.name);
      continue;
    }
    rows[row.id] = row;
  }
  return { rows, refused, skipped };
}

// ── the rides' rows (src/data/bf2017/physics/rides.json, read by the
// surface's rides.js): the handling and the body of the vehicles the galaxy's
// rides are, every source written out whole ──

export const RIDE_VEHICLES = { speederbike: 'vehicle_ground_74z', landspeeder: 'vehicle_ground_x34', atst: 'ground_vehicle_at-st' };

// a source written relative to a row (`#…` the row's asset, `vehicle#…` too)
// or to its handling's prefab, made whole
const whole = (src, asset, prefab = asset) =>
  String(src)
    .replace(/^vehicle#/, `${asset}#`)
    .replace(/ ÷ vehicle#/, ` ÷ ${asset}#`)
    .replace(/^#/, `${prefab}#`);

export function rideRow(row) {
  const h = row.handling ?? {};
  const out = { vehicle: row.id, kind: row.kind };
  const take = (key, value, src) => {
    if (!isNum(value)) return;
    out[key] = r4(value);
    out[`${key}_source`] = src;
  };
  const asset = row._source;
  const hs = (k) => whole(h[`${k}_source`], asset, h._source ?? asset);
  take('mass', row.mass, whole(row.mass_source, asset));
  for (const k of ['top', 'boost', 'accel', 'turn']) take(k, h[k], hs(k));
  if (isNum(h.reverse)) take('reverse', h.reverse, hs('reverse'));
  // a walker's way back: its back clip's pace as a share of its walk's
  if (isNum(h.back) && isNum(h.top) && h.top > 0) take('reverse', h.back / h.top, `${hs('back')} ÷ ${hs('top')}`);
  // a hover's height as the site draws it: the model stands on its
  // underside, the game's body on its origin, the repulsor's ray from rayY
  // over that origin to the ground
  if (isNum(h.hover)) {
    const parts = [hs('hover')];
    let v = h.hover;
    if (isNum(h.rayY)) {
      v -= h.rayY;
      parts.push(`− ${hs('rayY')}`);
    }
    if (isNum(row.bottom)) {
      v += row.bottom;
      parts.push(`+ ${whole(row.bottom_source, asset)}`);
    }
    take('hover', v, parts.join(' '));
  }
  if (row.kill) {
    out.kill = {};
    for (const k of ['speed', 'topHitHeight'])
      if (isNum(row.kill[k])) {
        out.kill[k] = row.kill[k];
        out.kill[`${k}_source`] = whole(row.kill[`${k}_source`], asset);
      }
  }
  return out;
}

// the shapes files a rulebook wants: each ground vehicle's and each of its
// crashed parts' physics asset → the bin's name (its row's id, or the part's)
export function shapeFiles(rows, kinds = ['hover', 'walker', 'mount', 'ground']) {
  const out = new Map();
  for (const row of Object.values(rows)) {
    if (!kinds.includes(row.kind) || !row.physics) continue;
    out.set(row.physics.asset ?? `${row._source}_Physics_Win32`, row.id);
    for (const c of row.crashed ?? []) out.set(c.physics ?? `${c._source}_Physics_Win32`, shortId(c._source));
  }
  return out;
}
