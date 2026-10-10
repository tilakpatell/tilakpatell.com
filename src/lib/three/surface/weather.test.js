import { describe, expect, it } from 'vitest';
import hothWeather from './fixtures/hoth.weather.json';
import hoth from '../light/fixtures/hoth.ve.json';
import { SAND_ROUGHNESS, SNOW_ROUGHNESS, UP_MAX, UP_MIN, WET_DARKEN, WET_ROUGHNESS, accumulation, gateOf, kindOf, overlaysFor, sandOverlay, skyFactor, snowOverlay, weatherAmount, weatherClock, weatherParams, weatheringRecord, wetOverlay } from './weather.js';

// A TSL stand-in that records the graph: every call is { op, args }, so a
// test reads which channels a contributor made and from what
const node = (op, args = []) => {
  const n = { op, args };
  for (const c of ['x', 'y', 'z', 'r', 'g', 'b', 'a']) Object.defineProperty(n, c, { get: () => node('.' + c, [n]), enumerable: false });
  return n;
};
const tsl = new Proxy(
  {},
  {
    get: (_, op) => (op === 'normalView' ? node('normalView') : (...args) => (op === 'uniform' ? Object.assign(node('uniform', args), { value: args[0] }) : node(op, args))),
  },
);
const stub = { tsl };
const ctxOf = (weather) => ({
  uv: node('uv'),
  worldNormal: node('normalWorld'),
  worldPosition: node('positionWorld'),
  skyVisibility: 1,
  color: node('baseColor'),
  roughness: node('baseRoughness'),
  metalness: node('baseMetalness'),
  normal: node('baseNormal'),
  params: { weather },
  maps: {},
});
// does a graph hold a node (by identity) anywhere under it
const holds = (n, target) => n === target || (n && Array.isArray(n.args) && n.args.some((a) => holds(a, target)));
const ops = (n, out = new Set()) => {
  if (n && n.op) {
    out.add(n.op);
    for (const a of n.args) ops(a, out);
  }
  return out;
};

describe('weatherParams', () => {
  it('Hoth Sunny’s record, from the raw data file with its $refs', () => {
    const p = weatherParams(hothWeather, 'snow');
    expect(p).toMatchObject({ kind: 'snow', range: [0.1, 0.9], exponent: 1, indoor: 0.5, disableIndoor: true, initial: 0, target: 1, seconds: 25, keep: true });
    expect(p._source.seconds).toMatch(/VE_Sky_Arctic_Sunny_01.*AccumulateOverTimeOp\.TimeToReachTarget/);
    expect(p._source.range).toMatch(/WeatheringSkyVisibilityParam\.SkyVisibilityRange/);
  });
  it('lane R’s entry (the map extras’ environments) carries no weathering entity: nothing accumulates from it', () => {
    // (GlobalWeatheringParamsEntityData is in the VE data file, not in the
    // extras: the world's weather.json carries it, weatheringRecord's shape)
    const p = weatherParams(hoth.sunny, 'snow');
    expect(p.target).toBe(0);
    expect(p._source.target).toMatch(/default/);
  });
  it('weatheringRecord: the VE data file trimmed to its four weathering objects, the same numbers', () => {
    const full = { name: hothWeather.name, objects: [] };
    for (const [i, o] of Object.entries(hothWeather.objects)) full.objects[Number(i)] = o;
    full.objects[3] = { $type: 'SkyComponentData', LuminanceScale: 35000 };
    const rec = weatheringRecord(full, 'snow');
    expect(rec.kind).toBe('snow');
    expect(Object.values(rec.objects).map((o) => o.$type).sort()).toEqual(['AccumulateOverTimeOp', 'GlobalWeatheringParamsEntityData', 'WeatheringParam', 'WeatheringSkyVisibilityParam']);
    expect(weatherParams(rec, 'snow')).toMatchObject({ seconds: 25, target: 1, range: [0.1, 0.9] });
  });
  it('a record with no weathering: the named defaults, said in _source, and nothing accumulates', () => {
    const p = weatherParams({}, 'sand');
    expect(p.target).toBe(0);
    expect(p._source.target).toMatch(/default/);
  });
});

