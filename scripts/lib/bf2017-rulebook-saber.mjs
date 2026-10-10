// The lightsaber's rulebook from the 2017 game's records (src/data/bf2017/saber.json):
// how a strike finds who it hits, what it deals, how a block meets it and a
// bolt, what the stamina costs, the dodge, the camera and the AI's own melee.
// Every number keeps the record it came from (`<key>_source`). What the
// records hold, as read on 2026-10-10 (docs/superpowers/specs/2026-10-10-
// bf2017-saber-mechanics-design.md, "Departures", says where it differs from
// the design's first reading):
//
// - The hit is a target query, PF_Lightsaber_Gameplay_Physical, run while the
//   state machine says the strike's physical attack is on (the stroke table's
//   contact window stands for it). Its anchor is the hero's position moved
//   1.5 m back along its facing (a TransformMultiplier, trans.z −1.5); the
//   targets are characters within 3 m of it (SphereQuery, Controllables),
//   farther than 1.5 m from it and within 35° of the facing from it (the
//   DynamicQueryFilters with FilterOutDistanceType_LessThan), and within 45°
//   of the way back from a point 5 m ahead of it (the gate: the same filter
//   from a transform turned round, trans.z 5). A target whose facing is within
//   70° of the striker's (MaxTargetAngleFromForwardDirection: struck from
//   behind) is split off: its own set gets the hero's _FromBehind damage on
//   top of the strike's, and a deflecting one struck from the front goes to
//   PF_BlockStaggerAffectors instead of the damage (BlockedLightSaber, 0.5 s).
//   The set algebra (SetTheoryQuery differences over the QueryCaches) is read
//   in the PF_Lightsaber_<Hero> prefab that wires each set to its affector.
// - The lunge's target: characters within 8 m (the 8.5 m SphereQuery's radius
//   is set by a ConditionalFloat: 8, or 2 out of stamina), outside 1.8 m within
//   60°, inside the 45° gate from 8.5 m ahead, the best one by distance × 0.2
//   and angle × 2 within 40° (MaxResults 1), its position lifted 1.3 m to the
//   animation.
// - The damage: the AffectorApply nodes of PF_Lightsaber_<Hero> name the
//   DamageAffectorAssets: InitialDamage, DelayInitialDamageTime, the state
//   channel value (17) they require.
// - The block: Ability_Deflect_CharacterState_<Hero>'s prefab holds a
//   ShieldController (ShieldRadius 1.2, 0.45 m ahead) whose shield is the
//   HeroShield blueprint, a shell in front (its part box), and an
//   AbilityResource (the stamina, 0…100) drained by a PropertySelect of four
//   costs looked up by name in Online/BattlepointCostData's unit costs
//   (LIGHTSABER_COSTS_<KIND>_<HERO>): a bolt on the shield (BLASTER_DEFLECT/10
//   × its damage / STANDARDBULLET), a strike blocked (MELEE_DEFLECT/10), the
//   hero's own strike (MELEE/10), and refilled at REGEN_SPEED/10 a second
//   REGEN_DELAY/100 s after the last drain (the Math nodes' constants).
// - The dodge: Ability_Evade_CharacterState (_Dooku): TriggerCost, RetriggerCount,
//   ActiveTime, RechargeTime; while it's on, Affector_Evading_DMGMultiplier.
//
//   HEROES                    { site id: { key (the cost table's), health, saber, deflect, evade, camera } } (record names)
//   queryOf(root)             → the hit and lunge queries
//   damageOf(root, prefab)    → { hit, delay, behind, gate, kick? } the strike's damage rows
//   deflectOf(root, prefab)   → { shield: { radius, offset, box }, stamina: { max } }
//   costsOf(root, key)        → { strike, blocked, bolt, standardBolt, regen, delay, spread } (stamina points, seconds)
//   evadeOf(root, name)       → { cost, charges, active, recharge }
//   cameraOf(root, name)      → { arm, a, b, c } (the Ant game state's four camera floats, by property)
//   staggerOf(root)           → { blocked, hit }
//   aiMeleeOf(root)           → { damage, speed, life }
//   saberRulebook(root)       → the whole book

import { loadAsset, objectsOf, rootOf, shortName } from './bf2017-ebx.mjs';
import { fieldHash } from './bf2017-abilities.mjs';

