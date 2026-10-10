import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { evalCurve } from '../../src/lib/three/particles/curves.js';
import { curveOf, effectJson, sheetSizes, sheetSources, emitterRefs, nearestDocument, rawReport, readEmitter, readIndex, readVariants } from './bf2017-emitters.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/bf2017/fx/web');
const index = readIndex(readFileSync(join(ROOT, 'data.tsv'), 'utf8'));
const load = (name) => JSON.parse(readFileSync(join(ROOT, index.get(name.toLowerCase()).path), 'utf8'));
const docs = new Map([...index.values()].filter((r) => r.type !== 'EffectBlueprint').map((r) => [r.name.toLowerCase(), load(r.name)]));
const SNOW = 'FX/Ambient/Snow/FX_Snow_FallingSnow_01_Hoth';
const snow = effectJson(load(SNOW), docs, index);
const exhaust = effectJson(load('FX/Vehicles/GR75/FX_Veh_GR75_Engine_Exhaust_01'), docs, index);
const impact = effectJson(load('FX/Impacts/Blaster/FX_Impact_Blaster_Snow_01'), docs, index);

describe('curves', () => {
  it('reads a PolynomialData as its cubic and scale, a RandomEvaluatorData as its range', () => {
    expect(curveOf({ $type: 'PolynomialData', Coefficients: { x: 1, y: 2, z: 3, w: 4 }, ScaleValue: 0.5 })).toEqual({ poly: [1, 2, 3, 4], scale: 0.5 });
    expect(curveOf({ $type: 'RandomEvaluatorData', Min: 0.2, Max: 0.6 })).toEqual({ random: [0.2, 0.6] });
    expect(curveOf(40)).toBe(40);
    expect(curveOf({ $type: 'Something' })).toBeNull();
  });
});

