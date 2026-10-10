// The game's effects, read into the site's effect tables: the pure half of
// scripts/bf2017-emitters.mjs (fidelity lane X, the design's "Lane X").
//
// The input is the dump's EBX records as JSON (the bucket's
// `data/<Name>.json.gz`, indexed by `data.tsv`: name, type, path): a
// partition `{ name, type, root, objects: [...] }` whose objects link to one
// another by `{ $ref: i }` and to other records by `{ $asset: name }`.
//
// - An `EffectBlueprint`'s `Object` is an `EffectEntityData`:
//   `MaxActiveInstanceCount` and `CullDistance` by tier (`{ Low, Medium,
//   High, Ultra, Cinematic }`), and `Components`: an `EmitterEntityData` per
//   emitter (its `Emitter` asset, its `Transform` offset, `SpawnProbability`
//   and `Enable` by tier, `NearbyRadius` and `MaxNearbyInstanceCount` (0: no
//   cap), `AutoStart`, `StartDelay`); other components (sounds, lights,
//   decals) are kept under `raw`; an `EmitterGraphEntityData` names a graph
//   (`EmitterGraph`) with its `EmitterGraphOverrides`.
// - A `ScalableEmitterDocument` names an `EmitterTemplateData` per tier
//   (`TemplateDataLow` … `TemplateDataUltra`, often the same one). The
//   template holds the particle's kind, count, life, alignment, motion
//   stretch, light wrap, blend (`Emissive`: glows, drawn additive), culling
//   and following (`EmissiveExposureFactor`: how far a glow's colour is
//   taken by the scene's exposure, 0 not at all), and `RootProcessor`: a chain of processors linked by
//   `NextProcessor`. Each processor has its own value and, as `Pre`, an
//   evaluator that scales it over its `EvaluatorInput` (`EfNormTime`, the
//   particle's life; `EfEmitterNormTime`, the emitter's; `EfOne`, once).
// - An evaluator: `PolynomialData` (a cubic `Coefficients` x·t³ + y·t² +
//   z·t + w, held to `MinClamp`…`MaxClamp`, times `ScaleValue`: the
//   record's own reading, and fog.js's), `RandomEvaluatorData` (`Min`…`Max`,
//   a draw each particle), `RandomXYZEvaluatorData` (a box of three draws).
//   Under `EfOne` a cubic is its value at 1.
// - An `EmitterGraph` (a compiled GPU graph, 166 in the game, opaque here)
//   is replaced by the nearest `ScalableEmitterDocument` of its family (its
//   folder, the longest shared name), said as `graph: true` with `graphOf`.
//
// The processors read, and what each becomes:
//   UpdateAgeData       lifetime × Lifetime (−1: the template's), ± RandomLifetimeScale
//   SpawnRateData       spawn.rate (SpawnRate × its curve, over the emitter's time)
//   SpawnSizeData, SpawnSpeedData, SpawnRotationData   spawn.size, .speed, .rotation (radians)
//   SpawnPositionData   spawn.position: { box: { center, size } } from its XYZ draw
//   SpawnDirectionData  spawn.direction: { box: { min, max } } from its XYZ draw
//   SpawnAnimationFrameData, SpawnAnimationData   uv.randomStart, uv.overLife
//   GravityData         gravity: { g, random }
//   AirResistanceData   drag (DragFactor)
//   WorldWindData       wind (WindMultiplier: how much of the world's wind it takes)
//   UpdateColorData     color: [r, g, b] (Color × its curve: HDR, as stored)
//   UpdateSizeXData, UpdateSizeYData   size, sizeY (curves over life)
//   UpdateRotationData  rotation (radians over life)
//   UpdateAlphaLevelMaxData, UpdateAlphaLevelScaleData   alpha: { curve, exponent }
//   UpdateTransparencyData   transparency
//   UpdateTextureCoordsData  texture (BaseTexture)
// Every other processor, field or input is kept under `raw` (a long lookup
// table by its length), so the run can list what is not read.
//
// The output, one JSON per effect (src/data/bf2017/fx/<name>.json):
//   { format: 2, name, path, cull, maxActive, nearby, autoStart, graph,
//     variants: { low, mid, high, ultra: { emitters: [index], scale: 1, cull,
//     maxActive } }, emitters: [emitter], textures, missing, raw, _source }
//   emitter: { name, tiers, kind, maxCount, lifetime, spawn: { rate, burst,
//     size, speed, rotation, direction, position }, offset, probability:
//     { low…ultra }, delay, autoStart, gravity, drag, wind, color, size,
//     sizeY, alpha, rotation, transparency, uv, alignment, stretch, lightWrap,
//     soft, texture, additive, exposure, maxSpawnDistance, cullingFactor, follow, mesh,
//     ribbon, graph, raw, _source }
//   curve: number | { poly: [x, y, z, w], min, max, scale } | { random: [min, max] }
// An emitter whose tiers name different templates is one entry per
// template; each tier's variant lists the entries it draws.
//
// derefPartition(part) → its root object, links followed
// curveOf(evaluator, input) ; readTemplate(template, name) → emitter
// readIndex(tsv) ; nearestDocument(index, graphName) ; emitterRefs(blueprint)
// effectJson(blueprint, docs, index) → the effect's JSON (docs: lower name → record)
// rawReport(effects) ; fileName(name) ; sheetSources(texture) ; sheetSizes(width)

