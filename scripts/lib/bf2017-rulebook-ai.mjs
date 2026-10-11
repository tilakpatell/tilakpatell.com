// The AI rulebook (ai.json), from `AI/BattleAI/**` and the difficulty and
// instant-action settings. The bots' decisions are code in the game's
// executable; what the data holds is their tuning: how far a soldier engages,
// how long it suppresses, where cover is good (scored queries), how bursts are
// paced (firing patterns), how accuracy falls with range (difficulty curves).
//
// Most of these tables are read whole: a group is its numbers by dotted path
// with one `_source` for the object they came from, so lane 1 can read any
// value the game tunes without this module naming each.
//
// A firing pattern's `Pattern` is a 64-bit mask, one bit a frame, fire on a
// set bit, least significant first; it is read from the record's text as a
// BigInt (JSON.parse would round it), signed as the export writes it (-1 is
// all 64 bits), trimmed after the highest set bit.

import { byGuid, deref, follow, isSequel, loadText, numbersOf, objectsOf, readWebJson, rootOf, shortName } from './bf2017-ebx.mjs';
import { indexOf } from './bf2017-rulebook.mjs';

const where = (asset, obj) => `${asset.name}#${obj.$type}`;

// An object's numbers, flat by path, with its source.
export function group(asset, obj, depth = 4) {
  if (!obj) return null;
  return { ...Object.fromEntries(numbersOf(obj, { depth })), _source: where(asset, obj) };
}

const lowerFirst = (s) => s[0].toLowerCase() + s.slice(1);
const named = (root, re) => [...indexOf(root).keys()].filter((n) => re.test(n)).sort();

export function patternBits(mask) {
  const bits = [];
  for (let v = BigInt.asUintN(64, BigInt(mask)); v > 0n; v >>= 1n) bits.push((v & 1n) === 1n);
  return bits;
}

function tacticsRow(root, name) {
  const asset = follow(root, name);
  const t = asset && rootOf(asset);
  if (!t) return null;
  const src = (path) => `${asset.name}#SoldierTactics.${path}`;
  const row = {};
  if (t.EngageSettings) row.engage = { distance: t.EngageSettings.DistanceToTarget, suppression: t.EngageSettings.SuppressionValue, _source: src('EngageSettings') };
  if (t.WeaponSuppressionSettings) {
    const w = t.WeaponSuppressionSettings;
    row.suppression = { value: w.SuppressionValue, time: w.ContinuousSuppressionTime, area: w.SuppressionAreaSize, _source: src('WeaponSuppressionSettings') };
  }
  if (t.VehicleSuppressionSettings) {
    const v = t.VehicleSuppressionSettings;
    row.vehicleSuppression = { distance: v.SuppressionDistance, reevaluate: v.ReevaluateCoverDistance, _source: src('VehicleSuppressionSettings') };
  }
  for (const [k, v] of Object.entries(t)) {
    if (k.startsWith('$') || k === 'Name' || ['EngageSettings', 'WeaponSuppressionSettings', 'VehicleSuppressionSettings'].includes(k)) continue;
    const obj = deref(asset, v);
    if (obj) row[lowerFirst(k)] = group(asset, obj);
    else if (v && typeof v === 'object' && !v.$asset && numbersOf(v).length) row[lowerFirst(k)] = { ...Object.fromEntries(numbersOf(v)), _source: src(k) };
  }
  // the cover queries each state asks (`AttackSettings.GoalCoverQuery` → `attack.goalCoverQuery`)
  const queries = {};
  for (const [k, v] of Object.entries(t)) {
    const obj = deref(asset, v);
    for (const [qk, qv] of Object.entries(obj ?? {})) if (qv?.$asset?.includes('/Cover/Queries/')) queries[`${lowerFirst(k.replace(/Settings$/, ''))}.${lowerFirst(qk)}`] = shortName(qv.$asset);
  }
  if (Object.keys(queries).length) row.queries = queries;
  return row;
}