describe('accumulation', () => {
  const p = weatherParams(hothWeather, 'snow');
  it('InitialValue at the start, half at half the time, TargetValue at TimeToReachTarget and after', () => {
    expect(accumulation(0, p)).toBe(0);
    expect(accumulation(12.5, p)).toBeCloseTo(0.5);
    expect(accumulation(25, p)).toBe(1);
    expect(accumulation(120, p)).toBe(1);
    expect(accumulation(-3, p)).toBe(0);
  });
  it('KeepValueWhenMaterialChanged: a weather faded in starts from the value it had', () => {
    expect(accumulation(0, p, 0.4)).toBeCloseTo(0.4);
    expect(accumulation(12.5, p, 0.4)).toBeCloseTo(0.7);
    expect(accumulation(0, { ...p, keep: false }, 0.4)).toBe(0);
  });
  it('no time to reach: the target at once', () => {
    expect(accumulation(0, { ...p, seconds: 0 })).toBe(1);
  });
});

describe('the numbers the overlays draw', () => {
  const p = weatherParams(hothWeather, 'snow');
  it('the up-facing band', () => {
    expect(weatherAmount({ up: UP_MIN, sky: 1, amount: 1 }, p)).toBe(0);
    expect(weatherAmount({ up: UP_MAX, sky: 1, amount: 1 }, p)).toBe(1);
    expect(weatherAmount({ up: -1, sky: 1, amount: 1 }, p)).toBe(0);
  });
  it('the sky visibility through the record’s range and exponent; a room at IndoorThreshold takes none', () => {
    expect(skyFactor(1, p)).toBe(1);
    expect(skyFactor(0.5, { ...p, disableIndoor: false })).toBeCloseTo(0.5);
    expect(skyFactor(0.5, p)).toBe(0);
    expect(skyFactor(0.05, { ...p, disableIndoor: false })).toBe(0);
    expect(skyFactor(0.7, { ...p, exponent: 2 })).toBeCloseTo(0.75 ** 2);
  });
  it('the accumulation scales it', () => {
    expect(weatherAmount({ up: 1, sky: 1, amount: 0.5 }, p)).toBeCloseTo(0.5);
  });
});

describe('the gate (Review Focus 1)', () => {
  it('a material that allows no weather takes none, even in a blizzard', () => {
    const p = weatherParams(hothWeather, 'snow');
    const snow = snowOverlay(p, stub);
    expect(snow(ctxOf({ use: false, top: false }))).toEqual({});
    // (UseWeather false does not veto TopDirt: a recipe defaults `use` to
    // false where the dump lacks it, as on most of the 100 TopDirt props)
    expect(Object.keys(snow(ctxOf({ use: false, top: true })))).toContain('color');
    expect(snow(ctxOf(undefined))).toEqual({});
    expect(snow({ ...ctxOf(null), params: {} })).toEqual({});
  });
  it('by kind: snow on UseWeather, TopDirt or the snow preset; sand on Sand or TopDirt; wet on Rain or UseWeather', () => {
    expect(gateOf({ top: true }, 'snow')).toBe(true);
    expect(gateOf({ snow: true }, 'snow')).toBe(true);
    expect(gateOf({ use: true }, 'snow')).toBe(true);
    expect(gateOf({ rain: true }, 'snow')).toBe(false);
    expect(gateOf({ sand: true }, 'sand')).toBe(true);
    expect(gateOf({ top: true }, 'sand')).toBe(true);
    expect(gateOf({ rain: true }, 'wet')).toBe(true);
    expect(gateOf({ sand: true }, 'wet')).toBe(false);
  });
});