import { gridFromName } from '../../src/lib/three/fx/flipbook.js';

export const TIERS = { low: 'Low', mid: 'Medium', high: 'High', ultra: 'Ultra' };

const KIND = { EmittableType_Quad: 'quad', EmittableType_Mesh: 'mesh', EmittableType_Ribbon: 'ribbon', EmittableType_Trail: 'ribbon' };
// the alignments the dump uses, as sprites.js draws them: facing the
// camera (`Emittable`, a quad's own orientation, and `OrientationToPosition`
// drawn so too), along the velocity (`Direction`), stretched by it across
// the screen or along it, or flat in the world
const ALIGN = {
  EmittableAlignment_Screen: 'screen',
  EmittableAlignment_Emittable: 'screen',
  EmittableAlignment_OrientationToPosition: 'screen',
  EmittableAlignment_MotionStretchScreen: 'motionStretchScreen',
  EmittableAlignment_ScreenMotionStretch: 'motionStretchScreen',
  EmittableAlignment_Direction: 'velocity',
  EmittableAlignment_DirectionMotionStretch: 'velocity',
  EmittableAlignment_WorldFixedRotation: 'world',
};
const STRETCHES = /MotionStretch/;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const lower = (s) => String(s ?? '').toLowerCase();
export const fileName = (name) => `${String(name).split('/').pop()}.json`;

// ── the partition ──

export const isPartition = (v) => Array.isArray(v?.objects) && v.objects.length > 0;

export function derefPartition(part) {
  if (!isPartition(part)) return part;
  const memo = new Map();
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const keys = Object.keys(v);
      if (keys.length === 1 && keys[0] === '$ref') return obj(v.$ref);
      const out = {};
      for (const k of keys) out[k] = walk(v[k]);
      return out;
    }
    return v;
  };
  // (memoised before it is filled, so a loop of links ends)
  const obj = (i) => {
    if (memo.has(i)) return memo.get(i);
    const src = part.objects[i];
    if (!src) return null;
    const out = {};
    memo.set(i, out);
    for (const [k, v] of Object.entries(src)) out[k] = walk(v);
    return out;
  };
  return obj(part.root ?? 0);
}

const assetName = (v) => (typeof v === 'string' ? v : (v?.$asset ?? null));
const tierOf = (v, tier) => (v && typeof v === 'object' && TIERS[tier] in v ? v[TIERS[tier]] : v);

// ── curves ──

export function curveOf(ev, input = 'EfNormTime') {
  if (num(ev) !== null) return ev;
  if (!ev || typeof ev !== 'object') return null;
  if (ev.$type === 'PolynomialData') {
    const c = ev.Coefficients ?? {};
    const out = { poly: ['x', 'y', 'z', 'w'].map((k) => num(c[k]) ?? 0), min: num(ev.MinClamp) ?? -Infinity, max: num(ev.MaxClamp) ?? Infinity, scale: num(ev.ScaleValue) ?? 1 };
    return input === 'EfOne' ? atOne(out) : out;
  }
  if (ev.$type === 'RandomEvaluatorData') {
    const [a, b] = [num(ev.Min) ?? 0, num(ev.Max) ?? num(ev.Min) ?? 0];
    return { random: [Math.min(a, b), Math.max(a, b)] };
  }
  if (ev.$type === 'DefaultEvaluatorData') return num(ev.Values?.x);
  if (ev.$type === 'PolynomialOperatorData') {
    const table = operatorTable(ev);
    return table && input === 'EfOne' ? table.at(-1) : table ? { table } : null;
  }
  if (ev.$type === 'SplineData') {
    const table = splineTable(ev.SplineCurve);
    return table && input === 'EfOne' ? table.at(-1) : table ? { table } : null;
  }
  return null;
}

