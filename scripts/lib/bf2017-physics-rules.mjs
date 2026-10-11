// The physics rulebooks from the game's own records (the Frosty export's
// EBX JSON, `<root>/data/<Name>.json` or `.json.gz`, the bucket's layout):
// one builder a kind, each a named export, each numeric leaf with a
// `<key>_source` sibling naming `<asset>#<Type>.<Property.Path>`. Lane P1
// adds the soldier's; lane P2 (here): projectiles, bone capsules, ragdolls.
// A source that starts with `#` is in the asset its nearest enclosing
// object's `_source` names (the row's, or a ragdoll body's blueprint), so
// the asset's path is written once a row and not once a number.
// Until lane 0's bf2017-ebx.mjs is on main this file carries the forty
// lines of loadAsset/deref it needs; swap them for that module's when it is.
//
//   loadAsset(root, name) → { name, type, guid, root, objects } | null
//   deref(asset, v) → object | null ({ $ref: i })
//   refused(name) → bool (the sequel era, never written)
//   checkSources(json) → string[] (numeric leaves with no source)
//
//   projectileRow(asset) → { id, kind ('bolt' | 'missile' | 'grenade' |
//     'charge'), speed, maxSpeed, gravity, drag, ttl, engineTtl, damping,
//     impactImpulse, damage, falloff, body, bounce, blast, detonate, _source }
//     for a ProjectileBlueprint (missiles, grenades, charges) or a bolt's
//     GameDataContainerAsset (WSBulletEntityData); null for anything else
//   projectileRulebook(root, { under }) → { rows, refused, skipped }
//   boneSetRow(asset) → { id, skeleton, bones: [{ bone, length, radius,
//     offset, axis, reaction, hiLod, lowLod, material }], aimAssist }
//   ragdollRow(asset, follow?) → { id, physics, bodies: [{ index, bone,
//     parent, mass, shape, radius, length, rest, friction, limits }],
//     maxImpulse, impulseLifetime, settleMomentum, dismemberment }
//     (follow(name) → asset loads the blueprint's ragdoll; without it the
//     bodies carry their bones only)
//   physicsRulebooks(root) → { projectiles, bones, ragdoll } (the three
//     files' contents)
//   soldierRow(asset) → the 2017 soldier's row (lane P1): mass, radius,
//     slopes, rays, poses ({ height, step, eye, transitions } by pose),
//     states (each state's numbers and its poses' speeds and gains); a record
//     with no jump height takes the site's jump as `fallback` (source: hand)
//   soldierRulebook(root, names = SOLDIER_RECORDS) → { default, rows,
//     refused, missing } over the thirteen CharacterPhysicsData records
//     (the walk is OnGroundStateData's rows, not AnimationControlled's)

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { isSequel } from './bf2017-manifest.mjs';

// ── reading the export ──

const indexes = new Map(); // root → Map(lower-case name → file)

function indexOf(root) {
  if (indexes.has(root)) return indexes.get(root);
  const map = new Map();
  const base = path.join(root, 'data');
  const walk = (dir) => {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.json(\.gz)?$/.test(e.name)) {
        const name = path.relative(base, p).replace(/\\/g, '/').replace(/\.json(\.gz)?$/, '');
        map.set(name.toLowerCase(), p);
      }
    }
  };
  walk(base);
  indexes.set(root, map);
  return map;
}

export function loadAsset(root, name) {
  const file = indexOf(root).get(String(name).toLowerCase());
  if (!file) return null;
  const buf = fs.readFileSync(file);
  return JSON.parse((file.endsWith('.gz') ? zlib.gunzipSync(buf) : buf).toString('utf8'));
}

export const assetNames = (root, under = '') => [...indexOf(root).keys()].filter((n) => n.startsWith(under.toLowerCase()));

export const deref = (asset, v) => (v && typeof v === 'object' && Number.isInteger(v.$ref) ? (asset.objects[v.$ref] ?? null) : null);

const rootOf = (asset) => asset.objects[asset.root] ?? null;

// lane 0's extra names, beside the models manifest's list
const MORE_SEQUEL = /newera|crait|kylo|phasma|bb9e|astromechbb/i;
export const refused = (name) => isSequel(name) || MORE_SEQUEL.test(name);

