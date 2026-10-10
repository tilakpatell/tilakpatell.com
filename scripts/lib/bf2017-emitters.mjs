// The game's effects, read into the site's effect tables: the pure half of
// scripts/bf2017-emitters.mjs (fidelity lane X, the design's "Lane X").
//
// The input is the export's `web/data/FX/**/<Effect>.json` (an
// `EffectBlueprint`) and the `ScalableEmitterDocument`s it names
// (`web/data/**/emitters/em_*.json`), found through the index
// `web/data.tsv` (name, type, path). A document is a list of typed objects:
// `EmitterTemplateData` (the particle's kind, count, life, alignment,
// texture, blend, culling), the spawn blocks (`SpawnRateData`,
// `SpawnSizeData`, `SpawnSpeedData`, `SpawnDirectionData`,
// `SpawnPositionData` over a `BoxEvaluatorData` or `SphereEvaluatorData`),
// the forces (`GravityData`, `DragData`) and the updates over the
// particle's normalised life `EfNormTime` (`UpdateColorData`, HDR;
// `UpdateSizeData`; `UpdateRotationData`; `UpdateAlphaLevelScaleData`;
// `UpdateTextureCoordsData`; `UpdateTransparencyData`). A curve is a
// `PolynomialData` (a cubic, `Coefficients` x + y·t + z·t² + w·t³, times
// `ScaleValue`), a `RandomEvaluatorData` (`Min`…`Max`, one draw a
// particle) or a plain number.
//
// The output, one JSON per effect (src/data/bf2017/fx/<name>.json):
//   { format: 1, name, path, cull, maxActive, probability, nearby: { radius,
//     max } | null, autoStart, variants: { low, mid, high, ultra: { emitters:
//     [index], scale } }, emitters: [emitter], textures: [name], raw, _source }
//   emitter: { name, kind: 'quad'|'mesh'|'ribbon', maxCount, lifetime,
//     duration, loop, spawn: { rate, burst, size, speed, direction: { dir,
//     spread }, position: { box: { center, size } } | { sphere: { radius } } },
//     gravity: { g, random }, drag, color: [r, g, b], size, alpha: { exponent,
//     curve }, rotation, transparency, uv: { frames, grid, fps, randomStart },
//     alignment, stretch: { mult, min, max } | null, lightWrap, soft, texture,
//     additive, maxSpawnDistance, cullingFactor, follow: { source, velocity },
//     mesh, ribbon: { segment } | null, graph, raw, _source: { leaf: where } }
//   curve: number | { poly: [x, y, z, w], scale } | { random: [min, max] }
// Every number keeps where it came from in `_source` (the leaf's path →
// `<document>#<Type>.<Field>`); a field or an object type the reader does
// not understand is kept under `raw`, so nothing read is lost and the PR can
// list what was not.
//
// An `EmitterGraph` (a compiled GPU graph, opaque in the export) is not
// reproduced: it is replaced by the nearest `ScalableEmitterDocument` of
// its family (the same folder, the longest shared name), said as
// `graph: true` with `graphOf`.
//
// curveOf(raw) → curve ; vec3Of(raw) ; readEmitter(doc, name) → emitter
// readIndex(tsv) → Map(lower name → { name, type, path })
// nearestDocument(index, graphName) → the replacement's index row | null
// emitterRefs(blueprint) → [name] ; readVariants(blueprint, refs) → variants
// effectJson(blueprint, docs, index) → the effect's JSON (docs: name → doc)
// fileName(effectName) → '<last part>.json'
// sheetSources(texture) → the export's files for a texture, best first: the
//   master PNG (`web/textures/<lower>.png`), the encoded KTX2
//   (`web_opt/textures/<lower>.ktx2`, then the bucket's `web/textures/<lower>.ktx2`)
// sheetSizes(width) → the widths a source `width` across is written at

import { gridFromName } from '../../src/lib/three/fx/flipbook.js';

