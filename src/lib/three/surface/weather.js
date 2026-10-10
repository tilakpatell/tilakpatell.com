// The world's weather laid on its things, as Frostbite lays it (the surfaces
// design, §5 "Weathering and decals", lane Q4): snow, sand or wet on the
// up-facing, sky-visible faces of every material that allows it, growing
// over the weather's own seconds.
//
// The numbers are the weather record's. Each VisualEnvironment carries a
// GlobalWeatheringParamsEntityData: its SkyVisibilityParam
// (WeatheringSkyVisibilityParam: SkyVisibilityRange, SkyVisibilityExponent,
// IndoorThreshold, DisableMaterialWeatheringIndoor) and an override whose
// WeatherOperation is an AccumulateOverTimeOp (InitialValue, TargetValue,
// TimeToReachTarget, KeepValueWhenMaterialChanged). Hoth's day: 0 to 1 over
// 25 s, the sky's 0.1 to 0.9 mapped linearly, rooms below 0.5 left bare.
// What the record lacks is a named constant below.
//
// The contributors are written to lane Q1's hook (its plan's Global
// Constraints): `(ctx) → { color?, roughness?, metalness?, normal? }`, ctx =
// { uv, uv1, worldNormal, worldPosition, viewDir, skyVisibility, params,
// maps } plus the running channels (ctx.color, ctx.roughness, ...); each
// returns only what it changes, already mixed from the running value.
// `params.weather` is the material's gate from its recipe ({ top, sand,
// rain, use, snow, mask }); a material that allows none gets `{}`. TSL is
// passed in (`{ tsl }`, from light/three.js's loadThree()), so this file
// imports nothing from three and its tests can record the graph.
//
// weatherParams(record, kind) → { kind, range, exponent, indoor, disableIndoor, initial, target, seconds, keep, _source }
// accumulation(t, params, from?) → k            the record's op at t seconds
// skyFactor(sky, params) → 0…1 ; weatherAmount({ up, sky, amount }, params) → 0…1   (the shader's numbers, in JS)
// gateOf(weather, kind) → bool
// snowOverlay(params, { tsl }) | sandOverlay | wetOverlay → contributor,
//   with .kind, .amount (the accumulation's uniform) and .setTime(t, from?)
// weatheringRecord(veData, kind) → weather.json: the VE data file's four
//   weathering objects, keyed by index (scripts/bf2017-weather.mjs writes it
//   beside a level pack)
// kindOf(world) → 'snow' | 'sand' | 'wet' | null
// overlaysFor(weather, kind, { tsl }) → contributor[]   (weather: a weather.json,
//   or the VE data file; kind defaults to its own `kind`)
// weatherClock(contributors) → { update(dt), change(contributors), seconds }
//
// Where the numbers live: GlobalWeatheringParamsEntityData is an entity of
// the VE data file (`data/Levels/Lighting/<world>/<weather>/VE_*.json` in
// the bucket), not a component of the map extras' environments that lane
// R's entry reads, so an entry gives nothing and the world's weather.json
// is what a level hands overlaysFor.

// The up-facing band: none at or below a normal's y of UP_MIN (about 66°
// from up), all at UP_MAX (about 26°); the design's smoothstep, the
// records carrying no exponent for it
export const UP_MIN = 0.4;
export const UP_MAX = 0.9;
// fresh snow: an albedo of about 0.9, a touch blue (the record's
// EnlightenComponentData TerrainColor, 0.547, 0.594, 0.644, is the lit
// ground's bounce, not the snow's albedo); the design's roughness for the
// sparkle map's flakes
export const SNOW_COLOR = [0.9, 0.93, 0.96];
export const SNOW_ROUGHNESS = 0.35;
// a desert's dust (Jakku's and Tatooine's sand, a mid sRGB tan in linear),
// matte
export const SAND_COLOR = [0.62, 0.45, 0.28];
export const SAND_ROUGHNESS = 0.9;
// wet: the albedo darkened by water filling the pores, glossy
export const WET_DARKEN = 0.6;
export const WET_ROUGHNESS = 0.08;
// (a room flagged at the record's IndoorThreshold is indoors: the node's
// step needs the threshold nudged to make "at" count as "below")
const INDOOR_EPS = 1e-4;

// the weather each world's records lay (the design's Q4: snow on Hoth and
// Crait, sand on Jakku and Tatooine, wet on Kamino's storm and Kashyyyk's
// rain); an entry's own `weatherKind` wins
export const WEATHER_KIND = { hoth: 'snow', crait: 'snow', jakku: 'sand', tatooine: 'sand', kamino: 'wet', kashyyyk: 'wet' };