// ── sources ──

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// a number at `key` with its source, or nothing when the record has none
function put(out, key, value, src) {
  if (!isNum(value)) return;
  out[key] = value;
  out[`${key}_source`] = src;
}

export function checkSources(json) {
  const bad = [];
  const walk = (v, at, hand) => {
    if (Array.isArray(v)) {
      v.forEach((x, i) => walk(x, `${at}[${i}]`, hand));
      return;
    }
    if (!v || typeof v !== 'object') return;
    const here = hand || v.source === 'hand';
    for (const [k, x] of Object.entries(v)) {
      if (k.endsWith('_source')) continue;
      const sourced = here || v[`${k}_source`] !== undefined;
      if (isNum(x) && !sourced) bad.push(`${at}.${k}`);
      else if (Array.isArray(x) && x.every(isNum)) {
        if (!sourced && x.length) bad.push(`${at}.${k}`);
      } else walk(x, `${at}.${k}`, here);
    }
  };
  walk(json, '$', false);
  return bad;
}

const shortId = (name) => name.split('/').pop().toLowerCase();

// ── projectiles ──

const KIND = {
  WSBulletEntityData: 'bolt',
  WSMissileEntityData: 'missile',
  WSGrenadeEntityData: 'grenade',
  FlashGrenadeEntityData: 'grenade',
  WSExplosionPackEntityData: 'charge',
};

export function projectileRow(asset) {
  if (!asset) return null;
  const top = rootOf(asset);
  const data = asset.type === 'ProjectileBlueprint' ? deref(asset, top?.Object) : asset.type === 'GameDataContainerAsset' ? deref(asset, top?.Data) : null;
  const kind = KIND[data?.$type];
  if (!kind) return null;
  const n = asset.name;
  const T = data.$type;
  const src = (p) => `#${T}.${p}`;
  const row = { id: shortId(n), name: n, _source: n, kind };
  put(row, 'speed', data.InitialSpeed, src('InitialSpeed'));
  put(row, 'maxSpeed', data.MaxSpeed, src('MaxSpeed'));
  put(row, 'gravity', data.Gravity, src('Gravity'));
  put(row, 'drag', data.Drag, src('Drag'));
  put(row, 'ttl', data.TimeToLive, src('TimeToLive'));
  put(row, 'engineTtl', data.EngineTimeToLive, src('EngineTimeToLive'));
  if (typeof data.ExtraDamping === 'boolean') row.damping = data.ExtraDamping;
  put(row, 'impactImpulse', data.ImpactImpulse, src('ImpactImpulse'));
  if (isNum(data.Damage)) put(row, 'damage', data.Damage, src('Damage'));
  else put(row, 'damage', data.StartDamage, src('StartDamage'));
  if (isNum(data.EndDamage)) {
    row.falloff = {};
    put(row.falloff, 'end', data.EndDamage, src('EndDamage'));
    put(row.falloff, 'from', data.DamageFalloffStartDistance, src('DamageFalloffStartDistance'));
    put(row.falloff, 'to', data.DamageFalloffEndDistance, src('DamageFalloffEndDistance'));
  }
  // the body: the root controller's rigid body (−1 is the material's, so left out)
  const rb = asset.objects.find((o) => o?.$type === 'RigidBodyData' && o.IsRootController) ?? asset.objects.find((o) => o?.$type === 'RigidBodyData');
  if (rb) {
    const bs = (p) => `#RigidBodyData.${p}`;
    row.body = {};
    put(row.body, 'mass', rb.Mass, bs('Mass'));
    if (rb.Restitution >= 0) put(row.body, 'restitution', rb.Restitution, bs('Restitution'));
    if (rb.DynamicFriction >= 0) put(row.body, 'friction', rb.DynamicFriction, bs('DynamicFriction'));
  } else row.body = null;
  if (kind === 'grenade') {
    row.bounce = {};
    put(row.bounce, 'speedMultiplier', data.CollisionSpeedMultiplier, src('CollisionSpeedMultiplier'));
    put(row.bounce, 'minSpeed', data.MinBounceSpeed, src('MinBounceSpeed'));
    put(row.bounce, 'collisionDamage', data.CollisionDamage, src('CollisionDamage'));
  }
  const ex = deref(asset, data.Explosion);
  if (ex) {
    const es = (p) => `#ExplosionEntityData.${p}`;
    row.blast = { occlusion: !ex.DisableOcclusion };
    put(row.blast, 'inner', ex.InnerBlastRadius, es('InnerBlastRadius'));
    put(row.blast, 'radius', ex.BlastRadius, es('BlastRadius'));
    put(row.blast, 'impulse', ex.BlastImpulse, es('BlastImpulse'));
    put(row.blast, 'damage', ex.BlastDamage, es('BlastDamage'));
    put(row.blast, 'shockRadius', ex.ShockwaveRadius, es('ShockwaveRadius'));
    put(row.blast, 'shockImpulse', ex.ShockwaveImpulse, es('ShockwaveImpulse'));
    put(row.blast, 'shockTime', ex.ShockwaveTime, es('ShockwaveTime'));
    put(row.blast, 'occlusionRadius', ex.MaxOcclusionRaycastRadius, es('MaxOcclusionRaycastRadius'));
  } else row.blast = null;
  const near = data.NearTargetDetonation;
  row.detonate = {
    onCollision: typeof data.ShouldDetonateOnCollision === 'boolean' ? data.ShouldDetonateOnCollision : kind === 'bolt',
    onTimeout: !!data.DetonateOnTimeout,
    nearTarget: null,
  };
  if (near?.DetonateNearTarget) {
    row.detonate.nearTarget = {};
    put(row.detonate.nearTarget, 'radius', near.DetonationRadius, src('NearTargetDetonation.DetonationRadius'));
    put(row.detonate.nearTarget, 'minDelay', near.MinDetonationDelay, src('NearTargetDetonation.MinDetonationDelay'));
    put(row.detonate.nearTarget, 'maxDelay', near.MaxDetonationDelay, src('NearTargetDetonation.MaxDetonationDelay'));
  }
  return row;
}