// A SplineData: its knots (XValues0…2, YValues0…2, the slopes GValues0…2,
// four to a vec4, the X rising until the padding), a cubic Hermite through
// them sampled at SPLINE_SAMPLES + 1 even steps over 0…1 (held flat past
// the ends): the runtime reads it as a table. YValues3 and GValues3 are
// kept out (their use is not known).
export const SPLINE_SAMPLES = 16;
export function splineTable(curve) {
  if (!curve) return null;
  const lanes = (k) => [0, 1, 2].flatMap((i) => ['x', 'y', 'z', 'w'].map((c) => num(curve[`${k}${i}`]?.[c]) ?? 0));
  const [X, Y, G] = [lanes('XValues'), lanes('YValues'), lanes('GValues')];
  let n = 1;
  while (n < X.length && X[n] > X[n - 1]) n++;
  if (n < 2) return n === 1 ? Array(SPLINE_SAMPLES + 1).fill(Y[0]) : null;
  const at = (t) => {
    if (t <= X[0]) return Y[0];
    if (t >= X[n - 1]) return Y[n - 1];
    let i = 0;
    while (t > X[i + 1]) i++;
    const h = X[i + 1] - X[i];
    const u = (t - X[i]) / h;
    const h00 = 2 * u ** 3 - 3 * u ** 2 + 1;
    const h10 = u ** 3 - 2 * u ** 2 + u;
    const h01 = -2 * u ** 3 + 3 * u ** 2;
    const h11 = u ** 3 - u ** 2;
    return h00 * Y[i] + h10 * h * G[i] + h01 * Y[i + 1] + h11 * h * G[i + 1];
  };
  return Array.from({ length: SPLINE_SAMPLES + 1 }, (_, k) => Math.round(at(k / SPLINE_SAMPLES) * 1e5) / 1e5);
}

// A PolynomialOperatorData: two cubics (each held to its clamps, then
// scaled) put together by its Operation, the result held to its own
// clamps; no longer a cubic, so sampled like a spline
const OPS = { Multiplication: (a, b) => a * b, Addition: (a, b) => a + b, Subtraction: (a, b) => a - b, Minimum: Math.min, Maximum: Math.max };
export function operatorTable(ev) {
  const op = OPS[ev.Operation];
  if (!op) return null;
  const cubic = (o) => {
    const c = o?.Coefficients ?? {};
    const k = ['x', 'y', 'z', 'w'].map((q) => num(c[q]) ?? 0);
    return (t) => Math.min(num(o?.MaxClamp) ?? Infinity, Math.max(num(o?.MinClamp) ?? -Infinity, ((k[0] * t + k[1]) * t + k[2]) * t + k[3])) * (num(o?.ScaleValue) ?? 1);
  };
  const [a, b] = [cubic(ev.FirstOperand), cubic(ev.SecondOperand)];
  const lo = num(ev.MinClampResult) ?? -Infinity;
  const hi = num(ev.MaxClampResult) ?? Infinity;
  return Array.from({ length: SPLINE_SAMPLES + 1 }, (_, i) => {
    const t = i / SPLINE_SAMPLES;
    return Math.round(Math.min(hi, Math.max(lo, op(a(t), b(t)))) * 1e5) / 1e5;
  });
}

// A PolynomialColorInterpData: between Color1 and Color0 by a cubic of the
// life, c1 + (c0 − c1)·p(t), a cubic itself in each channel. Color0 is where
// p is 1: the records' cubics start near 1 and fall, so a spark or an
// engine's burn is born at Color0 (its hottest) and cools to Color1
function colorInterp(ev) {
  const c0 = vec(ev.Color0) ?? [1, 1, 1];
  const c1 = vec(ev.Color1) ?? c0;
  const k = ev.Coefficients ?? {};
  const [x, y, z, w] = ['x', 'y', 'z', 'w'].map((c) => num(k[c]) ?? 0);
  return c1.map((a, i) => {
    const d = c0[i] - a;
    return { poly: [d * x, d * y, d * z, a + d * w], min: -Infinity, max: Infinity, scale: 1 };
  });
}

// a spawn shape: a box (BoxEvaluatorData, RandomXYZEvaluatorData), a sphere
// (SphereEvaluatorData) or a cap of a shell (SuperSphereEvaluatorData: its
// radii, its zenith angles from +Y, its per-axis scale)
function shapeOf(ev) {
  if (ev?.$type === 'RandomXYZEvaluatorData') {
    const { min, max } = xyz(ev);
    return { box: { center: min.map((v, i) => (v + max[i]) / 2), size: min.map((v, i) => max[i] - v) } };
  }
  if (ev?.$type === 'BoxEvaluatorData') return { box: { center: vec(ev.Pivot) ?? [0, 0, 0], size: vec(ev.Dimensions) ?? [0, 0, 0] } };
  if (ev?.$type === 'SphereEvaluatorData') return { sphere: { radius: num(ev.Radius) ?? 0, inner: 0, zenith: [0, 180], scale: vec(ev.Scale) ?? [1, 1, 1], center: vec(ev.Pivot) ?? [0, 0, 0] } };
  if (ev?.$type === 'SuperSphereEvaluatorData')
    return {
      sphere: {
        radius: num(ev.OuterRadius) ?? 0,
        inner: num(ev.InnerRadius) ?? 0,
        zenith: [num(ev.StartZenithAngle) ?? 0, num(ev.EndZenithAngle) ?? 180],
        scale: vec(ev.Scale) ?? [1, 1, 1],
        center: vec(ev.Pivot) ?? [0, 0, 0],
      },
    };
  return null;
}
const atOne = (c) => Math.min(c.max, Math.max(c.min, c.poly.reduce((a, b) => a + b, 0))) * c.scale;

