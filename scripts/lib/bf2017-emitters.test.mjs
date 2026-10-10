import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { evalCurve } from '../../src/lib/three/particles/curves.js';
import { curveOf, derefPartition, effectJson, emitterRefs, nearestDocument, operatorTable, rawReport, readIndex, readTemplate, scaled, sheetSizes, sheetSources, splineTable } from './bf2017-emitters.mjs';

// the real records, trimmed (scripts/fixtures/bf2017/fx/README.md)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/bf2017/fx');
const index = readIndex(readFileSync(join(ROOT, 'data.tsv'), 'utf8'));
const load = (name) => JSON.parse(gunzipSync(readFileSync(join(ROOT, `${index.get(name.toLowerCase()).path}.gz`))));
const docs = new Map([...index.values()].filter((r) => r.type !== 'EffectBlueprint').map((r) => [r.name.toLowerCase(), load(r.name)]));
const SNOW = 'FX/Ambient/_MP/Hoth/FX_Snow_FallingSnow_01_Hoth';
const EXHAUST = 'FX/Vehicles/EngineExhaust/FX_EngineExhaust_TransportGR75_Prim';
const IMPACT = 'FX/impacts/Blaster/Snow/FX_Impact_Blaster_Snow';
const TIE = 'FX/Vehicles/ConTrails/FX_ConTrail_TieFighter';
const snow = effectJson(load(SNOW), docs, index);
const exhaust = effectJson(load(EXHAUST), docs, index);
const impact = effectJson(load(IMPACT), docs, index);
const tie = effectJson(load(TIE), docs, index);
const em = (fx, part) => fx.emitters.find((e) => e.name.includes(part));

describe('the partition', () => {
  it('follows its links to the root', () => {
    const root = derefPartition({ root: 0, objects: [{ $type: 'A', b: { $ref: 1 }, list: [{ $ref: 1 }] }, { $type: 'B', back: { $ref: 0 } }] });
    expect(root.b.$type).toBe('B');
    expect(root.list[0]).toBe(root.b);
    expect(root.b.back).toBe(root);
  });
  it('reads the index without a header', () => {
    expect(index.get(SNOW.toLowerCase())).toMatchObject({ type: 'EffectBlueprint', path: 'data/FX/Ambient/_MP/Hoth/FX_Snow_FallingSnow_01_Hoth.json' });
  });
});

describe('curves', () => {
  it('a PolynomialData: x·t³ + y·t² + z·t + w, clamped, then scaled', () => {
    const c = curveOf({ $type: 'PolynomialData', Coefficients: { x: 0, y: 0, z: -0.14438498, w: 0.8502138 }, MinClamp: 0.51, MaxClamp: 1, ScaleValue: 2 });
    expect(evalCurve(c, 0)).toBeCloseTo(1.7004, 4);
    expect(evalCurve(c, 1)).toBeCloseTo((0.8502138 - 0.14438498) * 2, 6);
    expect(evalCurve({ ...c, poly: [0, 0, -2, 1] }, 1)).toBeCloseTo(1.02, 6);
  });
  it('under EfOne a cubic is its value at 1', () => {
    expect(curveOf({ $type: 'PolynomialData', Coefficients: { x: 0, y: 0, z: 1, w: 0.25 }, MinClamp: 0, MaxClamp: 1, ScaleValue: 3 }, 'EfOne')).toBe(3);
  });
  it('a random range, ordered; a default; a scale times a curve', () => {
    expect(curveOf({ $type: 'RandomEvaluatorData', Min: 1, Max: 0.9 })).toEqual({ random: [0.9, 1] });
    expect(curveOf({ $type: 'DefaultEvaluatorData', Values: { x: 0.15 } })).toBe(0.15);
    expect(scaled({ random: [1, 1.25] }, 0.5)).toEqual({ random: [0.5, 0.625] });
    expect(scaled(null, 4)).toBe(4);
  });
  it('a SplineData sampled through its knots as a Hermite', () => {
    const t = splineTable({ XValues0: { x: 0, y: 0.5, z: 1, w: 0 }, YValues0: { x: 0, y: 1, z: 0, w: 0 }, GValues0: { x: 0, y: 0, z: 0, w: 0 } });
    expect(t).toHaveLength(17);
    expect(t[0]).toBe(0);
    expect(t[8]).toBe(1);
    expect(t[16]).toBe(0);
    expect(t[4]).toBeCloseTo(0.5, 6);
  });
  it('a PolynomialOperatorData: the two cubics multiplied, clamped, sampled', () => {
    const one = { Coefficients: { x: 0, y: 0, z: 1, w: 0 }, ScaleValue: 1, MinClamp: 0, MaxClamp: 1 };
    const t = operatorTable({ Operation: 'Multiplication', FirstOperand: one, SecondOperand: one, MinClampResult: 0, MaxClampResult: 1 });
    expect(t[8]).toBeCloseTo(0.25, 6);
    expect(t[16]).toBe(1);
  });
});