const P = 'Gameplay/Prefabs/Abilities/Gameplay/';
const K = 'Gameplay/Kits/Hero/';
export const PHYSICAL = `${P}PF_Lightsaber_Gameplay_Physical`;
export const BLOCK_STAGGER = `${K}PF_BlockStaggerAffectors`;
export const COSTS = 'Online/BattlepointCostData';
export const AI_MELEE = 'AI/BattleAI/Weapons/AIMeleeProjectile';
export const EVADING = 'Gameplay/Prefabs/Affectors/States/Affector_Evading_DMGMultiplier';
const camera = (who) => `${K}Hero_Lightsaber_${who}_Camera_3P`;

// (the roster's saber heroes; Palpatine has no saber in the game, and no
// sequel hero is read)
export const HEROES = {
  luke: { key: 'LUKE', health: `${K}Luke/Affector_Health_Luke`, saber: `${K}Luke/Prefabs/PF_Lightsaber_Luke`, deflect: `${P}PF_DeflectAbility_Gameplay_Luke`, evade: `${K}Ability_Evade_CharacterState`, camera: camera('Default') },
  vader: { key: 'VADER', health: `${K}DarthVader/Affector_Health_DarthVader`, saber: `${K}DarthVader/Prefabs/PF_Lightsaber_DarthVader`, deflect: `${P}PF_DeflectAbility_Gameplay_Vader`, evade: `${K}Ability_Evade_CharacterState`, camera: camera('Vader') },
  obiwan: { key: 'OBI', health: `${K}ObiWan/Affectors/Health/Affector_ObiWan_Health`, saber: `${K}ObiWan/Prefabs/Lightsaber/PF_Lightsaber_ObiWan`, deflect: `${P}PF_DeflectAbility_Gameplay_ObiWan`, evade: `${K}Ability_Evade_CharacterState`, camera: camera('Default') },
  anakin: { key: 'ANAKIN', health: `${K}Anakin/Affectors/Health/Affector_Anakin_Health`, saber: `${K}Anakin/Prefabs/Lightsaber/PF_Lightsaber_Anakin`, deflect: `${P}PF_DeflectAbility_Gameplay_Anakin`, evade: `${K}Ability_Evade_CharacterState`, camera: camera('Default') },
  maul: { key: 'MAUL', health: `${K}Maul/Affector_Health_Maul`, saber: `${K}Maul/Prefabs/PF_Lightsaber_Maul`, deflect: `${P}PF_DeflectAbility_Gameplay_Maul`, evade: `${K}Ability_Evade_CharacterState`, camera: camera('Default') },
  dooku: { key: 'DOOKU', health: `${K}Dooku/Affectors/BaseAffectors/Affector_Health_Dooku`, saber: `${K}Dooku/Prefabs/Lightsaber/PF_DefaultAbility_Lightsaber_Dooku`, deflect: `${P}PF_DeflectAbility_Gameplay_CountDooku`, evade: `${K}Ability_Evade_CharacterState_Dooku`, camera: camera('Default') },
  yoda: { key: 'YODA', health: `${K}Yoda/Affector_Health_Yoda`, saber: `${K}Yoda/Prefabs/PF_Lightsaber_Yoda`, deflect: `${P}PF_DeflectAbility_Gameplay_Yoda`, evade: `${K}Ability_Evade_CharacterState`, camera: camera('Yoda') },
  grievous: { key: 'GRIEVOUS', health: `${K}Grievous/Affectors/Health/Affector_Grievous_Health`, saber: `${K}Grievous/Prefabs/Lightsaber/PF_DefaultAbility_Grievous_Lightsaber`, deflect: `${P}PF_DeflectAbility_Gameplay_Grievous`, evade: `${K}Ability_Evade_CharacterState`, camera: camera('Default') },
};

const H = (name) => fieldHash(name);
const need = (asset, name) => {
  if (!asset) throw new Error(`${name}: not in the export`);
  return asset;
};
const src = (name, type, i, path) => `${name}#${type}[${i}].${path}`;
const blueprintOf = (asset) => asset.objects.find((o) => /Blueprint$/.test(o?.$type ?? '')) ?? rootOf(asset);
// the objects feeding object i's field (PropertyConnections, by $ref)
const into = (asset, i, field) => (blueprintOf(asset).PropertyConnections ?? []).filter((c) => c.Target?.$ref === i && c.TargetFieldId === H(field)).map((c) => c.Source?.$ref);
const indexed = (asset, type) => asset.objects.map((o, i) => [o, i]).filter(([o]) => o?.$type === type);