// every projectile under data/<under>: the 114 blueprints and the bolts' containers
export function projectileRulebook(root, { under = 'Gameplay/' } = {}) {
  const rows = [];
  const refusedNames = [];
  let skipped = 0;
  for (const name of assetNames(root, under)) {
    if (name.endsWith('_class_schematics')) continue;
    const file = indexOf(root).get(name);
    // (a cheap look before parsing: most files are neither)
    const raw = file.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(file)).toString('utf8') : fs.readFileSync(file, 'utf8');
    if (!/"(ProjectileBlueprint|WSBulletEntityData)"/.test(raw)) continue;
    const asset = JSON.parse(raw);
    if (refused(asset.name)) {
      if (projectileRow(asset)) refusedNames.push(asset.name);
      continue;
    }
    const row = projectileRow(asset);
    if (row) rows.push(row);
    else skipped++;
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return { rows, refused: refusedNames.sort(), skipped };
}

// ── bone capsules ──

const AXES = ['x', 'y', 'z'];

export function boneSetRow(asset) {
  const data = asset?.objects.find((o) => o?.$type === 'SkeletonCollisionData');
  if (!data) return null;
  const n = asset.name;
  const src = (i, p) => `#SkeletonCollisionData.BoneCollisionData[${i}].${p}`;
  const bones = (data.BoneCollisionData ?? []).map((b, i) => {
    const o = b.CapsuleOffset ?? { x: 0, y: 0, z: 0 };
    const row = { bone: b.BoneName };
    put(row, 'length', b.CapsuleLength, src(i, 'CapsuleLength'));
    put(row, 'radius', b.CapsuleRadius, src(i, 'CapsuleRadius'));
    row.offset = [o.x, o.y, o.z];
    row.offset_source = src(i, 'CapsuleOffset');
    put(row, 'axis', b.BoneAxis, src(i, 'BoneAxis'));
    row.axisName = AXES[b.BoneAxis] ?? 'x';
    row.reaction = b.AnimationHitReactionType;
    row.hiLod = !!b.ValidInHiLod;
    row.lowLod = !!b.ValidInLowLod;
    row.behindWall = !!b.DeactivateIfBehindWall;
    put(row, 'material', b.MaterialPair?.Packed, src(i, 'MaterialPair.Packed'));
    return row;
  });
  const aimAssist = [];
  (data.BoneCollisionData ?? []).forEach((b, i) => {
    const t = deref(asset, b.AimAssistTarget);
    if (!t || !b.ValidInHiLod) return;
    const as = (p) => `#SkeletonCollisionData.BoneCollisionData[${i}].AimAssistTarget.${p}`;
    const a = { bone: b.BoneName };
    put(a, 'lengthScale', t.LengthScale, as('LengthScale'));
    put(a, 'radiusScale', t.SnapAim?.Bounding_RadiusScale, as('SnapAim.Bounding_RadiusScale'));
    put(a, 'priority', t.SnapAim?.Point_Priorities?.StartPriority, as('SnapAim.Point_Priorities.StartPriority'));
    aimAssist.push(a);
  });
  return { id: shortId(n), name: n, _source: n, skeleton: data.SkeletonAsset?.$asset ?? null, bones, aimAssist };
}