describe('the template, from the real records', () => {
  const powder = em(snow, 'powder');
  it("the hangar's powder: HDR 12.7, stretched across the screen, culled at 55 m", () => {
    expect(powder.color.map((c) => +c.toFixed(2))).toEqual([12.73, 12.28, 12.06]);
    expect(powder).toMatchObject({ kind: 'quad', maxCount: 31, alignment: 'motionStretchScreen', lightWrap: 0.5, maxSpawnDistance: 55, cullingFactor: 0.8, additive: false });
    expect(powder.stretch).toEqual({ mult: 10, norm: 50, min: 1, max: 100 });
    expect(powder.gravity).toEqual({ g: 9.8, random: 0.2 });
  });
  it('the emitter runs for its template Lifetime; a particle lives its UpdateAgeData Lifetime', () => {
    expect(powder).toMatchObject({ lifetime: 1, duration: 2, loop: false });
    const burn = em(exhaust, 'burn');
    expect(burn).toMatchObject({ lifetime: 0.15, duration: null, loop: true });
    expect(em(impact, 'sparksflash')).toMatchObject({ duration: 0.05, loop: false });
  });
  it('the spawn block: rate, sizes and directions drawn, a box or a shell', () => {
    expect(powder.spawn).toMatchObject({ rate: 30, size: { random: [0, 1.75] }, speed: { random: [0.2, 0.5] }, direction: { box: { min: [0, -1, 0], max: [0, -0.5, 0] } }, position: { box: { center: [0, 0, 0], size: [0.25, 0, 0] } } });
    expect(em(impact, 'smokespikes').spawn.position).toEqual({ sphere: { radius: 0.1, inner: 0, zenith: [0, 60], scale: [0.25, 0.25, 0.25], center: [0, 0, 0] } });
  });
  it('a colour born at Color0 and cooling to Color1 along a cubic (PolynomialColorInterpData)', () => {
    const [r, , b] = em(exhaust, 'burn').color;
    expect(evalCurve(r, 0)).toBeCloseTo(4.447832 + (21.222084 - 4.447832) * 1.00999987, 3);
    expect(evalCurve(b, 1)).toBeCloseTo(70 + (300 - 70) * (1.00999987 - 1.0050503), 3);
  });
  it('a glow: additive, its exposure factor, following its engine', () => {
    expect(em(exhaust, 'prim_glow')).toMatchObject({ additive: true, exposure: 0.75, follow: { source: true, velocity: false }, color: [0.289911866, 2.17637634, 10], transparency: { random: [0.7, 1] } });
  });
  it('the frames: a random start and once over the life', () => {
    expect(em(snow, 'dust_thin').uv).toEqual({ frames: 8, grid: [4, 2], fps: 0, randomStart: true, overLife: true });
  });
  it('a mesh emitter and a ribbon', () => {
    expect(em(snow, 'debris').kind).toBe('mesh');
    expect(tie.emitters[0]).toMatchObject({ kind: 'ribbon', maxCount: 150, ribbon: { segment: 1 } });
  });
  it('says where every leaf came from', () => {
    expect(powder._source.maxCount).toBe('fx/ambient/_mp/hoth/emitters/em_snow_fallingrocks_powder_hoth#EmitterTemplateData.MaxCount');
    expect(powder._source['gravity']).toMatch(/#GravityData\.Gravity$/);
    expect(powder._source.color).toMatch(/#UpdateColorData\.Color$/);
    expect(powder._source.probability).toMatch(/#EmitterEntityData\[.*powder_hoth\]\.SpawnProbability$/);
  });
  it('keeps what it does not read under raw', () => {
    expect(powder.raw.EmitterTemplateData).toMatchObject({ TimeScale: 1, MotionStretchLengthClamp: 100 });
    expect(rawReport([snow])['EffectEntityData.KillOnMaxCount']).toEqual(['FX_Snow_FallingSnow_01_Hoth']);
  });
  it('defaults a template without a MaxCount and says so', () => {
    expect(readTemplate({ $type: 'EmitterTemplateData' }, 'em_x')).toMatchObject({ maxCount: null, raw: { _missing: ['EmitterTemplateData.MaxCount'] } });
  });
});

describe('the blueprint', () => {
  it('cull and the active cap by tier; 0 is no cull', () => {
    expect(snow).toMatchObject({ name: 'FX_Snow_FallingSnow_01_Hoth', cull: 50, maxActive: 35, autoStart: true, graph: false, missing: [] });
    expect(exhaust).toMatchObject({ graph: false, missing: [] });
    expect(exhaust.cull).toBeNull();
    expect(tie.maxActive).toBe(160);
  });
  it('the per-emitter fields: probability by tier, delay, offset, the nearby cap', () => {
    expect(em(snow, 'powder').probability).toEqual({ low: 0.8, mid: 0.8, high: 0.8, ultra: 0.8 });
    expect(em(snow, 'dust_thin').delay).toBe(0.2);
    expect(em(exhaust, 'burn').offset.map((v) => +v.toFixed(4))).toEqual([0, -0, -0.8758]);
    expect(impact.nearby).toEqual({ radius: 5, max: 5 });
  });
  it('the variants: one entry per template, each tier the ones it draws', () => {
    expect(snow.variants.high.emitters).toEqual([0, 1, 3]);
    expect(snow.variants.ultra.emitters).toEqual([0, 2, 3]);
    expect(impact.variants.low.emitters).toEqual([0, 1, 2, 4]);
    expect(impact.variants.ultra.emitters).toEqual([0, 1, 3, 4]);
    expect(snow.variants.mid).toMatchObject({ cull: 50, maxActive: 35, scale: 1 });
  });
  it('lists the textures once and the emitters it names', () => {
    expect(exhaust.textures).toEqual(['FX/Textures/Exhausts/T_EngineExhaust_01_D', 'FX/Textures/Gradients/Gradient_Circle']);
    expect(emitterRefs(load(EXHAUST))).toHaveLength(3);
  });
});

describe('EmitterGraph', () => {
  it("the bolt's EmitterGraphEntityData stands in by its folder's nearest document; a graph with none is missing", () => {
    const g = impact.emitters[4];
    expect(g).toMatchObject({ graph: true, graphOf: 'FX/impacts/Blaster/Generic/Emitters/EG_CheapImpact' });
    expect(impact.graph).toBe(true);
    expect(impact.missing).toEqual(['FX/Tech/Sparks_Walrus/Emitters/EG_Sparks_Default_Walrus', 'FX/Tech/Pebbles_Walrus/Emitters/EG_Pebbles_Default_Walrus_Snow']);
  });
  it('is replaced by the nearest document of its family, said as graph: true', () => {
    const graph = 'fx/impacts/blaster/snow/emitters/eg_impact_blaster_snow_smokespikes_big';
    const idx = new Map([...index, [graph, { name: graph, type: 'EmitterGraph', path: 'x' }]]);
    expect(nearestDocument(idx, graph).name).toBe('fx/impacts/blaster/snow/emitters/em_impact_blaster_snow_smokespikes');
    const bp = { root: 0, objects: [{ $type: 'EffectBlueprint', Name: 'FX/X/FX_Graph', Object: { $ref: 1 } }, { $type: 'EffectEntityData', Components: [{ $ref: 2 }] }, { $type: 'EmitterEntityData', Emitter: { $asset: graph } }] };
    const fx = effectJson(bp, new Map([...docs, [graph, { type: 'EmitterGraph', root: 0, objects: [{ $type: 'EmitterGraph' }] }]]), idx);
    expect(fx.graph).toBe(true);
    expect(fx.emitters[0]).toMatchObject({ graph: true, graphOf: graph, name: 'fx/impacts/blaster/snow/emitters/em_impact_blaster_snow_smokespikes' });
  });
  it('an emitter not found is listed as missing', () => {
    const bp = { root: 0, objects: [{ $type: 'EffectBlueprint', Name: 'FX/X/FX_Gone', Object: { $ref: 1 } }, { $type: 'EffectEntityData', Components: [{ $ref: 2 }] }, { $type: 'EmitterEntityData', Emitter: { $asset: 'fx/x/emitters/em_gone' } }] };
    expect(effectJson(bp, new Map(), index)).toMatchObject({ missing: ['fx/x/emitters/em_gone'], emitters: [] });
  });
});

describe('sheets', () => {
  it('finds a texture’s master first, then its KTX2', () => {
    expect(sheetSources('FX/Textures/Snow/T_Snow_Mist_4x2_D')).toEqual(['web/textures/fx/textures/snow/t_snow_mist_4x2_d.png', 'web_opt/textures/fx/textures/snow/t_snow_mist_4x2_d.ktx2', 'web/textures/fx/textures/snow/t_snow_mist_4x2_d.ktx2']);
  });
  it('writes 512, 1024, 2048, none above the source', () => {
    expect(sheetSizes(4096)).toEqual([512, 1024, 2048]);
    expect(sheetSizes(1024)).toEqual([512, 1024]);
    expect(sheetSizes(256)).toEqual([256]);
  });
});