// a curve times a number (a processor's value scaling its evaluator)
export function scaled(c, k) {
  if (c === null || c === undefined) return k;
  if (typeof c === 'number') return c * k;
  if (c.poly) return { ...c, scale: c.scale * k };
  if (c.random) return { random: c.random.map((v) => v * k) };
  return k;
}

const xyz = (ev) => ({ min: [ev.MinX ?? 0, ev.MinY ?? 0, ev.MinZ ?? 0], max: [ev.MaxX ?? 0, ev.MaxY ?? 0, ev.MaxZ ?? 0] });
const vec = (v) => (v && num(v.x) !== null ? [v.x, v.y ?? 0, v.z ?? 0] : null);

// ── the template ──

const TEMPLATE_READ = new Set([
  '$type',
  '$guid',
  'RootProcessor',
  'MaxCount',
  'Lifetime',
  'EmittableType',
  'EmittableAlignment',
  'MotionStretchMultiplier',
  'MotionStretchRelativeLengthClamp',
  'LightWrapAroundFactor',
  'SoftParticlesFadeDistanceMultiplier',
  'MaxSpawnDistance',
  'ParticleCullingFactor',
  'Emissive',
  'EmissiveExposureFactor',
  'FollowSpawnSource',
  'FollowSpawnSourceVelocity',
  'Mesh',
  'DebugName',
  'RepeatParticleSpawning',
  'SpeedNormalizationValue',
]);
// (fields every processor carries: the chain's links and its evaluator)
const LINKS = new Set(['$type', '$guid', 'Pre', 'NextProcessor', 'EvaluatorInput', 'EvaluatorInputParam', 'SchematicsEnable']);