export const TIERS = { low: 'Low', mid: 'Medium', high: 'High', ultra: 'Ultra' };
// a blueprint without variants: MaxCount scaled by tier (the plan's rule)
export const TIER_SCALE = { ultra: 1, high: 0.75, mid: 0.5, low: 0.25 };

const KIND = { EmittableType_Quad: 'quad', EmittableType_Mesh: 'mesh', EmittableType_Ribbon: 'ribbon', EmittableType_Trail: 'ribbon' };
const ALIGN = {
  EmittableAlignment_Screen: 'screen',
  EmittableAlignment_MotionStretchScreen: 'motionStretchScreen',
  EmittableAlignment_World: 'world',
  EmittableAlignment_Velocity: 'velocity',
};
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const lower = (s) => String(s ?? '').toLowerCase();
export const fileName = (name) => `${String(name).split('/').pop()}.json`;

export function curveOf(raw) {
  if (num(raw) !== null) return raw;
  if (!raw || typeof raw !== 'object') return null;
  if (raw.$type === 'PolynomialData') {
    const c = raw.Coefficients ?? {};
    return { poly: ['x', 'y', 'z', 'w'].map((k) => num(c[k]) ?? 0), scale: num(raw.ScaleValue) ?? 1 };
  }
  if (raw.$type === 'RandomEvaluatorData') return { random: [num(raw.Min) ?? 0, num(raw.Max) ?? num(raw.Min) ?? 0] };
  if (raw.$type === 'ConstantData' || raw.$type === 'ConstantEvaluatorData') return num(raw.Value);
  return null;
}

// a vec3 of numbers ({ x, y, z }) or of curves
export function vec3Of(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (num(raw.x) !== null) return [raw.x, raw.y ?? 0, raw.z ?? 0];
  if (Array.isArray(raw) && raw.length === 3) return raw.map(Number);
  return null;
}

// a colour curve: three channels of curves, or one curve for all three
function colorOf(raw) {
  if (!raw) return null;
  if (raw.x !== undefined && typeof raw.x === 'object') return ['x', 'y', 'z'].map((k) => curveOf(raw[k]));
  const v = vec3Of(raw);
  if (v) return v;
  const c = curveOf(raw);
  return c === null ? null : [c, c, c];
}

const objectsOf = (doc) => doc?.Objects ?? doc?.objects ?? doc?.Processors ?? [];