describe('the template', () => {
  const e = snow.emitters[0];
  it('keeps the template fields as stored', () => {
    expect(e).toMatchObject({ kind: 'quad', maxCount: 400, lifetime: 6, alignment: 'motionStretchScreen', lightWrap: 0.5, maxSpawnDistance: 55, cullingFactor: 0.8, additive: false });
    expect(e.stretch).toEqual({ mult: 0.06, min: 1, max: 6 });
    expect(e.texture).toBe('FX/Textures/Snow/T_SnowFlake_4x1_01_D');
    expect(e.uv).toMatchObject({ frames: 4, grid: [4, 1], randomStart: true });
  });
  it('says where every leaf came from', () => {
    expect(e._source.maxCount).toBe('FX/Ambient/Snow/Emitters/em_Snow_FallingSnow_01_Hoth#EmitterTemplateData.MaxCount');
    expect(e._source['stretch.mult']).toMatch(/#EmitterTemplateData\.MotionStretchMultiplier$/);
    expect(e._source['gravity.g']).toMatch(/#GravityData\.Gravity$/);
    expect(e._source.color).toMatch(/#UpdateColorData\.Color$/);
    expect(snow._source.cull).toBe(`${SNOW}#EffectBlueprint.CullDistance`);
  });
  it('keeps what it does not understand under raw', () => {
    expect(e.raw.EmitterTemplateData).toEqual({ SortPriority: 2 });
    expect(snow.emitters[1].raw.TurbulenceData).toEqual({ Strength: 0.4, Frequency: 0.2 });
    expect(snow.raw).toEqual({ SoundOnStart: 'Sound/Ambient/Wind_Indoor_01' });
    expect(rawReport([snow])).toMatchObject({ 'EmitterTemplateData.SortPriority': ['FX_Snow_FallingSnow_01_Hoth'], 'TurbulenceData.Strength': ['FX_Snow_FallingSnow_01_Hoth'] });
  });
});

describe('the spawn block and the forces', () => {
  it('reads rate, box, size, speed, direction, gravity and drag', () => {
    const e = snow.emitters[0];
    expect(e.spawn).toEqual({ rate: { poly: [60, 0, 0, 0], scale: 1 }, burst: 0, size: { random: [0.025, 0.05] }, speed: { random: [0.2, 0.6] }, direction: { dir: [0, -1, 0], spread: 25 }, position: { box: { center: [0, 0, 0], size: [12, 0.5, 12] } } });
    expect(e.gravity).toEqual({ g: 9.8, random: 0.3 });
    expect(e.drag).toBe(2.2);
  });
  it('reads a burst and a sphere', () => {
    const sparks = impact.emitters[0];
    expect(sparks.spawn).toMatchObject({ rate: 0, burst: 24, position: { sphere: { radius: 0.05 } } });
    expect(sparks).toMatchObject({ loop: false, duration: 0.1, additive: true, lifetime: { random: [0.3, 0.7] } });
  });
});

describe('the curves over EfNormTime', () => {
  it("the powder's HDR colour at 0, 0.5 and 1: scaled, not clamped", () => {
    const [r, , b] = snow.emitters[1].color;
    expect([0, 0.5, 1].map((t) => evalCurve(r, t))).toEqual([12.7, expect.closeTo(8.89, 6), expect.closeTo(5.08, 6)]);
    expect([0, 0.5, 1].map((t) => evalCurve(b, t))).toEqual([12.7, expect.closeTo(9.525, 6), expect.closeTo(6.35, 6)]);
  });
  it('size, rotation and alpha', () => {
    const p = snow.emitters[1];
    expect(evalCurve(p.size, 1)).toBeCloseTo(1.8, 6);
    expect(evalCurve(p.rotation, 0.5)).toBe(20);
    expect(p.alpha.exponent).toBe(2);
    expect(evalCurve(p.alpha.curve, 0.5)).toBeCloseTo(0.08, 6);
    expect(p.lifetime).toEqual({ random: [3, 5] });
    expect(p.soft).toBe(0.8);
  });
});

describe('the variants', () => {
  it('takes the blueprint’s variants by tier', () => {
    expect(snow.variants.ultra).toEqual({ emitters: [0, 1], scale: 1, from: 'Ultra' });
    expect(snow.variants.mid).toEqual({ emitters: [0], scale: 0.5, from: 'Medium' });
    expect(snow.variants.low).toEqual({ emitters: [0], scale: 0.25, from: 'Low' });
    expect(snow._source['variants.high']).toBe(`${SNOW}#EffectBlueprint.High`);
  });
  it('scales MaxCount by 1, 0.75, 0.5, 0.25 without them', () => {
    expect(Object.fromEntries(Object.entries(exhaust.variants).map(([t, v]) => [t, v.scale]))).toEqual({ low: 0.25, mid: 0.5, high: 0.75, ultra: 1 });
    expect(exhaust.variants.low.emitters).toEqual([0, 1]);
  });
  it('a variant given as a number is a scale', () => {
    expect(readVariants({ Low: 0.3 }, ['a']).low).toEqual({ emitters: [0], scale: 0.3, from: 'Low' });
  });
});

describe('the blueprint', () => {
  it('reads cull, caps and nearby', () => {
    expect(snow).toMatchObject({ name: 'FX_Snow_FallingSnow_01_Hoth', cull: 120, maxActive: 24, probability: 1, nearby: { radius: 20, max: 6 }, autoStart: true, graph: false, missing: [] });
    expect(impact.autoStart).toBe(false);
  });
  it('lists the textures once', () => {
    expect(snow.textures).toEqual(['FX/Textures/Snow/T_SnowFlake_4x1_01_D', 'FX/Textures/Smoke/T_ThinPuff_Gnomon_4x32_NoAtlas_01_D']);
    expect(impact.textures).toHaveLength(3);
  });
  it('finds the emitters in the entity and the variants, once each', () => {
    expect(emitterRefs(load(SNOW))).toEqual(['FX/Ambient/Snow/Emitters/em_Snow_FallingSnow_01_Hoth', 'FX/Ambient/Snow/Emitters/em_Snow_Powder_01_Hoth']);
  });
  it('reads mesh and ribbon emittables and following', () => {
    expect(exhaust.emitters[0]).toMatchObject({ kind: 'quad', follow: { source: true, velocity: true }, additive: true });
    expect(exhaust.emitters[1]).toMatchObject({ kind: 'ribbon', ribbon: { segment: 2 } });
  });
});

describe('EmitterGraph', () => {
  it('is replaced by the nearest document of its family, said as graph: true', () => {
    expect(nearestDocument(index, 'FX/Impacts/Smoke/Emitters/eg_Impact_Smoke_Big_01').name).toBe('FX/Impacts/Smoke/Emitters/em_Impact_Smoke_01');
    const g = impact.emitters[2];
    expect(g).toMatchObject({ graph: true, graphOf: 'FX/Impacts/Smoke/Emitters/eg_Impact_Smoke_Big_01', name: 'FX/Impacts/Smoke/Emitters/em_Impact_Smoke_01', maxCount: 6 });
    expect(impact.graph).toBe(true);
  });
  it('an emitter not found is listed as missing and dropped', () => {
    const fx = effectJson({ Name: 'FX/X/FX_Gone', Object: { Components: [{ Emitter: 'FX/X/Emitters/em_Gone' }] } }, new Map(), index);
    expect(fx.missing).toEqual(['FX/X/Emitters/em_Gone']);
    expect(fx.emitters).toEqual([]);
    expect(fx.variants.ultra.emitters).toEqual([]);
  });
});

describe('readEmitter', () => {
  it('defaults an empty document', () => {
    const e = readEmitter({ Objects: [] }, 'em_x');
    expect(e).toMatchObject({ name: 'em_x', kind: 'quad', maxCount: null, stretch: null, gravity: null, graph: false });
    expect(e.raw._missing).toEqual(['EmitterTemplateData.MaxCount']);
  });
});

describe('sheets', () => {
  it('finds a texture’s master first, then its KTX2', () => {
    expect(sheetSources('FX/Textures/Snow/T_SnowFlake_4x1_01_D')).toEqual(['web/textures/fx/textures/snow/t_snowflake_4x1_01_d.png', 'web_opt/textures/fx/textures/snow/t_snowflake_4x1_01_d.ktx2', 'web/textures/fx/textures/snow/t_snowflake_4x1_01_d.ktx2']);
  });
  it('writes 512, 1024, 2048, none above the source', () => {
    expect(sheetSizes(4096)).toEqual([512, 1024, 2048]);
    expect(sheetSizes(1024)).toEqual([512, 1024]);
    expect(sheetSizes(256)).toEqual([256]);
  });
});