function templateRow(root, name) {
  const asset = follow(root, name);
  const t = asset && rootOf(asset);
  if (!t) return null;
  return {
    targetLostTime: t.TargetLostTime,
    alertPropagationSpeed: t.AlertPropagationSpeed,
    fireHeightOffset: t.FireHeightOffset,
    _source: where(asset, t),
    tactics: t.Tactics?.$asset ? shortName(t.Tactics.$asset) : null,
    melee: t.SoldierMeleeType ?? null,
    projectile: group(asset, deref(asset, t.Projectile)),
    meleeSettings: group(asset, deref(asset, t.Melee)),
    loco: group(asset, deref(asset, t.PhysicsLocoSettings)),
  };
}

// A weapon's AI data: its own numbers and each object it points at, by key.
function weaponRow(root, name) {
  const asset = follow(root, name);
  const w = asset && rootOf(asset);
  if (!w) return null;
  const row = { class: w.FiringWeaponClass ?? null, ...group(asset, w, 2) };
  for (const [k, v] of Object.entries(w)) {
    const obj = deref(asset, v);
    if (obj) row[lowerFirst(k)] = group(asset, obj);
  }
  return row;
}

function patternsOf(root, name) {
  const text = loadText(root, name);
  if (!text) return [];
  const asset = JSON.parse(text);
  const masks = [...text.matchAll(/"Pattern":(-?\d+)/g)].map((m) => m[1]);
  const list = objectsOf(asset, 'FiringPatternCollectionData').flatMap((c) => c.Patterns ?? []);
  return list.map((p, i) => ({
    id: p.Id,
    weapon: String(p.WeaponClass ?? '').replace(/^WeaponClass_/, ''),
    intensity: String(p.Intensity ?? '').replace(/^IntensityClass_/, ''),
    delay: p.Delay,
    single: Boolean(p.SingleShot),
    mask: masks[i],
    bits: patternBits(masks[i] ?? '0'),
    _source: `${name}#FiringPatternCollectionData.Patterns.${i}`,
  }));
}

const TERM_QUERIES = new Set(['Attack_Rebel_Soldier', 'Hide', 'Flee', 'Protective']);

// A cover query: its scored terms (a piecewise curve of score over X, X by
// angle or distance) and its filters, every object but the root.
function queryRow(root, name) {
  const asset = follow(root, name);
  // (a query in the game's selection form is `coverQueries`' alone, but for
  // the four the brain's fallback scorer, cover.js, reads as terms)
  if (!asset || (rootOf(asset).SelectionData && !TERM_QUERIES.has(shortName(name)))) return null;
  // (one source for the query: its terms are its own objects)
  const terms = asset.objects
    .filter((o, i) => i !== asset.root && o)
    .map((o) => {
      if (Array.isArray(o.X)) return { term: o.XStyle ?? o.$type, from: o.FromPosition ?? null, to: o.ToPosition ?? null, x: o.X, score: o.Score };
      // (a curve as its points; a spline's tangents kept, a linear one's are the editor's)
      if (o.$type === 'FloatCurve') {
        const pts = o.Points ?? [];
        const spline = pts.some((pt) => pt.CurveType && pt.CurveType !== 'FloatCurveType_Linear');
        return { term: 'curve', points: pts.map((pt) => [pt.X, pt.Y]), ...(spline ? { spline: true, tangents: pts.map((pt) => [pt.InTangentOffsetX, pt.InTangentOffsetY, pt.OutTangentOffsetX, pt.OutTangentOffsetY]) } : {}) };
      }
      return { term: o.$type, ...Object.fromEntries(numbersOf(o)) };
    });
  return { terms, _source: `${name}#CoverQueryData` };
}

function instantActionOf(root) {
  const out = {};
  for (const n of named(root, /^Gameplay\/Profiles\/InstantActionParams\/[^/]+$/)) {
    const a = follow(root, n);
    const o = a && rootOf(a);
    if (!o) continue;
    out[shortName(n)] = { items: (o.Items ?? []).map((i) => i.DisplayName ?? null), default: (o.Items ?? []).findIndex((i) => i.Default), default_source: `${n}#${o.$type}.Items` };
  }
  return out;
}