// what a record without weathering gives: nothing accumulates
const DEFAULTS = { range: [0, 1], exponent: 1, indoor: 0, disableIndoor: false, initial: 0, target: 0, seconds: 0, keep: false };

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// The weathering objects of a record, whichever way it comes: the raw data
// file (`objects` with `$ref`s by index), lane R's entry (`.record`), or the
// record itself with the entity inlined (`GlobalWeatheringParamsEntityData:
// [ … ]`, as light/fixtures/hoth.ve.json pins it)
function weatheringOf(input) {
  const rec = input?.record ?? input ?? {};
  const name = input?.name ?? rec.name ?? 'entry.record';
  const objects = rec.objects;
  const deref = (o) => (o && typeof o === 'object' && '$ref' in o && objects ? objects[o.$ref] : o);
  let global = rec.GlobalWeatheringParamsEntityData?.[0] ?? null;
  if (!global && objects) global = Object.values(objects).find((o) => o?.$type === 'GlobalWeatheringParamsEntityData') ?? null;
  if (!global) return { name, sky: null, op: null };
  const sky = deref(global.SkyVisibilityParam) ?? null;
  const op = (global.GlobalParamsOverrides ?? []).map((p) => deref(deref(p)?.WeatherOperation)).find((o) => o?.$type === 'AccumulateOverTimeOp' || (o && 'TimeToReachTarget' in o)) ?? null;
  return { name, sky, op };
}

export function weatherParams(record, kind = 'snow') {
  const { name, sky, op } = weatheringOf(record);
  const out = { kind, ...DEFAULTS, range: DEFAULTS.range.slice(), _source: {} };
  const src = (k, path) => (out._source[k] = `${name}:GlobalWeatheringParamsEntityData.${path}`);
  for (const k of Object.keys(DEFAULTS)) out._source[k] = `default (weather.js DEFAULTS.${k}: the record has none)`;
  if (sky) {
    const base = 'SkyVisibilityParam.WeatheringSkyVisibilityParam';
    const r = sky.SkyVisibilityRange;
    if (r && Number.isFinite(r.x) && Number.isFinite(r.y)) (out.range = [r.x, r.y]), src('range', `${base}.SkyVisibilityRange`);
    if (Number.isFinite(sky.SkyVisibilityExponent)) (out.exponent = sky.SkyVisibilityExponent), src('exponent', `${base}.SkyVisibilityExponent`);
    if (Number.isFinite(sky.IndoorThreshold)) (out.indoor = sky.IndoorThreshold), src('indoor', `${base}.IndoorThreshold`);
    if (typeof sky.DisableMaterialWeatheringIndoor === 'boolean') (out.disableIndoor = sky.DisableMaterialWeatheringIndoor), src('disableIndoor', `${base}.DisableMaterialWeatheringIndoor`);
  }
  if (op) {
    const base = 'GlobalParamsOverrides.WeatheringParam.WeatherOperation.AccumulateOverTimeOp';
    if (Number.isFinite(op.InitialValue)) (out.initial = op.InitialValue), src('initial', `${base}.InitialValue`);
    if (Number.isFinite(op.TargetValue)) (out.target = op.TargetValue), src('target', `${base}.TargetValue`);
    if (Number.isFinite(op.TimeToReachTarget)) (out.seconds = op.TimeToReachTarget), src('seconds', `${base}.TimeToReachTarget`);
    if (typeof op.KeepValueWhenMaterialChanged === 'boolean') (out.keep = op.KeepValueWhenMaterialChanged), src('keep', `${base}.KeepValueWhenMaterialChanged`);
  }
  return out;
}

// The record's AccumulateOverTimeOp at t seconds from the weather's start:
// linear from InitialValue to TargetValue over TimeToReachTarget, held
// after. `from` is the value the last weather left: with
// KeepValueWhenMaterialChanged the new weather grows from it, else from its
// own InitialValue.
export function accumulation(t, params, from = null) {
  const start = params.keep && from != null ? from : params.initial;
  if (!(params.seconds > 0)) return params.target;
  return start + (params.target - start) * clamp01(t / params.seconds);
}

// the sky visibility through the record's range and exponent; a face at or
// below IndoorThreshold is indoors and, with DisableMaterialWeatheringIndoor,
// bare
export function skyFactor(sky, params) {
  if (params.disableIndoor && sky <= params.indoor) return 0;
  const [a, b] = params.range;
  return clamp01((sky - a) / (b - a)) ** params.exponent;
}

export function weatherAmount({ up, sky = 1, amount = 1 }, params) {
  return smooth(UP_MIN, UP_MAX, up) * skyFactor(sky, params) * amount;
}

// Which of a material's flags let a weather on (its recipe's
// `params.weather`, from the dump's UseWeather, ESB_TopDirt, ESB_Sand,
// ESB_Rain and the SS_VehiclePreset_Snow family): UseWeather is any
// weather; TopDirt is what settles on top, snow or sand; Rain and Sand are
// their own
export function gateOf(weather, kind) {
  if (!weather) return false;
  if (kind === 'snow') return !!(weather.use || weather.top || weather.snow);
  if (kind === 'sand') return !!(weather.use || weather.top || weather.sand);
  if (kind === 'wet') return !!(weather.use || weather.rain);
  return false;
}