describe('the contributors, on the hook contract', () => {
  const p = weatherParams(hothWeather, 'snow');
  it('snow: colour, roughness, normal and metalness, each mixed from the running value by one factor', () => {
    const ctx = ctxOf({ top: true });
    const out = snowOverlay(p, stub)(ctx);
    expect(Object.keys(out).sort()).toEqual(['color', 'metalness', 'normal', 'roughness']);
    expect(out.color.op).toBe('mix');
    expect(out.color.args[0]).toBe(ctx.color);
    expect(out.roughness.args[0]).toBe(ctx.roughness);
    expect(out.roughness.args[1].args[0]).toBe(SNOW_ROUGHNESS);
    const k = out.color.args[2];
    expect(out.roughness.args[2]).toBe(k);
    // the factor reads the world normal's up-facing band and the accumulation
    expect(holds(k, ctx.worldNormal)).toBe(true);
    expect(ops(k).has('smoothstep')).toBe(true);
    expect(ops(k).has('uniform')).toBe(true);
    expect(holds(out.normal, ctx.normal)).toBe(true);
  });
  it('the WeatheringMask’s channel multiplies the factor when the material names one', () => {
    const mask = node('maskTexture');
    const ctx = { ...ctxOf({ use: true, mask: 'g' }), maps: { weathering: mask } };
    const k = snowOverlay(p, stub)(ctx).color.args[2];
    expect(holds(k, mask)).toBe(true);
    expect(ops(k).has('.g')).toBe(true);
  });
  it('a channel the running material lacks is not made up', () => {
    const ctx = { ...ctxOf({ top: true }), normal: undefined };
    expect(snowOverlay(p, stub)(ctx).normal).toBeUndefined();
  });
  it('sand: colour and roughness at the desert’s', () => {
    const out = sandOverlay(weatherParams(hothWeather, 'sand'), stub)(ctxOf({ sand: true }));
    expect(Object.keys(out).sort()).toEqual(['color', 'roughness']);
    expect(out.roughness.args[1].args[0]).toBe(SAND_ROUGHNESS);
  });
  it('wet: a darker albedo and a glossy roughness, the metalness left alone', () => {
    const ctx = ctxOf({ rain: true });
    const out = wetOverlay(weatherParams(hothWeather, 'wet'), stub)(ctx);
    expect(Object.keys(out).sort()).toEqual(['color', 'roughness']);
    expect(holds(out.color, ctx.color)).toBe(true);
    expect(JSON.stringify(out.color)).toContain(String(WET_DARKEN));
    expect(out.roughness.args[1].args[0]).toBe(WET_ROUGHNESS);
  });
  it('setTime moves the accumulation’s uniform to the record’s value', () => {
    const snow = snowOverlay(p, stub);
    expect(snow.amount.value).toBe(0);
    snow.setTime(12.5);
    expect(snow.amount.value).toBeCloseTo(0.5);
    snow.setTime(30);
    expect(snow.amount.value).toBe(1);
  });
});

describe('overlaysFor', () => {
  it('the weather’s kind picks the contributor, its numbers the world’s weather record', () => {
    expect(overlaysFor(hothWeather, 'snow', stub).map((c) => c.kind)).toEqual(['snow']);
    expect(overlaysFor(hothWeather, 'sand', stub).map((c) => c.kind)).toEqual(['sand']);
    expect(overlaysFor(hothWeather, 'wet', stub).map((c) => c.kind)).toEqual(['wet']);
    expect(overlaysFor(hothWeather, null, stub)).toEqual([]);
    expect(overlaysFor(hothWeather, 'snow', stub)[0].params.seconds).toBe(25);
  });
  it('the kind from the record’s own `kind` (weather.json) or the world', () => {
    expect(kindOf('hoth')).toBe('snow');
    expect(kindOf('jakku')).toBe('sand');
    expect(kindOf('kamino')).toBe('wet');
    expect(kindOf('endor')).toBe(null);
    expect(overlaysFor({ ...hothWeather, kind: 'snow' }, undefined, stub).map((c) => c.kind)).toEqual(['snow']);
  });
  it('builds on the real TSL too', async () => {
    const t = await import('three/tsl');
    const [snow] = overlaysFor(hothWeather, 'snow', { tsl: t });
    const out = snow({ worldNormal: t.normalWorld, skyVisibility: 1, color: t.vec3(0.5, 0.4, 0.3), roughness: t.float(0.7), metalness: t.float(0), normal: t.normalView, params: { weather: { top: true } }, maps: {} });
    expect(out.color.isNode).toBe(true);
    expect(out.normal.isNode).toBe(true);
  });
});

describe('weatherClock', () => {
  it('moves the contributors’ accumulation with the seconds since the weather began', () => {
    const overlays = overlaysFor(hothWeather, 'snow', stub);
    const clock = weatherClock(overlays);
    clock.update(12.5);
    expect(overlays[0].amount.value).toBeCloseTo(0.5);
    clock.update(20);
    expect(overlays[0].amount.value).toBe(1);
  });
  it('a new weather with KeepValueWhenMaterialChanged grows from the value the last one left', () => {
    const first = overlaysFor(hothWeather, 'snow', stub);
    const clock = weatherClock(first);
    clock.update(5); // 0.2
    const next = overlaysFor(hothWeather, 'snow', stub);
    clock.change(next);
    expect(next[0].amount.value).toBeCloseTo(0.2);
    clock.update(10); // 0.2 + 0.8 × 10/25
    expect(next[0].amount.value).toBeCloseTo(0.52);
  });
});