export function readTemplate(t, name) {
  const src = {};
  const raw = {};
  const at = (type, field) => `${name}#${type}.${field}`;
  const out = {
    name,
    kind: KIND[t.EmittableType] ?? 'quad',
    maxCount: num(t.MaxCount),
    lifetime: num(t.Lifetime) ?? 1,
    duration: null,
    loop: true,
    spawn: { rate: 0, burst: 0, size: 1, speed: 0, rotation: 0, direction: { dir: [0, 1, 0], spread: 0 }, position: null },
    gravity: null,
    drag: 0,
    wind: 0,
    color: [1, 1, 1],
    size: 1,
    sizeY: null,
    alpha: { exponent: 1, curve: 1 },
    rotation: 0,
    transparency: 1,
    uv: { frames: 1, grid: [1, 1], fps: 0, randomStart: false, overLife: false },
    alignment: ALIGN[t.EmittableAlignment] ?? 'screen',
    stretch: null,
    lightWrap: num(t.LightWrapAroundFactor) ?? 0,
    soft: num(t.SoftParticlesFadeDistanceMultiplier) > 0 ? t.SoftParticlesFadeDistanceMultiplier : null,
    texture: null,
    additive: t.Emissive === true,
    exposure: num(t.EmissiveExposureFactor) ?? 0,
    maxSpawnDistance: num(t.MaxSpawnDistance) || null,
    cullingFactor: num(t.ParticleCullingFactor) ?? 1,
    follow: { source: t.FollowSpawnSource === true, velocity: t.FollowSpawnSourceVelocity === true },
    mesh: assetName(t.Mesh),
    ribbon: null,
    graph: false,
  };
  for (const [leaf, f] of [
    ['maxCount', 'MaxCount'],
    ['lifetime', 'Lifetime'],
    ['kind', 'EmittableType'],
    ['alignment', 'EmittableAlignment'],
    ['lightWrap', 'LightWrapAroundFactor'],
    ['soft', 'SoftParticlesFadeDistanceMultiplier'],
    ['maxSpawnDistance', 'MaxSpawnDistance'],
    ['cullingFactor', 'ParticleCullingFactor'],
    ['additive', 'Emissive'],
    ['exposure', 'EmissiveExposureFactor'],
    ['follow.source', 'FollowSpawnSource'],
    ['follow.velocity', 'FollowSpawnSourceVelocity'],
  ])
    if (f in t) src[leaf] = at('EmitterTemplateData', f);
  // (the ones read as another, said; one not known, kept)
  if (t.EmittableAlignment && (!(t.EmittableAlignment in ALIGN) || /Emittable$|OrientationToPosition/.test(t.EmittableAlignment))) raw.EmitterTemplateData = { EmittableAlignment: t.EmittableAlignment };
  if (STRETCHES.test(t.EmittableAlignment ?? '')) {
    out.stretch = { mult: num(t.MotionStretchMultiplier) ?? 1, norm: num(t.SpeedNormalizationValue) || 50, min: 1, max: num(t.MotionStretchRelativeLengthClamp) ?? null };
    src['stretch.norm'] = at('EmitterTemplateData', 'SpeedNormalizationValue');
    src['stretch.mult'] = at('EmitterTemplateData', 'MotionStretchMultiplier');
    src['stretch.max'] = at('EmitterTemplateData', 'MotionStretchRelativeLengthClamp');
  }
  for (const [k, v] of Object.entries(t)) {
    if (TEMPLATE_READ.has(k)) continue;
    // (the defaults every template carries are not worth listing: only what is set)
    if (v === null || v === false || v === 0 || (Array.isArray(v) && !v.length)) continue;
    (raw.EmitterTemplateData ??= {})[k] = v && typeof v === 'object' ? (v.$asset ?? '[object]') : v;
  }

  // the processor chain
  let sizeAll = null;
  let ageLife = null;
  let ageRandom = 0;
  const seen = new Set();
  for (let p = t.RootProcessor; p && !seen.has(p); p = p.NextProcessor) {
    seen.add(p);
    const type = p.$type;
    const input = p.EvaluatorInput ?? 'EfNormTime';
    const pre = p.Pre;
    const preCurve = pre ? curveOf(pre, input) : null;
    const preShape = pre ? shapeOf(pre) : null;
    const set = (leaf, value, field) => {
      const keys = leaf.split('.');
      let o = out;
      for (const k of keys.slice(0, -1)) o = o[k] ??= {};
      o[keys.at(-1)] = value;
      src[leaf] = at(type, field);
    };
    const keep = (fields) => {
      const left = {};
      for (const [k, v] of Object.entries(p)) {
        if (LINKS.has(k) || fields.includes(k)) continue;
        left[k] = Array.isArray(v) && v.length > 8 ? `[${v.length} values]` : v && typeof v === 'object' ? (v.$asset ?? v.$type ?? '[object]') : v;
      }
      // an evaluator not read, or a curve over an input other than the usual
      if (pre && preCurve === null && !preShape && pre.$type !== 'PolynomialColorInterpData') left.Pre = pre.$type;
      if (pre && !['EfNormTime', 'EfOne', 'EfEmitterNormTime'].includes(input)) left.EvaluatorInput = input;
      if (Object.keys(left).length) raw[type] = { ...(raw[type] ?? {}), ...left };
    };
    switch (type) {
      case 'UpdateAgeData':
        ageLife = num(p.Lifetime);
        ageRandom = num(p.RandomLifetimeScale) ?? 0;
        src.lifetime = at(type, 'Lifetime');
        keep(['Lifetime', 'RandomLifetimeScale']);
        break;
      case 'SpawnRateData':
        set('spawn.rate', scaled(preCurve, num(p.SpawnRate) ?? 0), 'SpawnRate');
        keep(['SpawnRate']);
        break;
      case 'SpawnSizeData':
        set('spawn.size', scaled(preCurve, num(p.Size) ?? 1), 'Size');
        keep(['Size']);
        break;
      case 'SpawnSpeedData':
        set('spawn.speed', scaled(preCurve, num(p.Speed) ?? 0), 'Speed');
        keep(['Speed']);
        break;
      case 'SpawnRotationData':
        set('spawn.rotation', preCurve?.random ? { random: preCurve.random.map((v) => v + (num(p.Rotation) ?? 0)) } : (num(p.Rotation) ?? 0), 'Rotation');
        keep(['Rotation']);
        break;
      case 'SpawnPositionData':
        if (preShape) set('spawn.position', preShape, 'Pre');
        keep([]);
        break;
      case 'SpawnDirectionData':
        // (a box of directions as it is; a shell's cap round +Y as a spread)
        if (pre?.$type === 'RandomXYZEvaluatorData') set('spawn.direction', { box: xyz(pre) }, 'Pre');
        else if (preShape?.sphere) set('spawn.direction', { dir: [0, 1, 0], spread: preShape.sphere.zenith[1], from: preShape.sphere.zenith[0] }, 'Pre');
        keep([]);
        break;
      case 'SpawnAnimationFrameData':
        if (preCurve?.random) set('uv.randomStart', true, 'Pre');
        keep(['AnimationFrame']);
        break;
      case 'SpawnAnimationData':
        if (p.BasedOnLifetime) set('uv.overLife', true, 'BasedOnLifetime');
        keep(['BasedOnLifetime', 'AnimationSpeed']);
        break;
      case 'GravityData':
        set('gravity', { g: num(p.Gravity) ?? 9.8, random: num(p.PerParticleRandomness) ?? 0 }, 'Gravity');
        keep(['Gravity', 'PerParticleRandomness']);
        break;
      case 'AirResistanceData':
        set('drag', num(p.DragFactor) ?? 0, 'DragFactor');
        keep(['DragFactor']);
        break;
      case 'WorldWindData':
        set('wind', num(p.WindMultiplier) ?? 1, 'WindMultiplier');
        keep(['WindMultiplier']);
        break;
      case 'UpdateColorData': {
        const c = vec(p.Color) ?? [1, 1, 1];
        const interp = pre?.$type === 'PolynomialColorInterpData' ? colorInterp(pre) : null;
        set(
          'color',
          c.map((v, i) => scaled(interp ? interp[i] : preCurve, v)),
          'Color',
        );
        keep(['Color']);
        break;
      }
      case 'UpdateSizeData':
        // (the size over life for both sides; UpdateSizeX/YData, when there,
        // take each side instead)
        if (preCurve !== null) sizeAll = { curve: preCurve, at: at(type, 'Pre') };
        keep(['Pivot', 'MultiplyWithSizeXYZ']);
        break;
      case 'UpdateSizeXData':
        set('size', preCurve ?? 1, 'Pre');
        keep([]);
        break;
      case 'UpdateSizeYData':
        set('sizeY', preCurve ?? 1, 'Pre');
        keep([]);
        break;
      case 'UpdateRotationData':
        if (preCurve !== null) set('rotation', preCurve, 'Pre');
        keep([]);
        break;
      case 'UpdateAlphaLevelMaxData':
        set('alpha.curve', scaled(preCurve, num(p.MaxLevel) ?? 1), 'MaxLevel');
        keep(['MaxLevel']);
        break;
      case 'UpdateAlphaLevelScaleData':
        set('alpha.exponent', num(p.Exponent) ?? 1, 'Exponent');
        keep(['Exponent']);
        break;
      case 'UpdateTransparencyData':
        if (preCurve !== null) set('transparency', preCurve, 'Pre');
        keep([]);
        break;
      case 'UpdateTextureCoordsData':
        if (assetName(p.BaseTexture)) set('texture', assetName(p.BaseTexture), 'BaseTexture');
        keep(['BaseTexture']);
        break;
      default:
        keep([]);
        if (!raw[type]) raw[type] = {};
    }
  }
  if (sizeAll && !src.size) {
    out.size = sizeAll.curve;
    src.size = sizeAll.at;
  } else if (sizeAll) (raw.UpdateSizeData ??= {}).Pre = 'with UpdateSizeXData (the X and Y curves taken)';
  // The template's Lifetime is the emitter's (0: endless) and UpdateAgeData's
  // the particle's (−1: the emitter's): the reading that makes an engine's
  // burn (0 and 0.15) burn on, a bolt's sparks (0.06 and a tenth of a
  // second) flash once, and a ceiling's snow (1.2 and 1) fall on loop
  const emitterLife = out.lifetime;
  const base = ageLife !== null && ageLife > 0 ? ageLife : emitterLife > 0 ? emitterLife : 1;
  out.lifetime = ageRandom > 0 ? { random: [base * (1 - ageRandom), base * (1 + ageRandom)] } : base;
  out.duration = emitterLife > 0 ? emitterLife : null;
  out.loop = t.RepeatParticleSpawning !== false || !(emitterLife > 0);
  src.duration = at('EmitterTemplateData', 'Lifetime');
  src.loop = at('EmitterTemplateData', 'RepeatParticleSpawning');
  if (out.texture) {
    out.uv.grid = gridFromName(out.texture);
    out.uv.frames = out.uv.grid[0] * out.uv.grid[1];
  }
  if (out.kind === 'ribbon') out.ribbon = { segment: 1 };
  if (out.maxCount === null) raw._missing = ['EmitterTemplateData.MaxCount'];
  out.raw = raw;
  out._source = src;
  return out;
}