// ── the minds (the sixth design's bots lane) ────────────────────────────

// A curve as `{ points, min, max }`: a FloatCurve's points and its MinX..MaxX
// (the range the game clamps to), or a two-point line `{X0, Y0, X1, Y1}`
// whose range is its own ends.
export function curveOf(v) {
  if (!v || typeof v !== 'object') return null;
  if ('X0' in v && 'X1' in v)
    return {
      points: [
        [v.X0, v.Y0],
        [v.X1, v.Y1],
      ],
      min: Math.min(v.X0, v.X1),
      max: Math.max(v.X0, v.X1),
    };
  if (!Array.isArray(v.Points)) return null;
  const points = v.Points.map((p) => [p.X, p.Y]);
  const xs = points.map((p) => p[0]);
  return {
    points,
    min: v.MinX ?? (xs.length ? Math.min(...xs) : 0),
    max: v.MaxX ?? (xs.length ? Math.max(...xs) : 0),
  };
}

const DROP = /^(Name|Comment|Realm|Flags|\$.*)$/;
const bare = (v) => (typeof v === 'string' ? v.replace(/^[A-Za-z]+_(?=[A-Z])/, '') : v);

// An object as plain data, keys lower-camel: numbers, flags and enum names
// (their type's prefix dropped: `CoverQueryPosition_ActorPosition` → `ActorPosition`),
// curves as `curveOf`, nested objects (and `$ref`s inside the asset) the same
// way; `$asset` pointers kept as the asset's short name.
export function plain(asset, obj, depth = 6) {
  const out = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (DROP.test(k) || v === null || v === undefined) continue;
    const key = lowerFirst(k);
    if (typeof v === 'number' || typeof v === 'boolean') out[key] = v;
    else if (typeof v === 'string') out[key] = bare(v);
    else if (Array.isArray(v)) {
      if (v.every((x) => typeof x === 'number' || typeof x === 'string')) out[key] = v.map(bare);
      else if (depth > 0) out[key] = v.map((x) => (x && typeof x === 'object' ? plain(asset, deref(asset, x) ?? x, depth - 1) : x));
    } else if (v.$asset) out[key] = shortName(v.$asset);
    else if (depth > 0) {
      const o = deref(asset, v) ?? (typeof v.$ref === 'number' ? null : v);
      if (!o) continue;
      out[key] = curveOf(o) ?? plain(asset, o, depth - 1);
    }
  }
  return out;
}

const sourced = (asset, obj, depth) => ({
  ...plain(asset, obj, depth),
  _source: where(asset, obj),
});

// `AISystem` (multiplayer) or `AISystem_PvE`: its own numbers and its
// targeting and preferred range, each object with its source.
function systemOf(root, name) {
  const asset = follow(root, name);
  if (!asset) return null;
  const sys = rootOf(asset);
  const out = sourced(asset, { ...sys, Targeting: null, PreferredRange: null }, 3);
  out.targeting = sourced(asset, deref(asset, sys.Targeting), 3);
  out.preferredRange = sourced(asset, deref(asset, sys.PreferredRange), 1);
  return out;
}

// A cover score: its kind (`AngleToActorScoreData` → `AngleToActor`), what it
// is measured from, its curve (in this asset, or a score asset's by guid),
// its scale and cap, and its own numbers.
function scoreRow(root, asset, obj) {
  const type = obj.$type.replace(/(ScoreData|Data)$/, '');
  const { refPosition, scoreCurveScale, scoreCurveMaxY, ...rest } = plain(asset, { ...obj, ScoreCurve: null, Scorer: null, Enabled: null, Id: null }, 2);
  let curve = null;
  if (obj.ScoreCurve?.$asset) {
    const other = follow(root, obj.ScoreCurve);
    curve = other && curveOf(byGuid(other, obj.ScoreCurve.$class));
  } else curve = curveOf(deref(asset, obj.ScoreCurve));
  // (no source of its own: the query's or the score asset's covers it)
  return {
    type,
    ref: refPosition ?? null,
    curve,
    scale: scoreCurveScale ?? 1,
    maxY: scoreCurveMaxY ?? 0,
    ...rest,
  };
}