export function queryOf(root) {
  const a = need(loadAsset(root, PHYSICAL), PHYSICAL);
  const S = (type, i, path) => src(PHYSICAL, type, i, path);
  const spheres = indexed(a, 'SphereQueryEntityData');
  const sphere = (kind) => spheres.find(([o]) => o.FilteredTypes === `QueryEntityFilter_${kind}`);
  const [hitS, hitI] = sphere('Controllables');
  const [lungeS, lungeI] = sphere('Characters');
  const [propS, propI] = sphere('StaticObjects');
  // the lunge sphere's radius is a ConditionalFloat's (the stamina's: 8, or 2 when it's spent)
  const cf = into(a, lungeI, 'Radius').map((i) => [a.objects[i], i]).find(([o]) => o?.$type === 'ConditionalFloatEntityData');
  const filters = indexed(a, 'DynamicQueryFilterEntityData');
  const less = filters.filter(([o]) => o.InputData.FilterOutDistanceType === 'FilterOutDistanceType_LessThan');
  const count = (d) => less.filter(([o]) => o.InputData.FilterOutDistance === d).length;
  const [cone, coneI] = less.filter(([o]) => o.InputData.MaxTargetAngleFromForwardDirection >= 180).sort(([x], [y]) => count(y.InputData.FilterOutDistance) - count(x.InputData.FilterOutDistance))[0];
  const [behind, behindI] = less.find(([o]) => o.InputData.MaxTargetAngleFromForwardDirection < 180);
  const [near, nearI] = less.find(([o]) => o.InputData.FilterOutDistance !== cone.InputData.FilterOutDistance);
  const [pick, pickI] = filters.find(([o]) => o.InputData.MaxResults === 1);
  // a gate: a filter that keeps what's within its angle of the way back from a point ahead (its transform's trans.z)
  const apexOf = (i) => {
    for (const s of into(a, i, 'StartTransform')) {
      const t = a.objects[s];
      if (t?.$type === 'TransformMultiplierEntityData' && t.In1?.trans?.z > 0) return [t.In1.trans.z, s];
    }
    return null;
  };
  const gates = filters.filter(([o]) => o.InputData.FilterOutDistanceType === 'FilterOutDistanceType_GreaterThan' && o.InputData.MaxResults !== 1).map(([o, i]) => [o, i, apexOf(i)]).filter(([, , ap]) => ap);
  const gate = (want) => gates.find(([, , [z]]) => (want === 'hit' ? z < lungeS.Radius : z >= lungeS.Radius));
  const [hg, hgI, [hz, hzI]] = gate('hit');
  const [lg, lgI, [lz, lzI]] = gate('lunge');
  const [back, backI] = indexed(a, 'TransformMultiplierEntityData').find(([o]) => o.In1?.trans?.z < 0);
  const [lift, liftI] = indexed(a, 'Vector3EntityData')[0];
  return {
    anchor: back.In1.trans.z,
    anchor_source: S('TransformMultiplierEntityData', backI, 'In1.trans.z'),
    hit: {
      radius: hitS.Radius,
      radius_source: S('SphereQueryEntityData', hitI, 'Radius'),
      near: cone.InputData.FilterOutDistance,
      near_source: S('DynamicQueryFilterEntityData', coneI, 'InputData.FilterOutDistance'),
      cone: cone.InputData.FilterOutAngle,
      cone_source: S('DynamicQueryFilterEntityData', coneI, 'InputData.FilterOutAngle'),
      apex: hz,
      apex_source: S('TransformMultiplierEntityData', hzI, 'In1.trans.z'),
      gate: hg.InputData.FilterOutAngle,
      gate_source: S('DynamicQueryFilterEntityData', hgI, 'InputData.FilterOutAngle'),
      behind: behind.InputData.MaxTargetAngleFromForwardDirection,
      behind_source: S('DynamicQueryFilterEntityData', behindI, 'InputData.MaxTargetAngleFromForwardDirection'),
    },
    lunge: {
      radius: cf ? cf[0].ValueIfTrue : lungeS.Radius,
      radius_source: cf ? S('ConditionalFloatEntityData', cf[1], 'ValueIfTrue') : S('SphereQueryEntityData', lungeI, 'Radius'),
      tired: cf ? cf[0].ValueIfFalse : lungeS.Radius,
      tired_source: cf ? S('ConditionalFloatEntityData', cf[1], 'ValueIfFalse') : S('SphereQueryEntityData', lungeI, 'Radius'),
      near: near.InputData.FilterOutDistance,
      near_source: S('DynamicQueryFilterEntityData', nearI, 'InputData.FilterOutDistance'),
      nearCone: near.InputData.FilterOutAngle,
      nearCone_source: S('DynamicQueryFilterEntityData', nearI, 'InputData.FilterOutAngle'),
      apex: lz,
      apex_source: S('TransformMultiplierEntityData', lzI, 'In1.trans.z'),
      gate: lg.InputData.FilterOutAngle,
      gate_source: S('DynamicQueryFilterEntityData', lgI, 'InputData.FilterOutAngle'),
      pick: pick.InputData.FilterOutAngle,
      pick_source: S('DynamicQueryFilterEntityData', pickI, 'InputData.FilterOutAngle'),
      weights: { distance: pick.InputData.DistanceMultiplier, angle: pick.InputData.AngleMultiplier, _source: S('DynamicQueryFilterEntityData', pickI, 'InputData.{DistanceMultiplier,AngleMultiplier}') },
      lift: lift.DefaultVec3.y,
      lift_source: S('Vector3EntityData', liftI, 'DefaultVec3.y'),
    },
    props: { radius: propS.Radius, radius_source: S('SphereQueryEntityData', propI, 'Radius') },
  };
}