// One contributor's frame: the gate, the factor (up-facing × sky ×
// accumulation × the WeatheringMask's channel) and the accumulation's
// uniform the caller moves with setTime
function contributor(kind, params, { tsl }, draw) {
  const { float, mul, sub, div, clamp, pow, step, smoothstep } = tsl;
  const amount = tsl.uniform(accumulation(0, params));
  const skyNode = (sv) => {
    if (sv == null || typeof sv === 'number') return float(skyFactor(sv ?? 1, params));
    const [a, b] = params.range;
    const lit = pow(clamp(div(sub(sv, float(a)), float(b - a)), float(0), float(1)), float(params.exponent));
    return params.disableIndoor ? mul(step(float(params.indoor + INDOOR_EPS), sv), lit) : lit;
  };
  const fn = (ctx) => {
    const weather = ctx?.params?.weather;
    if (!gateOf(weather, kind)) return {};
    let k = mul(mul(smoothstep(float(UP_MIN), float(UP_MAX), ctx.worldNormal.y), skyNode(ctx.skyVisibility)), amount);
    const map = ctx.maps?.weathering;
    if (weather.mask && map) {
      const texel = map.isTexture ? tsl.texture(map, ctx.uv) : map;
      k = mul(k, texel[weather.mask]);
    }
    const out = draw(ctx, k);
    for (const c of Object.keys(out)) if (out[c] === undefined) delete out[c];
    return out;
  };
  fn.kind = kind;
  fn.params = params;
  fn.amount = amount;
  fn.setTime = (t, from = null) => {
    amount.value = accumulation(t, params, from);
    return amount.value;
  };
  return fn;
}

// snow: white, flake-rough, the bumps filled toward the face's own normal,
// metal buried
export function snowOverlay(params, three) {
  const { float, vec3, mix, normalize } = three.tsl;
  return contributor('snow', params, three, (ctx, k) => ({
    color: mix(ctx.color, vec3(...SNOW_COLOR), k),
    roughness: ctx.roughness === undefined ? undefined : mix(ctx.roughness, float(SNOW_ROUGHNESS), k),
    metalness: ctx.metalness === undefined ? undefined : mix(ctx.metalness, float(0), k),
    normal: ctx.normal === undefined ? undefined : normalize(mix(ctx.normal, three.tsl.normalView, k)),
  }));
}

// sand: the desert's colour, matte
export function sandOverlay(params, three) {
  const { float, vec3, mix } = three.tsl;
  return contributor('sand', params, three, (ctx, k) => ({
    color: mix(ctx.color, vec3(...SAND_COLOR), k),
    roughness: ctx.roughness === undefined ? undefined : mix(ctx.roughness, float(SAND_ROUGHNESS), k),
  }));
}

// wet: the albedo darkened, the surface glossy; metal stays metal
export function wetOverlay(params, three) {
  const { float, mix, mul } = three.tsl;
  return contributor('wet', params, three, (ctx, k) => ({
    color: mul(ctx.color, mix(float(1), float(WET_DARKEN), k)),
    roughness: ctx.roughness === undefined ? undefined : mix(ctx.roughness, float(WET_ROUGHNESS), k),
  }));
}

const BY_KIND = { snow: snowOverlay, sand: sandOverlay, wet: wetOverlay };
const WEATHERING = new Set(['GlobalWeatheringParamsEntityData', 'WeatheringParam', 'WeatheringSkyVisibilityParam', 'AccumulateOverTimeOp']);

export const kindOf = (world) => WEATHER_KIND[world] ?? null;

export function weatheringRecord(data, kind = null) {
  const objects = {};
  for (const [i, o] of Object.entries(data?.objects ?? {})) if (WEATHERING.has(o?.$type)) objects[i] = o;
  return { name: data?.name ?? null, kind, objects };
}

// the contributors a world's weather wants, for createGameMaterial's
// `overlays` (Q1): one, of the weather's kind, or none
export function overlaysFor(weather, kind, three) {
  const k = kind === undefined ? (weather?.kind ?? null) : kind;
  const make = BY_KIND[k];
  return make ? [make(weatherParams(weather, k), three)] : [];
}

// The weather's clock: seconds since it began, handed to each contributor's
// accumulation. A change of weather starts the clock again; under
// KeepValueWhenMaterialChanged the new one grows from the value the old one
// had reached.
export function weatherClock(contributors = []) {
  let list = contributors;
  let seconds = 0;
  let from = null;
  const apply = () => list.forEach((c) => c.setTime(seconds, from));
  apply();
  return {
    get seconds() {
      return seconds;
    },
    update(dt) {
      seconds += dt;
      apply();
    },
    change(next) {
      from = list[0]?.amount.value ?? null;
      list = next;
      seconds = 0;
      apply();
    },
  };
}