function scoreAssetOf(root, name) {
  const asset = follow(root, name);
  if (!asset) return null;
  return {
    scores: (rootOf(asset).Scores ?? [])
      .map((r) => deref(asset, r))
      .filter(Boolean)
      .map((o) => scoreRow(root, asset, o)),
    _source: where(asset, rootOf(asset)),
  };
}

// A query written as the game's selection: its spatial filter, its scores,
// the shared score asset it adds, and its validators (a score that, falling
// to nothing, tells the bot its cover is compromised).
function coverQueryOf(root, name) {
  const asset = follow(root, name);
  const q = asset && rootOf(asset);
  const sel = q && deref(asset, q.SelectionData);
  if (!sel) return null;
  const filter = deref(asset, sel.SpatialFilter);
  const paths = (sel.ExecutionParams?.PathSpecs ?? []).filter((p) => p.PathMode !== 'CoverPathMode_None');
  const scores = (sel.Scores ?? []).map((r) => deref(asset, r)).filter(Boolean);
  const isFilter = (o) => /^FilterCovers/.test(o.$type);
  const validate = deref(asset, q.ValidationData);
  return {
    radius: filter?.Radius ?? null,
    heightTolerance: filter?.HeightTolerance ?? null,
    centre: bare(filter?.Center ?? null),
    pathSearch: paths.length ? Math.max(...paths.map((p) => p.MaxSearchDist)) : null,
    defendArea: Boolean(sel.RestrictToDefendArea),
    fullyBlocked: Boolean(sel.IncludeFullyBlockedCovers),
    common: sel.CommonScores?.$asset ? shortName(sel.CommonScores.$asset) : null,
    filters: scores.filter(isFilter).map((o) => ({ type: o.$type, ...plain(asset, o, 1) })),
    // (a score the record switches off is left out)
    scores: scores.filter((o) => !isFilter(o) && o.Enabled !== false).map((o) => scoreRow(root, asset, o)),
    validators: (validate?.Validators ?? [])
      .map((r) => deref(asset, r))
      .filter(Boolean)
      .map((v) => ({
        minTimeToInvalidate: v.MinTimeToInvalidate,
        reason: bare(v.InvalidationReason),
        moving: Boolean(v.ActiveWhenMovingToCover),
        reached: Boolean(v.ActiveWhenReachedCover),
        score: deref(asset, v.Scorer) ? scoreRow(root, asset, deref(asset, v.Scorer)) : null,
      })),
    _source: where(asset, q),
  };
}

// Every multiplayer and co-op difficulty, keyed `<game type>:<its readable name>` lower-cased (the
// first of a repeated key kept, the rest numbered): the player-facing
// modifiers and the AI data's targeting, damage buckets, grenade tokens,
// sensing and passivity, each curve with its range.
const COMMON = /^(sensing(Cone|Shot)|grenadeTokens|passivity|awareToAlertTime|distanceToAwareTimeCurve|targetCoordination|meleeCharge$)/;