// ── the ragdoll ──

// the component's body indices, by the game's bone names
const BODY_FIELDS = ['Hips', 'Spine', 'LeftArm', 'LeftForeArm', 'LeftHand', 'Head', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
// the link fields a ragdoll constraint names its two bodies by (parent, child), read off the
// StormTrooper's ragdoll: every constraint links hips → spine → head the same way round
const PARENT = '0xa7b321c9';
const CHILD = '0xf89af45f';

export function ragdollRow(asset, follow = null) {
  const comp = asset?.objects.find((o) => o?.$type === 'WSEACharacterPhysicsComponentData');
  if (!comp) return null;
  const n = asset.name;
  const cs = (p) => `#WSEACharacterPhysicsComponentData.${p}`;
  const row = { id: shortId(n), name: n, _source: n, physics: comp.PhysicsBlueprint?.$asset ?? null };
  put(row, 'maxImpulse', comp.MaxImpulse, cs('MaxImpulse'));
  put(row, 'impulseLifetime', comp.ImpulseLifetime, cs('ImpulseLifetime'));
  put(row, 'settleMomentum', comp.SettleMomentum, cs('SettleMomentum'));
  row.dismemberment = { enabled: !!comp.EnableDismemberment };
  put(row.dismemberment, 'probability', comp.DismembermentProbability, cs('DismembermentProbability'));
  // (some components give two bones one body, the Ewok hero's all fifteen body 1: the first
  // claim keeps it, the rest are listed, and the row is partial)
  const byIndex = new Map();
  const unassigned = [];
  for (const bone of BODY_FIELDS) {
    const i = comp[`${bone}BodyIndex`];
    if (!Number.isInteger(i) || i < 0) continue;
    if (byIndex.has(i)) unassigned.push(bone);
    else byIndex.set(i, bone);
  }
  if (unassigned.length) {
    row.partial = true;
    row.unassigned = unassigned;
  }
  const rag = row.physics && follow ? follow(row.physics) : null;
  const rc = rag?.objects.find((o) => o?.$type === 'RagdollPhysicsComponentData');
  const proxy = rag ? deref(rag, rootOf(rag)?.Object) : null;
  const bodyRefs = (rc?.PhysicsBodies ?? []).map((r) => r.$ref);
  // the constraints' two bodies, from the blueprint's links
  const parentOf = new Map(); // child body index → parent body index
  if (rag) {
    const links = new Map(); // constraint object index → { parent, child } (object indices)
    for (const l of rootOf(rag)?.LinkConnections ?? []) {
      const c = l.Source?.$ref;
      if (!Number.isInteger(c)) continue;
      const e = links.get(c) ?? {};
      if (l.SourceField === PARENT) e.parent = l.Target?.$ref;
      if (l.SourceField === CHILD) e.child = l.Target?.$ref;
      links.set(c, e);
    }
    for (const [c, { parent, child }] of links) {
      const pi = bodyRefs.indexOf(parent);
      const ci = bodyRefs.indexOf(child);
      if (pi >= 0 && ci >= 0) parentOf.set(ci, { parent: pi, constraint: c });
    }
  }
  const rs = rag?.name;
  row.bodies = [...byIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, bone]) => {
      const b = { index, index_source: cs(`${bone}BodyIndex`), bone, parent: null };
      const rb = rag ? rag.objects[bodyRefs[index]] : null;
      if (rb?.$type === 'RigidBodyData') {
        b._source = rs;
        const at = `#RigidBodyData[${bodyRefs[index]}]`;
        put(b, 'mass', rb.Mass, `${at}.Mass`);
        if (rb.DynamicFriction >= 0) put(b, 'friction', rb.DynamicFriction, `${at}.DynamicFriction`);
        const t = rb.Transform?.trans;
        if (t) {
          b.rest = [t.x, t.y, t.z];
          b.rest_source = `${at}.Transform.trans`;
        }
        // the part's box: a capsule along its longest side
        const part = rb.PartIndices?.[0];
        const box = proxy?.PartBoundingBoxes?.[part];
        if (box) {
          const half = [(box.max.x - box.min.x) / 2, (box.max.y - box.min.y) / 2, (box.max.z - box.min.z) / 2].sort((p, q) => q - p);
          const bx = `#PhysicsProxyEntityData.PartBoundingBoxes[${part}]`;
          b.shape = 'capsule';
          put(b, 'radius', Math.round(half[1] * 1e4) / 1e4, bx);
          put(b, 'length', Math.round(Math.max(0, 2 * (half[0] - half[1])) * 1e4) / 1e4, bx);
        }
      }
      const link = parentOf.get(index);
      if (link) {
        b.parent = byIndex.get(link.parent) ?? null;
        const c = rag.objects[link.constraint];
        if (c?.$type === 'PhysicsRagdollConstraintData') {
          const ls = (p) => `#PhysicsRagdollConstraintData[${link.constraint}].${p}`;
          b.limits = {};
          put(b.limits, 'cone', c.ConeAngularLimit, ls('ConeAngularLimit'));
          put(b.limits, 'twist', c.TwistMaxAngularLimit, ls('TwistMaxAngularLimit'));
          put(b.limits, 'plane', c.PlaneMaxAngularLimit, ls('PlaneMaxAngularLimit'));
        }
      }
      return b;
    });
  return row;
}