// the AffectorApply nodes' affectors, by role
const ROLE = [
  ['behind', /(FromBehind|_Behind|_Back)$/],
  ['kick', /Kick/],
  ['hit', /Damage_(Lightsaber_[A-Za-z]+|[A-Za-z]+_Lightsaber)$/],
];
export function damageOf(root, prefab) {
  const a = need(loadAsset(root, prefab), prefab);
  const out = {};
  for (const ap of objectsOf(a, 'AffectorApplyEntityData')) {
    const name = ap.Affector?.$asset;
    const role = name && ROLE.find(([, re]) => re.test(name))?.[0];
    if (!role || out[role]) continue;
    const aff = loadAsset(root, name);
    const rank = aff && rootOf(aff).RankData?.[0];
    if (!rank) continue;
    const gate = aff.objects.find((o) => o?.$type === 'CharacterStateIntRequiredChannelValueData')?.AllowedValues?.[0] ?? null;
    const row = { damage: rank.InitialDamage, damage_source: `${name}#DamageAffectorAsset.RankData.0.InitialDamage`, delay: rank.DelayInitialDamageTime, delay_source: `${name}#DamageAffectorAsset.RankData.0.DelayInitialDamageTime`, applied: ap.Duration, applied_source: `${prefab}#AffectorApplyEntityData.Duration` };
    if (gate != null) Object.assign(row, { gate, gate_source: `${name}#CharacterStateIntRequiredChannelValueData.AllowedValues.0` });
    out[role] = row;
  }
  return out;
}

export function deflectOf(root, prefab) {
  const a = need(loadAsset(root, prefab), prefab);
  const shield = objectsOf(a, 'ShieldControllerEntityData')[0];
  const res = objectsOf(a, 'AbilityResourceEntityData')[0];
  const body = shield?.Shield?.$asset ? loadAsset(root, shield.Shield.$asset) : null;
  const box = body ? body.objects.find((o) => o?.PartBoundingBoxes)?.PartBoundingBoxes?.[0] : null;
  const r3 = (v) => [v.x, v.y, v.z].map((n) => Math.round(n * 1000) / 1000);
  // (out of stamina: a Math node on the resource, `x < k`)
  const ri = a.objects.indexOf(res);
  const fed = (blueprintOf(a).PropertyConnections ?? []).filter((c) => c.Source?.$ref === ri).map((c) => c.Target?.$ref);
  const less = fed.map((i) => [a.objects[i], i]).find(([o]) => o?.$type === 'MathEntityData' && o.Assembly?.Instructions?.some((x) => x.Code === 'MathOpCode_LessF'));
  const k = less?.[0].Assembly.Instructions.find((x) => x.Code === 'MathOpCode_ConstF');
  const f32 = (i) => new Float32Array(new Int32Array([i]).buffer)[0];
  return {
    shield: {
      radius: shield.ShieldRadius,
      radius_source: `${prefab}#ShieldControllerEntityData.ShieldRadius`,
      offset: shield.OffsetTransform.trans.z,
      offset_source: `${prefab}#ShieldControllerEntityData.OffsetTransform.trans.z`,
      ...(box ? { box: { min: r3(box.min), max: r3(box.max), _source: `${shield.Shield.$asset}#StaticModelEntityData.PartBoundingBoxes.0` } } : {}),
    },
    stamina: { max: res.MaxValue, max_source: `${prefab}#AbilityResourceEntityData.MaxValue`, ...(k ? { out: f32(k.Param1), out_source: `${prefab}#MathEntityData[${less[1]}].Assembly (stamina < k)` } : {}) },
  };
}