function difficultiesOf(root, name) {
  const asset = follow(root, name);
  if (!asset) return {};
  const out = {};
  for (const ref of rootOf(asset).Difficulties ?? []) {
    const d = deref(asset, ref);
    if (!d) continue;
    const ai = deref(asset, d.AIData);
    const game = bare(d.GameType).toLowerCase();
    // (the campaign's difficulties are not a multiplayer or co-op bot's)
    if (game === 'singleplayer') continue;
    const base = `${game}:${(d.ReadableName || (bare(d.Difficulty) === 'None' ? 'default' : bare(d.Difficulty))).toLowerCase()}`;
    let key = base;
    for (let n = 2; key in out; n++) key = `${base}:${n}`;
    const mods = plain(asset, { ...d, AIData: null }, 1);
    const row = {
      ...mods,
      difficulty: bare(d.Difficulty),
      gameType: bare(d.GameType),
      name: d.ReadableName || null,
      _source: where(asset, d),
    };
    if (ai) {
      const a = plain(asset, ai, 6);
      for (const k of ['aITargeting', 'bucketDamageAiVsHuman', 'bucketDamageAiVsAi', 'panic', 'common']) if (a[k]) row[k === 'aITargeting' ? 'targeting' : k] = a[k];
      // (of the common block, what a multiplayer bot uses: its senses, its
      // grenades, its passivity and the target coordinator; the single
      // player's investigation and alertness left out)
      if (row.common) row.common = Object.fromEntries(Object.entries(row.common).filter(([k]) => COMMON.test(k)));
    }
    // (a difficulty the record repeats word for word is kept once)
    const same = (o) => JSON.stringify({ ...o, _source: 0 }) === JSON.stringify({ ...row, _source: 0 });
    if (key !== base && Object.entries(out).some(([k, o]) => (k === base || k.startsWith(`${base}:`)) && same(o))) continue;
    out[key] = row;
  }
  return out;
}

// The bots' names: every `AIPlayerNames` under the game modes, by faction
// and mode (`AINames_Empire_SpaceBattles` → empire, spaceBattles); a
// localised list read through the strings. The sequel's factions are refused
// by the faction table, not by `isSequel`: the Rebels' lists are named
// `Rebel_Resistance` (one list for both eras) and hold the Rebels' names.
const FACTIONS = {
  Empire: 'empire',
  Rebel_Resistance: 'rebels',
  Republic: 'republic',
  Separatists: 'separatists',
};
function namesOf(root, strings) {
  const table = strings?.strings ?? strings ?? {};
  const out = {};
  for (const n of named(root, /^Gameplay\/GameModes\/[^/]+\/AINames_[^/]+$/)) {
    const m = /AINames_(.+)_([^_]+)$/.exec(shortName(n));
    if (!m || !FACTIONS[m[1]]) continue;
    const asset = follow(root, n);
    const r = asset && rootOf(asset);
    if (!r) continue;
    const local = (r.LocalizedNames ?? [])
      .map((x) => deref(asset, x))
      .filter(Boolean)
      .map((o) => table[(o.StringHash >>> 0).toString(16).toUpperCase().padStart(8, '0')]);
    const names = [...(r.Names ?? []), ...local.filter(Boolean)];
    (out[FACTIONS[m[1]]] ??= {})[lowerFirst(m[2])] = {
      names,
      ...(local.some((x) => !x) ? { unresolved: local.filter((x) => !x).length } : {}),
      _source: where(asset, r),
    };
  }
  return out;
}

// The living world: each `CreatureLocoSettings` (its speeds, size, push and
// avoidance, and its reactions to world events by type), and each actor
// entity the settings it wears.
function creatureOf(root, name) {
  const asset = follow(root, name);
  const r = asset && rootOf(asset);
  if (!r) return null;
  const parts = (r.StateSettingss ?? []).map((x) => deref(asset, x)).filter(Boolean);
  const of = (t) => parts.find((o) => o.$type === t);
  const move = of('ProceduralMovementStateSettings');
  const speed = (v) => ({ min: v?.MinSpeed ?? 0, max: v?.MaxSpeed ?? 0 });
  const events = {};
  for (const e of (of('WorldEventActionsSettings')?.EventActions ?? []).map((x) => deref(asset, x)).filter(Boolean)) {
    events[bare(e.EventType)] = {
      range: e.ConsiderationRange,
      probability: e.ProbabilityOfAction,
      minimum: e.MinimumNumber,
      window: e.TimeWindow,
      action: bare(e.ActionType),
      alignment: bare(e.ActionAlignment).replace(/^Align/, ''),
      alignmentRate: e.AlignmentRate,
      cooldown: e.CooldownTime,
      stopDelay: e.StopDelay,
      fakeMass: e.FakeMass,
      _source: where(asset, e),
    };
  }
  const row = { events, _source: where(asset, r) };
  if (move)
    row.speeds = {
      slow: speed(move.SlowSpeed),
      medium: speed(move.MediumSpeed),
      fast: speed(move.FastSpeed),
      acceleration: move.Acceleration,
      deceleration: move.Deceleration,
      _source: where(asset, move),
    };
  for (const [k, t] of [
    ['size', 'SizeSettings'],
    ['steering', 'CurveSteeringSettings'],
    ['avoidance', 'AvoidanceSteeringSettings'],
    ['push', 'PushSettings'],
  ])
    if (of(t)) row[k] = sourced(asset, of(t), 3);
  return row;
}