// ── the soldier (lane P1) ──

// the thirteen CharacterPhysicsData records the survey found
export const SOLDIER_RECORDS = [
  'Gameplay/Characters/DefaultSoldierPhysics',
  'Gameplay/Characters/DefaultSoldierPhysics_AI',
  'Gameplay/Characters/DefaultSoldierPhysics_B1Droid',
  'Gameplay/Characters/Heroes/DefaultHeroPhysics',
  'Gameplay/Characters/Heroes/DefaultHeroPhysics_Crouch',
  'Gameplay/Characters/Heroes/DefaultHeroPhysics_Tall',
  'Gameplay/Characters/Heroes/DefaultHeroPhysics_Crouch_Tall',
  'Gameplay/Characters/Heroes/BBHeroPhysics',
  'Gameplay/Characters/Heroes/Droideka/DroidekaPhysics',
  'Gameplay/Characters/AI/Creature/DefaultPillioCreaturePhysics',
  'Gameplay/Kits/Hero/Maul/MaulHeroPhysics',
  'Gameplay/Kits/Hero/Yoda/YodaPhysics',
  'Addons/Mode3/Gameplay/Kits/Specials/Ewok/EwokPhysics',
];

// the site's jump where the record gives none (a hero's jump is its ability's; a creature has no jump state)
export const HAND_JUMP = 5.4;

const POSES = { CharacterPoseType_Stand: 'stand', CharacterPoseType_Crouch: 'crouch', CharacterPoseType_Prone: 'prone' };
const poseOf = (type) => POSES[type] ?? type.replace(/^CharacterPoseType_/, '').toLowerCase();
const STATES = {
  OnGroundStateData: 'onGround',
  JumpStateData: 'jump',
  InAirStateData: 'inAir',
  FallingStateData: 'falling',
  ParachuteStateData: 'parachute',
  SwimmingStateData: 'swimming',
  ClimbingStateData: 'climbing',
  AnimationControlledStateData: 'animation',
  SlidingStateData: 'sliding',
};
const stateOf = (type) => STATES[type] ?? type.replace(/StateData$/, '').replace(/^./, (c) => c.toLowerCase());
const camel = (k) => k.replace(/^[A-Z]+(?=[A-Z][a-z]|$)|^[A-Z]/, (c) => c.toLowerCase());