// (the deflect prefab's Math nodes: a cost / 10 a drain, a regen speed / 10 a
// second, a regen delay / 100 seconds, a spread / 100; a bolt's drain scaled
// by its damage over the standard bullet's)
const SCALE = { drain: 10, regen: 10, delay: 100, spread: 100 };
export function costsOf(root, key) {
  const a = need(loadAsset(root, COSTS), COSTS);
  const entries = rootOf(a).UnitCostConfig.flatMap((c, i) => (c.BattlepointUnitCostEntries ?? []).map((e, j) => ({ ...e, at: `${COSTS}#BattlepointCostData.UnitCostConfig.${i}.BattlepointUnitCostEntries.${j}.Cost` })));
  const cost = (kind) => {
    const e = entries.find((x) => x.Character === `LIGHTSABER_COSTS_${kind}`);
    if (!e) throw new Error(`LIGHTSABER_COSTS_${kind}: not in ${COSTS}`);
    return e;
  };
  const row = (kind, scale, sign = 1) => {
    const e = cost(`${kind}_${key}`);
    return [Math.round(((sign * e.Cost) / scale) * 1000) / 1000, `${e.at} / ${scale}`];
  };
  const [strike, strikeS] = row('MELEE', SCALE.drain);
  const [blocked, blockedS] = row('MELEE_DEFLECT', SCALE.drain);
  const [bolt, boltS] = row('BLASTER_DEFLECT', SCALE.drain);
  const [regen, regenS] = row('REGEN_SPEED', SCALE.regen);
  const [delay, delayS] = row('REGEN_DELAY', SCALE.delay);
  const [spread, spreadS] = row('SPREAD', SCALE.spread);
  const std = cost('BLASTER_DEFLECT_STANDARDBULLET');
  return { strike, strike_source: strikeS, blocked, blocked_source: blockedS, bolt, bolt_source: boltS, standardBolt: std.Cost, standardBolt_source: std.at, regen, regen_source: regenS, delay, delay_source: delayS, spread, spread_source: spreadS };
}

export function evadeOf(root, name) {
  const a = rootOf(need(loadAsset(root, name), name));
  const s = (f) => `${name}#CharacterStatePlayerAbilityAsset.${f}`;
  return { cost: a.TriggerCost, cost_source: s('TriggerCost'), charges: a.RetriggerCount, charges_source: s('RetriggerCount'), active: a.ActiveTime, active_source: s('ActiveTime'), recharge: a.RechargeTime, recharge_source: s('RechargeTime') };
}

export function evadingOf(root) {
  const a = rootOf(need(loadAsset(root, EVADING), EVADING));
  return { taken: a.RankData[0].DamageMultiplier, taken_source: `${EVADING}#DamageMultiplierAffectorAsset.RankData.0.DamageMultiplier` };
}

// (the four floats each go to a property of the Ant game state, which isn't
// exported: kept by that property's hash, the arm the one written 2.2–2.25 m;
// the same hash names the same property in every hero's camera)
export const CAMERA_FIELDS = { arm: 209679317, a: 1265228758, b: -1683887300, c: -1836133945 };
export function cameraOf(root, name) {
  const a = need(loadAsset(root, name), name);
  const out = {};
  for (const c of blueprintOf(a).PropertyConnections ?? []) {
    const key = Object.keys(CAMERA_FIELDS).find((k) => CAMERA_FIELDS[k] === c.TargetFieldId);
    const o = a.objects[c.Source?.$ref];
    if (!key || !o) continue;
    out[key] = o.DefaultValue;
    out[`${key}_source`] = `${name}#${o.$type}[${c.Source.$ref}].DefaultValue`;
  }
  return out;
}