function creaturesOf(root) {
  const settings = {};
  for (const n of named(root, /(^|\/)Gameplay\/Characters\/LivingWorld\/CreatureLocoSettings\/[^/]+$/)) {
    if (isSequel(n)) continue;
    const row = creatureOf(root, n);
    if (row) settings[shortName(n)] ??= row;
  }
  const actors = {};
  for (const n of named(root, /^Gameplay\/Characters\/LivingWorld\/ActorEntitites\/Actor_[^/]+$/)) {
    const text = loadText(root, n);
    const cls = text && /CreatureLocoSettings\/(\w+)/.exec(text);
    const clb = text && /CreatureLocoBindings\/(\w+)/.exec(text);
    if (cls) actors[shortName(n)] = { settings: cls[1], bindings: clb?.[1] ?? null };
  }
  const prefabs = {};
  for (const n of named(root, /^Gameplay\/Characters\/LivingWorld\/Prefab\/[^/]+$/)) {
    const text = loadText(root, n);
    if (!text) continue;
    const list = [...new Set([...text.matchAll(/ActorEntitites\/(Actor_\w+)/g)].map((m) => m[1]))];
    if (list.length)
      prefabs[shortName(n)] = {
        actors: list,
        waypoints: text.includes('CreatureFollowWaypointsEntityData'),
      };
  }
  return { settings, actors, prefabs };
}