// a writer over one asset: put(row, key, value, type, path) sets the value and its source
function writer(name) {
  return (row, key, value, type, path) => {
    if (!isNum(value) && !(Array.isArray(value) && value.every(isNum))) return;
    row[key] = value;
    row[`${key}_source`] = `${name}#${type}.${path}`;
  };
}

// a CharacterStatePoseInfo: the pose's speed and how it gets there
function poseInfoRow(put, info, type, path) {
  const row = {};
  const at = (p) => `${path}.${p}`;
  put(row, 'velocity', info.Velocity, type, at('Velocity'));
  const m = info.SpeedModifier ?? {};
  put(row, 'forward', m.ForwardConstant, type, at('SpeedModifier.ForwardConstant'));
  put(row, 'back', m.BackwardConstant, type, at('SpeedModifier.BackwardConstant'));
  put(row, 'left', m.LeftConstant, type, at('SpeedModifier.LeftConstant'));
  put(row, 'right', m.RightConstant, type, at('SpeedModifier.RightConstant'));
  put(row, 'accelGain', info.AccelerationGain, type, at('AccelerationGain'));
  put(row, 'decelGain', info.DecelerationGain, type, at('DecelerationGain'));
  put(row, 'turnGain', info.DirectionChangeAccelerationGain, type, at('DirectionChangeAccelerationGain'));
  put(row, 'turnThreshold', info.DirectionChangeThreshold, type, at('DirectionChangeThreshold'));
  put(row, 'sprintGain', info.SprintGain, type, at('SprintGain'));
  put(row, 'sprintMultiplier', info.SprintMultiplier, type, at('SprintMultiplier'));
  put(row, 'water', info.ShallowWaterMultiplier, type, at('ShallowWaterMultiplier'));
  return row;
}

// a state: its own numbers (camel-cased) and its PoseInfo by pose
function stateRow(put, asset, state) {
  const type = state.$type;
  const row = {};
  for (const [k, v] of Object.entries(state)) {
    if (k.startsWith('$') || k === 'PoseInfo') continue;
    put(row, camel(k), v, type, k);
  }
  const poses = {};
  (state.PoseInfo ?? []).forEach((ref, i) => {
    const info = deref(asset, ref);
    if (info) poses[poseOf(info.PoseType)] = poseInfoRow(put, info, type, `PoseInfo[${i}]`);
  });
  if (Object.keys(poses).length) row.poses = poses;
  return row;
}

// a CharacterPoseData: the capsule's height, the step, the eye, the transitions
function poseRow(put, pose, i) {
  const type = 'CharacterPhysicsData';
  const path = (p) => `Poses[${i}].${p}`;
  const row = {};
  put(row, 'height', pose.Height, type, path('Height'));
  put(row, 'step', pose.StepHeight, type, path('StepHeight'));
  const e = pose.EyePosition;
  if (e) put(row, 'eye', [e.x, e.y, e.z], type, path('EyePosition'));
  const transitions = {};
  (pose.TransitionTimes ?? []).forEach((t, k) => put(transitions, poseOf(t.ToPose), t.TransitionTime, type, path(`TransitionTimes[${k}].TransitionTime`)));
  row.transitions = transitions;
  return row;
}