export function staggerOf(root) {
  const a = need(loadAsset(root, BLOCK_STAGGER), BLOCK_STAGGER);
  const by = (re) => objectsOf(a, 'AffectorApplyEntityData').find((o) => re.test(o.Affector?.$asset ?? ''));
  const blocked = by(/BlockedLightSaber$/);
  const vfx = by(/BlockedLightSaberVFX$/);
  return { blocked: blocked.Duration, blocked_source: `${BLOCK_STAGGER}#AffectorApplyEntityData(BlockedLightSaber).Duration`, flash: vfx.Duration, flash_source: `${BLOCK_STAGGER}#AffectorApplyEntityData(BlockedLightSaberVFX).Duration` };
}

// HitByLightSaber, as a hero's saber prefab applies it to the one it strikes
export function hitReactOf(root, prefab) {
  const a = need(loadAsset(root, prefab), prefab);
  const ap = objectsOf(a, 'AffectorApplyEntityData').filter((o) => /HitByLightSaber$/.test(o.Affector?.$asset ?? '')).sort((x, y) => y.Duration - x.Duration)[0];
  return ap ? { hit: ap.Duration, hit_source: `${prefab}#AffectorApplyEntityData(HitByLightSaber).Duration` } : {};
}

export function aiMeleeOf(root) {
  const a = need(loadAsset(root, AI_MELEE), AI_MELEE);
  const g = objectsOf(a, 'WSGrenadeEntityData')[0];
  const s = (f) => `${AI_MELEE}#WSGrenadeEntityData.${f}`;
  return { damage: g.CollisionDamage, damage_source: s('CollisionDamage'), speed: g.InitialSpeed, speed_source: s('InitialSpeed'), life: g.TimeToLive, life_source: s('TimeToLive') };
}

export function healthOf(root, name) {
  return rootOf(need(loadAsset(root, name), name)).MaxHealth;
}

// the seconds a hero reels when its block breaks at no stamina: the state
// machine's OutOfStamina reaction is Ant's, not exported
// when its block breaks at no stamina; and the seconds after a strike ends
// in which the next continues the chain (the Ant state machine's too); and
// the dodge of a figure with no dodge clip of the game's (the crews from
// elsewhere): Luke's front dodge's root travel and its length, measured from
// his pack's `dodge.front` (clips-luke.glb)
export const HAND = { broken: 1.2, combo: 0.45, roll: { dist: 3.5, dur: 0.63 } };

export function saberRow(root, id) {
  const h = HEROES[id];
  if (!h) throw new Error(`${id}: not a saber hero of the game's (${Object.keys(HEROES).join(', ')})`);
  const d = deflectOf(root, h.deflect);
  return {
    records: { saber: h.saber, deflect: h.deflect, evade: h.evade, camera: h.camera, costs: `LIGHTSABER_COSTS_*_${h.key}` },
    health: healthOf(root, h.health),
    health_source: `${h.health}#MaxHealthAffectorAsset.MaxHealth`,
    damage: damageOf(root, h.saber),
    react: hitReactOf(root, h.saber),
    shield: d.shield,
    stamina: { ...d.stamina, ...costsOf(root, h.key) },
    evade: evadeOf(root, h.evade),
    camera: cameraOf(root, h.camera),
  };
}

export function saberRulebook(root, ids = Object.keys(HEROES)) {
  const heroes = {};
  const missing = [];
  for (const id of ids) {
    try {
      heroes[id] = saberRow(root, id);
    } catch (e) {
      missing.push(`${id}: ${e.message}`);
    }
  }
  return {
    query: queryOf(root),
    stagger: staggerOf(root),
    evading: evadingOf(root),
    ai: { melee: aiMeleeOf(root) },
    heroes,
    // (what the records don't hold: src/data/bf2017/NOTES.md, "saber.json")
    hand: { broken: HAND.broken, broken_source: 'hand', combo: HAND.combo, combo_source: 'hand', roll: { ...HAND.roll, _source: 'hand' }, standIn: 'luke' },
    missing,
    names: Object.fromEntries(Object.entries(HEROES).map(([id, h]) => [id, shortName(h.saber)])),
  };
}