// ── the index and the graphs ──

export function readIndex(tsv) {
  const rows = new Map();
  const lines = String(tsv ?? '').split(/\r?\n/);
  // (the dump's index has no header; a hand-written one may)
  const first = lines[0].split('\t').map(lower);
  const header = first.includes('name') && first.includes('path');
  const col = (k, d) => (header && first.indexOf(k) >= 0 ? first.indexOf(k) : d);
  const [n, t, p] = [col('name', 0), col('type', 1), col('path', 2)];
  for (const line of header ? lines.slice(1) : lines) {
    if (!line.trim()) continue;
    const c = line.split('\t');
    rows.set(lower(c[n]), { name: c[n], type: c[t], path: c[p] });
  }
  return rows;
}

const stem = (name) => lower(name).split('/').pop().replace(/^e[mg]_/, '');
const folder = (name) => lower(name).split('/').slice(0, -1).join('/');
const shared = (a, b) => {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return i;
};
export function nearestDocument(index, graphName) {
  const want = stem(graphName);
  const dir = folder(graphName);
  const area = dir.split('/').slice(0, 2).join('/');
  let best = null;
  let score = -1;
  for (const row of index.values()) {
    if (row.type !== 'ScalableEmitterDocument') continue;
    const rowDir = folder(row.name);
    const near = rowDir === dir ? 2 : rowDir.startsWith(area) ? 1 : 0;
    const s = near * 1000 + shared(want, stem(row.name));
    if (s > score) [best, score] = [row, s];
  }
  return score >= 1000 ? best : null;
}