// one CharacterPhysicsData asset as the soldier's row (spec §2)
export function soldierRow(asset) {
  const name = asset.name;
  const put = writer(name);
  const r = rootOf(asset);
  const T = 'CharacterPhysicsData';
  const row = { id: name.split('/').pop() };
  put(row, 'mass', r.Mass, T, 'Mass');
  put(row, 'radius', r.PhysicalRadius, T, 'PhysicalRadius');
  put(row, 'ascend', r.MaxAscendAngle, T, 'MaxAscendAngle');
  put(row, 'slide', r.SlideAngle, T, 'SlideAngle');
  put(row, 'slideSpeed', r.SlideSpeedCondition, T, 'SlideSpeedCondition');
  put(row, 'pushWeight', r.PushableObjectWeight, T, 'PushableObjectWeight');
  row.jumpPenalty = {};
  put(row.jumpPenalty, 'time', r.JumpPenaltyTime, T, 'JumpPenaltyTime');
  put(row.jumpPenalty, 'factor', r.JumpPenaltyFactor, T, 'JumpPenaltyFactor');
  row.rays = {};
  put(row.rays, 'groundStart', r.RayStartHeightOnGround, T, 'RayStartHeightOnGround');
  put(row.rays, 'groundEnd', r.RayEndHeightOnGround, T, 'RayEndHeightOnGround');
  put(row.rays, 'airStart', r.RayStartHeightInAir, T, 'RayStartHeightInAir');
  put(row.rays, 'airEnd', r.RayEndHeightInAir, T, 'RayEndHeightInAir');
  put(row.rays, 'movingSpeed', r.SpeedForMovingRayCasts, T, 'SpeedForMovingRayCasts');
  row.ladder = {};
  put(row.ladder, 'angle', r.LadderAcceptAngle, T, 'LadderAcceptAngle');
  put(row.ladder, 'pitch', r.LadderAcceptAnglePitch, T, 'LadderAcceptAnglePitch');
  row.poses = {};
  (r.Poses ?? []).forEach((ref, i) => {
    const p = deref(asset, ref);
    if (p) row.poses[poseOf(p.PoseType)] = poseRow(put, p, i);
  });
  row.states = {};
  for (const ref of r.States ?? []) {
    const s = deref(asset, ref);
    if (s) row.states[stateOf(s.$type)] = stateRow(put, asset, s);
  }
  const swim = row.states.swimming ?? (row.states.swimming = {});
  put(swim, 'enter', r.EnterSwimStateDepth, T, 'EnterSwimStateDepth');
  put(swim, 'exit', r.ExitSwimStateDepth, T, 'ExitSwimStateDepth');
  // the jump: the record's height when it gives one, else the site's speed
  const jump = row.states.jump ?? (row.states.jump = {});
  if (!(jump.jumpHeight > 0)) jump.fallback = { speed: HAND_JUMP, source: 'hand' };
  return row;
}

// the thirteen records, read from <root>/data; the sequel era refused, the missing listed
export function soldierRulebook(root, names = SOLDIER_RECORDS) {
  const rows = {};
  const out = [];
  const missing = [];
  for (const name of names) {
    if (refused(name)) {
      out.push(name);
      continue;
    }
    const asset = loadAsset(root, name);
    if (!asset || rootOf(asset)?.$type !== 'CharacterPhysicsData') {
      missing.push(name);
      continue;
    }
    const row = soldierRow(asset);
    rows[row.id] = row;
  }
  return { default: 'DefaultSoldierPhysics', rows, refused: out, missing };
}

// ── all three, for scripts/bf2017-bolts-data.mjs ──

// Where the game keeps its bone-capsule sets: most under Gameplay/Characters/,
// but a creature's or a hero's beside its own records (the tauntaun's under
// Characters/NPC/Creatures/Tauntaun/, the Ewok's under Characters/Hero/Ewok/)
// and a mount's under its vehicle (the AT-RT's). The ragdolls are all under
// Gameplay/Characters/.
export const BONE_SET_ROOTS = ['Gameplay/Characters/', 'Characters/', 'Gameplay/Vehicles/'];