export function readEmitter(doc, name = doc?.Name) {
  const src = {};
  const raw = {};
  const at = (type, field) => `${name}#${type}.${field}`;
  const out = {
    name,
    kind: 'quad',
    maxCount: null,
    lifetime: 1,
    duration: null,
    loop: true,
    spawn: { rate: 0, burst: 0, size: 1, speed: 0, direction: { dir: [0, 1, 0], spread: 0 }, position: null },
    gravity: null,
    drag: 0,
    color: [1, 1, 1],
    size: 1,
    alpha: { exponent: 1, curve: 1 },
    rotation: 0,
    transparency: 1,
    uv: { frames: 1, grid: [1, 1], fps: 0, randomStart: false },
    alignment: 'screen',
    stretch: null,
    lightWrap: 0,
    soft: null,
    texture: null,
    additive: false,
    maxSpawnDistance: null,
    cullingFactor: 1,
    follow: { source: false, velocity: false },
    mesh: null,
    ribbon: null,
    graph: false,
  };
  // a field read: set on the output by `put`, its source noted; the rest of
  // the object's fields go to raw
  const read = (obj, map) => {
    const type = obj.$type;
    const left = { ...obj };
    delete left.$type;
    for (const [field, fn] of Object.entries(map)) {
      if (!(field in obj)) continue;
      const leaf = fn(obj[field]);
      delete left[field];
      if (leaf) for (const [path, ok] of Object.entries(leaf)) if (ok) src[path] = at(type, field);
    }
    if (Object.keys(left).length) raw[type] = { ...(raw[type] ?? {}), ...left };
  };
  const set = (path, value) => {
    if (value === null || value === undefined) return { [path]: false };
    const keys = path.split('.');
    let o = out;
    for (const k of keys.slice(0, -1)) o = o[k] ??= {};
    o[keys.at(-1)] = value;
    return { [path]: true };
  };
  for (const obj of objectsOf(doc)) {
    switch (obj?.$type) {
      case 'EmitterTemplateData':
        read(obj, {
          MaxCount: (v) => set('maxCount', num(v)),
          Lifetime: (v) => set('lifetime', curveOf(v)),
          Duration: (v) => set('duration', num(v)),
          Loop: (v) => set('loop', typeof v === 'boolean' ? v : null),
          Emittable: (v) => set('kind', KIND[v] ?? null),
          Alignment: (v) => set('alignment', ALIGN[v] ?? null),
          MotionStretchMultiplier: (v) => set('stretch.mult', num(v)),
          MotionStretchMinLength: (v) => set('stretch.min', num(v)),
          MotionStretchMaxLength: (v) => set('stretch.max', num(v)),
          LightWrapAroundFactor: (v) => set('lightWrap', num(v)),
          SoftParticleDistance: (v) => set('soft', num(v)),
          MaxSpawnDistance: (v) => set('maxSpawnDistance', num(v)),
          ParticleCullingFactor: (v) => set('cullingFactor', num(v)),
          Texture: (v) => set('texture', typeof v === 'string' ? v : (v?.Name ?? null)),
          BlendMode: (v) => set('additive', typeof v === 'string' ? /additive/i.test(v) : null),
          FollowSpawnSource: (v) => set('follow.source', typeof v === 'boolean' ? v : null),
          FollowSpawnSourceVelocity: (v) => set('follow.velocity', typeof v === 'boolean' ? v : null),
          Mesh: (v) => set('mesh', typeof v === 'string' ? v : (v?.Name ?? null)),
          RibbonSegmentLength: (v) => set('ribbon.segment', num(v)),
        });
        break;
      case 'SpawnRateData':
        read(obj, { SpawnRate: (v) => set('spawn.rate', curveOf(v)), BurstCount: (v) => set('spawn.burst', num(v)) });
        break;
      case 'SpawnSizeData':
        read(obj, { Size: (v) => set('spawn.size', curveOf(v)) });
        break;
      case 'SpawnSpeedData':
        read(obj, { Speed: (v) => set('spawn.speed', curveOf(v)) });
        break;
      case 'SpawnDirectionData':
        read(obj, { Direction: (v) => set('spawn.direction.dir', vec3Of(v)), Spread: (v) => set('spawn.direction.spread', num(v)) });
        break;
      case 'SpawnPositionData':
        read(obj, {
          Evaluator: (e) => {
            if (e?.$type === 'BoxEvaluatorData') return set('spawn.position', { box: { center: vec3Of(e.Center) ?? [0, 0, 0], size: vec3Of(e.Size) ?? [0, 0, 0] } });
            if (e?.$type === 'SphereEvaluatorData') return set('spawn.position', { sphere: { radius: num(e.Radius) ?? 0 } });
            raw.SpawnPositionData = { Evaluator: e };
            return null;
          },
        });
        break;
      case 'GravityData':
        read(obj, { Gravity: (v) => set('gravity.g', num(v)), PerParticleRandomness: (v) => set('gravity.random', num(v)) });
        if (out.gravity) out.gravity.random ??= 0;
        break;
      case 'DragData':
      case 'AirResistanceData':
        read(obj, { Drag: (v) => set('drag', num(v)), AirResistance: (v) => set('drag', num(v)) });
        break;
      case 'UpdateColorData':
        read(obj, { Color: (v) => set('color', colorOf(v)) });
        break;
      case 'UpdateSizeData':
        read(obj, { Size: (v) => set('size', curveOf(v)) });
        break;
      case 'UpdateRotationData':
        read(obj, { Rotation: (v) => set('rotation', curveOf(v)) });
        break;
      case 'UpdateAlphaLevelScaleData':
        read(obj, { Exponent: (v) => set('alpha.exponent', num(v)), AlphaLevelScale: (v) => set('alpha.curve', curveOf(v)) });
        break;
      case 'UpdateTransparencyData':
        read(obj, { Transparency: (v) => set('transparency', curveOf(v)) });
        break;
      case 'UpdateTextureCoordsData':
        read(obj, {
          FrameCount: (v) => set('uv.frames', num(v)),
          FramesPerSecond: (v) => set('uv.fps', num(v)),
          RandomStartFrame: (v) => set('uv.randomStart', typeof v === 'boolean' ? v : null),
        });
        break;
      default:
        if (obj?.$type) raw[obj.$type] = { ...obj, $type: undefined };
    }
  }
  // (a document without MaxCount: said, so the PR lists it; the runtime
  // sizes its pool from the rate)
  if (out.maxCount === null) raw._missing = ['EmitterTemplateData.MaxCount'];
  if (out.stretch) out.stretch = { mult: out.stretch.mult ?? 0, min: out.stretch.min ?? 1, max: out.stretch.max ?? Infinity };
  // the sheet's grid from the texture's name (lane F's reading), the frames
  // from the record where it says
  if (out.texture) {
    out.uv.grid = gridFromName(out.texture);
    if (!src['uv.frames']) out.uv.frames = out.uv.grid[0] * out.uv.grid[1];
  }
  if (out.kind === 'ribbon') out.ribbon = { segment: out.ribbon?.segment ?? 1 };
  for (const v of Object.values(raw)) delete v.$type;
  out.raw = raw;
  out._source = src;
  return out;
}