// The Skirmish (Instant Action) bots: the PvE tactics and templates, their
// AI weapons (the `*_Ability_PvE` rows are the abilities the bots use), the
// kits they wear, and the ability logic's timings (a logic graph: its
// delays and compared values are data, its wiring is read by hand).
function skirmishOf(root) {
  const short = (re, fn, key = (n) => shortName(n)) =>
    Object.fromEntries(
      named(root, re)
        .filter((n) => !isSequel(n))
        .map((n) => [key(n), fn(root, n)])
        .filter(([, v]) => v),
    );
  const kit = (r, n) => {
    const asset = follow(r, n);
    const k = asset && rootOf(asset);
    if (!k || k.$type !== 'CustomizeSoldierData') return null;
    return {
      weapons: (k.Weapons ?? []).map((w) => (w.Weapon?.$asset ? shortName(w.Weapon.$asset) : null)).filter(Boolean),
      maxHealth: k.OverrideMaxHealth,
      _source: where(asset, k),
    };
  };
  const logic = (r, n) => {
    const asset = follow(r, n);
    if (!asset) return null;
    const delays = asset.objects
      .filter((o) => /DelayEntityData$/.test(o?.$type ?? ''))
      .map((o) => ({
        min: o.MinDelay ?? o.Delay,
        max: o.MaxDelay ?? o.Delay,
        auto: Boolean(o.AutoStart),
      }));
    const compares = asset.objects.filter((o) => o?.$type === 'CompareFloatEntityData' || o?.$type === 'CompareIntEntityData').map((o) => o.B);
    return { delays, compares, _source: `${n}#LogicPrefabBlueprint` };
  };
  const tactics = short(/^AI\/BattleAI\/Tactics\/Skirmish\/[^/]+$/, tacticsRow);
  const templates = short(/^AI\/BattleAI\/Templates\/Skirmish\/[^/]+$/, templateRow, (n) =>
    shortName(n)
      .replace(/_Skirmish_Template/, '')
      .toLowerCase(),
  );
  // (a faction's twin equal to its base to the number is kept once, its
  // templates pointed at the base: the Separatists' PvE tactics are the Republic's)
  const numbers = (o) => JSON.stringify(o, (k, v) => (k.endsWith('_source') ? undefined : v));
  for (const [k, row] of Object.entries(tactics)) {
    const base = k.replace(/_Separatists$/, '');
    if (base === k || !tactics[base] || numbers(tactics[base]) !== numbers(row)) continue;
    delete tactics[k];
    for (const t of Object.values(templates)) if (t.tactics === k) t.tactics = base;
  }
  return {
    tactics,
    templates,
    weapons: short(/^AI\/BattleAI\/Weapons\/Skirmish\/AI_[^/]+$/, weaponRow),
    kits: short(/^AI\/BattleAI\/Weapons\/Skirmish\/(?!AI_)[^/]+$/, kit),
    logic: short(
      /^AI\/BattleAI\/Prefabs\/Skirmish\/(Abilities\/)?PF_Skirmish_AI_Ability[^/]*$/,
      logic,
      (n) =>
        shortName(n)
          .replace(/^PF_Skirmish_AI_Ability_?/, '')
          .replace(/_?Logic$/, '') || 'base',
    ),
  };
}

const VEHICLE_AI = ['Gameplay/Vehicles/Ground/AT-AT/Old/ATAT_AI', 'Gameplay/Vehicles/Ground/AT-ST/ATST_AI'];

export function aiRulebook(root) {
  const short = (re, fn, key = (n) => shortName(n)) => Object.fromEntries(named(root, re).map((n) => [key(n), fn(root, n)]).filter(([, v]) => v));
  const constants = follow(root, 'AI/BattleAI/Cover/CoverConstants');
  return {
    templates: short(/^AI\/BattleAI\/Templates\/[^/]+_Template$/, templateRow, (n) => shortName(n).replace(/_Template$/, '').toLowerCase()),
    tactics: short(/^AI\/BattleAI\/Tactics\/[^/]+$/, tacticsRow),
    weapons: short(/^AI\/BattleAI\/Weapons\/AI_[^/]+$/, weaponRow),
    patterns: patternsOf(root, 'AI/BattleAI/Weapons/AIFiringPatterns'),
    cover: {
      constants: constants ? group(constants, rootOf(constants), 3) : null,
      zones: Object.fromEntries(named(root, /^AI\/BattleAI\/Cover\/CoverZones\/[^/]+$/).map((n) => {
        const a = follow(root, n);
        if (!a) return [shortName(n), { zones: [], _missing: [`cover zones: ${n}`] }];
        return [shortName(n), { zones: (rootOf(a).Zones ?? []).map((z) => Object.fromEntries(numbersOf(z))), _source: `${n}#CoverZoneDefinition.Zones` }];
      })),
      queries: short(/^AI\/BattleAI\/Cover\/Queries\/[^/]+$/, queryRow),
    },
    instantAction: instantActionOf(root),
    system: systemOf(root, 'AI/BattleAI/System/AISystem'),
    systemPvE: systemOf(root, 'AI/BattleAI/System/AISystem_PvE'),
    coverConstants: Object.fromEntries(
      ['CoverConstants', 'CoverConstants_PvE']
        .map((n) => [n, follow(root, `AI/BattleAI/Cover/${n}`)])
        .filter(([, a]) => a)
        .map(([n, a]) => [n, group(a, rootOf(a), 3)]),
    ),
    coverScores: short(/^AI\/BattleAI\/Cover\/Queries\/(Skirmish\/)?CommonScores_[^/]+$/, scoreAssetOf),
    coverQueries: short(/^AI\/BattleAI\/Cover\/Queries\/(Skirmish\/)?[^/]+$/, coverQueryOf),
    difficulties: difficultiesOf(root, 'Gameplay/Settings/GameDifficultySettings'),
    skirmish: skirmishOf(root),
    vehicles: {
      ...Object.fromEntries(VEHICLE_AI.map((n) => [shortName(n), weaponRow(root, n)]).filter(([, v]) => v)),
      ...short(/^AI\/BattleAI\/Vehicles\/[^/]+$/, (r, n) => {
        const a = follow(r, n);
        return a && sourced(a, rootOf(a), 4);
      }),
    },
  };
}