// the EmitterEntityData components of a blueprint (a partition or its root)
const entityOf = (bp) => {
  const root = derefPartition(bp);
  return root?.Object ?? null;
};
const refOf = (c) => (c?.$type === 'EmitterEntityData' ? assetName(c.Emitter) : c?.$type === 'EmitterGraphEntityData' ? assetName(c.EmitterGraph) : null);
const emitterComponents = (entity) => (entity?.Components ?? []).filter((c) => refOf(c));

export const emitterRefs = (bp) => [...new Set(emitterComponents(entityOf(bp)).map(refOf))];

// An EmitterGraphEntityData's overrides (when each is set) on the document
// standing in for its graph: the rate, the count (held to GRAPH_MAX_COUNT:
// a graph's 20,000 over 30 instances is not a pool for a page) and the life
export const GRAPH_MAX_COUNT = 2000;
function graphOverrides(em, o) {
  if (!o) return;
  const hi = (v) => tierOf(v, 'high');
  if (o.IsSpawnRateOverrideSet && num(hi(o.SpawnRate)) !== null) em.spawn.rate = hi(o.SpawnRate);
  if (o.IsParticleMaxCountOverrideSet && num(hi(o.ParticleMaxCount)) !== null) em.maxCount = Math.min(GRAPH_MAX_COUNT, hi(o.ParticleMaxCount));
  if (o.IsParticleLifeSpanOverrideSet && num(hi(o.ParticleLifeSpan)) > 0) em.lifetime = hi(o.ParticleLifeSpan);
  if (o.IsEmitterLifeSpanOverrideSet && num(hi(o.EmitterLifeSpan)) !== null) em.duration = hi(o.EmitterLifeSpan) || null;
}

// ── the effect ──

const ENTITY_READ = new Set(['$type', '$guid', 'Components', 'MaxActiveInstanceCount', 'CullDistance', 'Transform', 'Flags', 'Enable']);