export function readIndex(tsv) {
  const rows = new Map();
  const lines = String(tsv ?? '').split(/\r?\n/);
  const head = lines[0].split('\t').map(lower);
  const col = (k, d) => (head.indexOf(k) >= 0 ? head.indexOf(k) : d);
  const [n, t, p] = [col('name', 0), col('type', 1), col('path', 2)];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const c = line.split('\t');
    rows.set(lower(c[n]), { name: c[n], type: c[t], path: c[p] });
  }
  return rows;
}

// The replacement for an EmitterGraph: the documents in its folder, the one
// sharing the longest start of its name after the em_/eg_ prefix; a family
// with none falls back to the whole index's emitters under the same FX area
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

// the emitter names a blueprint's entity or its variants name, in order, once
export function emitterRefs(blueprint) {
  const out = [];
  const walk = (v, key) => {
    if (typeof v === 'string') {
      if ((key === 'Emitter' || key === 'Emitters' || /\/emitters\/e[mg]_/i.test(v)) && !out.includes(v)) out.push(v);
      return;
    }
    if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(blueprint?.Object, 'Object');
  for (const t of Object.values(TIERS)) walk(blueprint?.[t] ?? blueprint?.Variants?.[t], t);
  return out;
}

export function readVariants(blueprint, refs) {
  const all = refs.map((_, i) => i);
  const out = {};
  for (const [tier, key] of Object.entries(TIERS)) {
    const v = blueprint?.[key] ?? blueprint?.Variants?.[key];
    if (v === undefined || v === null) {
      out[tier] = { emitters: all, scale: TIER_SCALE[tier], from: 'tier rule' };
    } else if (num(v) !== null) {
      out[tier] = { emitters: all, scale: v, from: key };
    } else {
      const names = emitterRefs({ Object: v.Emitters ?? v.Components ?? v });
      const emitters = names.length ? names.map((n) => refs.indexOf(n)).filter((i) => i >= 0) : all;
      out[tier] = { emitters, scale: num(v.MaxCountScale) ?? 1, from: key };
    }
  }
  return out;
}

const BLUEPRINT_KNOWN = ['$type', 'Name', 'CullDistance', 'MaxActiveInstanceCount', 'SpawnProbability', 'NearbyRadius', 'MaxNearbyInstanceCount', 'AutoStart', 'Object', 'Variants', '_fixture', ...Object.values(TIERS)];

// docs: emitter name (any case) → its document (a ScalableEmitterDocument or
// an EmitterGraph); index: readIndex's map, for the graphs' replacements
export function effectJson(blueprint, docs, index = new Map()) {
  const name = blueprint.Name;
  const docOf = (n) => docs.get?.(lower(n)) ?? docs[n] ?? docs[lower(n)] ?? null;
  const refs = emitterRefs(blueprint);
  const missing = [];
  const emitters = [];
  for (const ref of refs) {
    const doc = docOf(ref);
    if (!doc) {
      missing.push(ref);
      emitters.push(null);
      continue;
    }
    if (doc.$type === 'EmitterGraph') {
      const near = nearestDocument(index, ref);
      const nearDoc = near && docOf(near.name);
      if (!nearDoc) {
        missing.push(ref);
        emitters.push(null);
        continue;
      }
      emitters.push({ ...readEmitter(nearDoc, near.name), graph: true, graphOf: ref });
      continue;
    }
    emitters.push(readEmitter(doc, ref));
  }
  // (an emitter not found is dropped and the variants re-indexed past it)
  const keep = emitters.map((e, i) => (e ? i : -1)).filter((i) => i >= 0);
  const variants = readVariants(blueprint, refs);
  for (const v of Object.values(variants)) v.emitters = v.emitters.filter((i) => keep.includes(i)).map((i) => keep.indexOf(i));
  const raw = {};
  for (const [k, v] of Object.entries(blueprint)) if (!BLUEPRINT_KNOWN.includes(k)) raw[k] = v;
  const at = (f) => `${name}#EffectBlueprint.${f}`;
  const _source = {};
  for (const [leaf, f] of [
    ['cull', 'CullDistance'],
    ['maxActive', 'MaxActiveInstanceCount'],
    ['probability', 'SpawnProbability'],
    ['nearby.radius', 'NearbyRadius'],
    ['nearby.max', 'MaxNearbyInstanceCount'],
    ['autoStart', 'AutoStart'],
  ])
    if (f in blueprint) _source[leaf] = at(f);
  for (const [tier, v] of Object.entries(variants)) if (v.from !== 'tier rule') _source[`variants.${tier}`] = at(v.from);
  const list = emitters.filter(Boolean);
  return {
    format: 1,
    name: name.split('/').pop(),
    path: name,
    cull: num(blueprint.CullDistance),
    maxActive: num(blueprint.MaxActiveInstanceCount) ?? 1,
    probability: num(blueprint.SpawnProbability) ?? 1,
    nearby: num(blueprint.NearbyRadius) !== null ? { radius: blueprint.NearbyRadius, max: num(blueprint.MaxNearbyInstanceCount) ?? 1 } : null,
    autoStart: blueprint.AutoStart ?? true,
    graph: list.some((e) => e.graph),
    variants,
    emitters: list,
    textures: [...new Set(list.map((e) => e.texture).filter(Boolean))],
    missing,
    raw,
    _source,
    // (built from the spec's field list, not read from the export: the CLI's
    // run on the desktop replaces it)
    ...(blueprint._fixture ? { fixture: true } : {}),
  };
}

// the fields and object types kept under raw across a set of effects, for the PR
export function rawReport(effects) {
  const seen = {};
  for (const fx of effects) {
    for (const k of Object.keys(fx.raw ?? {})) (seen[`EffectBlueprint.${k}`] ??= new Set()).add(fx.name);
    for (const e of fx.emitters) for (const [type, fields] of Object.entries(e.raw ?? {})) for (const f of Object.keys(fields)) (seen[`${type}.${f}`] ??= new Set()).add(fx.name);
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