// The squadron AI: each `SquadronAIBehaviourBlueprint` (the starfighter bots'
// minds) as a tree of typed nodes. A node is a behaviour entity, its kind its
// type without `SquadronAI…BehaviourEntityData` (`Selector`, `Random`,
// `DogfightingAttack`), its numbers plain; its children are the blueprint's
// link connections from it, in the order the record lists them; the root is
// the node the `DogfighterInfo` entity links to (else the one no node links
// to); the weapon rules (`CannonWeaponRule`, `MissileWeaponRule`) are what
// `DogfighterInfo` links as rules. The `AIChannelAsset`s are named.
const kindOf = (t) => t.replace(/^SquadronAI/, '').replace(/(Behaviour)?EntityData$/, '');
function squadronTree(root, name) {
  const asset = follow(root, name);
  const bp = asset && rootOf(asset);
  if (!bp) return null;
  const idx = (r) => (typeof r?.$ref === 'number' ? r.$ref : null);
  const isNode = (i) => /^SquadronAI.*BehaviourEntityData$/.test(asset.objects[i]?.$type ?? '');
  const nodes = {};
  for (let i = 0; i < asset.objects.length; i++) if (isNode(i)) nodes[i] = { kind: kindOf(asset.objects[i].$type), ...plain(asset, asset.objects[i], 2), children: [] };
  const info = asset.objects.findIndex((o) => o?.$type === 'SquadronAIDogfighterInfoEntityData');
  let top = null;
  const rules = [];
  const parented = new Set();
  for (const c of bp.LinkConnections ?? []) {
    const from = idx(c.Source);
    const to = idx(c.Target);
    if (from === null || to === null) continue;
    if (from === info && nodes[to]) top ??= to;
    else if (from === info && /WeaponRule/.test(asset.objects[to]?.$type ?? '')) rules.push({ kind: kindOf(asset.objects[to].$type), ...plain(asset, asset.objects[to], 2) });
    else if (nodes[from] && nodes[to]) {
      nodes[from].children.push(to);
      parented.add(to);
    }
  }
  top ??= Number(Object.keys(nodes).find((k) => !parented.has(Number(k))) ?? -1);
  return { root: top, nodes, rules, _source: where(asset, bp) };
}

export function aiSquadron(root) {
  const all = [...indexOf(root).entries()].filter(([n, e]) => !isSequel(n) && (e.type === 'SquadronAIBehaviourBlueprint' || e.type === 'AIChannelAsset'));
  const trees = {};
  for (const [n, e] of all) if (e.type === 'SquadronAIBehaviourBlueprint') trees[shortName(n)] ??= squadronTree(root, n);
  for (const k of Object.keys(trees)) if (!trees[k]) delete trees[k];
  return { trees, channels: all.filter(([, e]) => e.type === 'AIChannelAsset').map(([n]) => shortName(n)).sort() };
}

// The names and the creatures go to files of their own (ai.names.json,
// ai.creatures.json), as do the squadron trees (ai.squadron.json): the
// bots' rulebook stays what the soldiers read.
export const aiNames = (root, strings = readWebJson(root, 'strings/English.json')) => namesOf(root, strings);
export const aiCreatures = (root) => creaturesOf(root);