// docs: lower-case record name → its partition (a ScalableEmitterDocument or
// an EmitterGraph); index: readIndex's, for the graphs' replacements
export function effectJson(blueprint, docs, index = new Map()) {
  const root = derefPartition(blueprint);
  const path = root?.Name ?? blueprint.name;
  const name = String(path).split('/').pop();
  const entity = root?.Object ?? {};
  const docOf = (n) => docs.get?.(lower(n)) ?? null;
  const missing = [];
  const emitters = [];
  const variants = Object.fromEntries(Object.keys(TIERS).map((t) => [t, { emitters: [], scale: 1 }]));
  const raw = {};
  const atBp = (f) => `${path}#EffectEntityData.${f}`;
  for (const comp of entity.Components ?? []) {
    const ref = refOf(comp);
    if (!ref) {
      if (comp?.$type) (raw.components ??= []).push(comp.$type);
      continue;
    }
    const asGraph = comp.$type === 'EmitterGraphEntityData';
    let doc = docOf(ref);
    let graphOf = null;
    let docName = ref;
    if (asGraph || (doc && (doc.type === 'EmitterGraph' || doc.objects?.[doc.root ?? 0]?.$type === 'EmitterGraph'))) {
      const near = nearestDocument(index, ref);
      doc = near ? docOf(near.name) : null;
      graphOf = ref;
      docName = near?.name ?? ref;
    }
    if (!doc) {
      missing.push(ref);
      continue;
    }
    const sed = derefPartition(doc);
    // the per-emitter fields the blueprint gives
    const tr = comp.Transform ?? {};
    const offset = vec(tr.trans) ?? [0, 0, 0];
    const turned = ['right', 'up', 'forward'].some((k, i) => {
      const v = vec(tr[k]);
      return v && v.some((c, j) => Math.abs(c - (i === j ? 1 : 0)) > 1e-4);
    });
    const per = {
      offset,
      probability: Object.fromEntries(Object.keys(TIERS).map((t) => [t, num(tierOf(comp.SpawnProbability, t)) ?? 1])),
      delay: num(comp.StartDelay) ?? 0,
      autoStart: comp.AutoStart !== false,
      nearby: num(comp.MaxNearbyInstanceCount) > 0 ? { radius: num(comp.NearbyRadius) ?? 1, max: comp.MaxNearbyInstanceCount } : null,
    };
    const compRaw = turned ? { Transform: 'turned (only the offset is read)' } : null;
    // one entry per distinct template, the tiers that draw it
    const byTemplate = new Map();
    for (const tier of Object.keys(TIERS)) {
      const enabled = tierOf(comp.Enable, tier) !== false;
      const tpl = sed?.[`TemplateData${TIERS[tier]}`];
      if (!enabled || !tpl) continue;
      if (!byTemplate.has(tpl)) byTemplate.set(tpl, []);
      byTemplate.get(tpl).push(tier);
    }
    for (const [tpl, tiers] of byTemplate) {
      const em = readTemplate(tpl, docName);
      Object.assign(em, per, { tiers });
      if (graphOf) {
        Object.assign(em, { graph: true, graphOf });
        if (asGraph) graphOverrides(em, comp.EmitterGraphOverrides);
      }
      if (compRaw) em.raw.EmitterEntityData = compRaw;
      for (const [leaf, f] of [
        ['offset', 'Transform'],
        ['probability', 'SpawnProbability'],
        ['delay', 'StartDelay'],
        ['autoStart', 'AutoStart'],
        ['nearby', 'MaxNearbyInstanceCount'],
      ])
        em._source[leaf] = `${path}#${comp.$type}[${ref}].${f}`;
      const i = emitters.push(em) - 1;
      for (const t of tiers) variants[t].emitters.push(i);
    }
  }
  const cullOf = (t) => {
    const v = num(tierOf(entity.CullDistance, t));
    return v > 0 ? v : null;
  };
  for (const t of Object.keys(TIERS)) {
    variants[t].cull = cullOf(t);
    variants[t].maxActive = num(tierOf(entity.MaxActiveInstanceCount, t)) ?? 1;
    variants[t].from = TIERS[t];
  }
  for (const [k, v] of Object.entries(entity)) if (!ENTITY_READ.has(k) && v !== null && v !== false && v !== 0) raw[k] = v;
  const _source = {};
  if ('CullDistance' in entity) _source.cull = atBp('CullDistance');
  if ('MaxActiveInstanceCount' in entity) _source.maxActive = atBp('MaxActiveInstanceCount');
  for (const t of Object.keys(TIERS)) _source[`variants.${t}`] = `${path}#ScalableEmitterDocument.TemplateData${TIERS[t]}`;
  const nearby = emitters.find((e) => e.nearby)?.nearby ?? null;
  return {
    format: 2,
    name,
    path,
    cull: variants.high.cull,
    maxActive: variants.high.maxActive,
    probability: 1,
    nearby,
    autoStart: emitters.length ? emitters.some((e) => e.autoStart) : true,
    graph: emitters.some((e) => e.graph),
    variants,
    emitters,
    textures: [...new Set(emitters.map((e) => e.texture).filter(Boolean))],
    missing,
    raw,
    _source,
  };
}

// the fields and object types kept under raw across a set of effects, for the PR
export function rawReport(effects) {
  const seen = {};
  for (const fx of effects) {
    for (const k of Object.keys(fx.raw ?? {})) (seen[`EffectEntityData.${k}`] ??= new Set()).add(fx.name);
    for (const e of fx.emitters) {
      for (const [type, fields] of Object.entries(e.raw ?? {})) {
        const keys = Object.keys(fields ?? {});
        if (!keys.length) (seen[type] ??= new Set()).add(fx.name);
        for (const f of keys) (seen[`${type}.${f}`] ??= new Set()).add(fx.name);
      }
    }
  }
  return Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, [...v]]));
}

export function sheetSources(texture) {
  const p = String(texture).toLowerCase();
  return [`web/textures/${p}.png`, `web_opt/textures/${p}.ktx2`, `web/textures/${p}.ktx2`];
}

// 512, 1024 and 2048, none above the source (a smaller source at its own width)
export function sheetSizes(width) {
  const sizes = [512, 1024, 2048].filter((s) => s <= width);
  return sizes.length ? sizes : [width];
}