export function physicsRulebooks(root) {
  const projectiles = projectileRulebook(root);
  const bones = { sets: [], refused: [] };
  const ragdoll = { rows: [], refused: [] };
  const names = new Set(BONE_SET_ROOTS.flatMap((under) => assetNames(root, under)));
  for (const name of names) {
    if (name.endsWith('_class_schematics')) continue;
    const file = indexOf(root).get(name);
    const raw = file.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(file)).toString('utf8') : fs.readFileSync(file, 'utf8');
    const isBones = raw.includes('"SkeletonCollisionData"');
    // (a ragdoll is read from the soldier blueprints under Gameplay/Characters/ only)
    const isRag = name.startsWith('gameplay/characters/') && raw.includes('"WSEACharacterPhysicsComponentData"');
    if (!isBones && !isRag) continue;
    const asset = JSON.parse(raw);
    if (refused(asset.name)) {
      if (isBones) bones.refused.push(asset.name);
      if (isRag) ragdoll.refused.push(asset.name);
      continue;
    }
    if (isBones) {
      const row = boneSetRow(asset);
      if (row) bones.sets.push(row);
    }
    if (isRag) {
      const row = ragdollRow(asset, (p) => loadAsset(root, p));
      if (row) ragdoll.rows.push(row);
    }
  }
  bones.sets.sort((a, b) => a.name.localeCompare(b.name));
  ragdoll.rows.sort((a, b) => a.name.localeCompare(b.name));
  shareBodies(ragdoll.rows);
  return { projectiles, bones, ragdoll };
}

// Most characters' ragdolls are the same fifteen bodies to the last digit (the
// heroes' 39 copies of one human): a row whose bodies match an earlier row's
// keeps only `bodiesOf: <that row's id>` (src/lib/three/ragdoll2017.js's
// ragdollOf reads it back).
export function shareBodies(rows) {
  const seen = new Map(); // bodies without their sources → the first row's id
  const plain = (v) => JSON.stringify(v, (k, x) => (k.endsWith('_source') ? undefined : x));
  for (const row of rows) {
    const key = plain(row.bodies);
    if (seen.has(key)) {
      row.bodiesOf = seen.get(key);
      delete row.bodies;
    } else seen.set(key, row.id);
  }
  return rows;
}

// ── the death (the Battlefront world's ragdolls) ──

// A weapon's hit impulse (N·s) is its projectile's ImpactImpulse: the
// committed weapons.json names the projectile (damage.projectile) and
// projectiles.json holds it; the page reads this small join, never the
// whole projectiles book. A weapon with no projectile (the bowcaster's
// second fire) is left out; the default rifle's bolt is the fallback.
export const FALLBACK_PROJECTILE = 'Gameplay/Equipment/Rifles/_DefaultWeapon/BlasterProjectile_Default_Rifle';

export function impulseRows(weapons, projectiles) {
  const byName = new Map((projectiles?.rows ?? []).map((p) => [String(p.name).toLowerCase(), p]));
  const rowOf = (name) => {
    const p = name ? byName.get(String(name).toLowerCase()) : null;
    if (!p || !isNum(p.impactImpulse)) return null;
    const src = p.impactImpulse_source ?? '';
    return { impulse: p.impactImpulse, impulse_source: src.startsWith('#') ? `${p.name}${src}` : src };
  };
  const rows = {};
  const missing = [];
  for (const [id, w] of Object.entries(weapons?.rows ?? {})) {
    const row = rowOf(w?.damage?.projectile);
    if (row) rows[id] = row;
    else missing.push(id);
  }
  return { rows, fallback: rowOf(FALLBACK_PROJECTILE), missing };
}

// the blueprints whose death the world reads: the Hoth kits' player and bot
// soldiers (each kit's Blueprint and AIBlueprint), the campaign AI and the hero
export const DEATH_RECORDS = ['Gameplay/Characters/StormTrooperShared', 'Gameplay/Characters/StormTrooperAI_Skirmish', 'Gameplay/Characters/StormTrooperAI', 'Gameplay/Characters/Heroes/Hero_Lightsaber'];

export function deathRow(asset) {
  const health = (asset?.objects ?? []).find((o) => o?.$type === 'WSSoldierHealthComponentData');
  if (!health) return null;
  const src = (f) => `${asset.name}#WSSoldierHealthComponentData.${f}`;
  const row = { id: shortId(asset.name), name: asset.name };
  put(row, 'timeForCorpse', health.TimeForCorpse, src('TimeForCorpse'));
  put(row, 'dyingMaxTimeInAir', health.DyingMaxTimeInAir, src('DyingMaxTimeInAir'));
  if (typeof health.SkipDyingState === 'boolean') row.skipDyingState = health.SkipDyingState;
  if (typeof health.RemainDyingInAir === 'boolean') row.remainDyingInAir = health.RemainDyingInAir;
  return row;
}
