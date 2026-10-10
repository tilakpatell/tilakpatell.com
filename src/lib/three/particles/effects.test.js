import { describe, expect, it } from 'vitest';
import SNOW from '../../../data/bf2017/fx/FX_Snow_FallingSnow_01_Hoth.json';
import IMPACT from '../../../data/bf2017/fx/FX_Impact_Blaster_Snow.json';
import EXHAUST from '../../../data/bf2017/fx/FX_EngineExhaust_TransportGR75_Prim.json';
import CEILING from '../../../data/bf2017/fx/FX_Arctic_Ceiling_FallingSnow.json';
import { chooseRunning, createEffects, cullFor, oneShotLength, poolSize, variantFor } from './effects.js';
import { MAX_OWNERS } from './emitter.js';
import { SET_CAP, setWeight, sheetFile, sizeFor } from './sheets.js';

// the game's tables (scripts/bf2017-emitters.mjs over the bf2017-assets bucket)
const defs = { [SNOW.name]: SNOW, [IMPACT.name]: IMPACT, [EXHAUST.name]: EXHAUST, [CEILING.name]: CEILING };
const fakeScene = () => {
  const kids = [];
  return { kids, add: (m) => kids.push(m) };
};
const camera = (x = 0, y = 0, z = 0) => ({ position: { x, y, z } });

describe('the variant and the pools', () => {
  it('takes the tier’s variant: the bolt draws one emitter fewer on low', () => {
    expect(variantFor(IMPACT, 'low').emitters).toHaveLength(IMPACT.variants.low.emitters.length);
    expect(variantFor(IMPACT, 'low').emitters.length).toBe(variantFor(IMPACT, 'high').emitters.length - 1);
    expect(variantFor(SNOW, 'ultra').emitters).not.toEqual(variantFor(SNOW, 'high').emitters);
  });
  it('sizes a pool MaxCount × MaxActiveInstanceCount (held to the owners the GPU takes)', () => {
    const powder = SNOW.emitters.find((e) => e.name.includes('powder'));
    expect(poolSize(powder, SNOW, variantFor(SNOW, 'high'))).toBe(31 * MAX_OWNERS);
    expect(poolSize(EXHAUST.emitters[0], EXHAUST, variantFor(EXHAUST, 'high'))).toBe(16 * 30);
  });
  it('the tier’s cull distance; none is no cull', () => {
    expect(cullFor(SNOW, variantFor(SNOW, 'high'))).toBe(50);
    expect(cullFor(EXHAUST, variantFor(EXHAUST, 'high'))).toBe(Infinity);
  });
  it('a one-shot lasts its spawning and its longest life; a loop for ever', () => {
    expect(Number.isFinite(oneShotLength(IMPACT))).toBe(true);
    expect(oneShotLength(IMPACT)).toBeGreaterThan(1);
    expect(oneShotLength(EXHAUST)).toBe(Infinity);
  });
});

describe('chooseRunning', () => {
  const at = (x, d = Math.abs(x)) => ({ x, y: 0, z: 0, d });
  it('nearest first, within the cull, at most maxActive', () => {
    const list = [at(50), at(5), at(200), at(20)];
    const out = [];
    const m = chooseRunning(list, 4, { cull: 120, maxActive: 2 }, out, new Int32Array(8));
    expect(out.slice(0, m).map((i) => i.x)).toEqual([5, 20]);
  });
  it('no more than MaxNearbyInstanceCount within NearbyRadius of one another', () => {
    const list = Array.from({ length: 90 }, (_, i) => at(i * 0.1));
    const out = [];
    expect(chooseRunning(list, 90, { cull: 120, maxActive: 24, nearby: { radius: 20, max: 6 } }, out, new Int32Array(128))).toBe(6);
    // (greedy, nearest first: a second cluster past the radius runs too)
    const two = [...list, ...Array.from({ length: 10 }, (_, i) => at(60 + i))];
    expect(chooseRunning(two, 100, { cull: 120, maxActive: 24, nearby: { radius: 20, max: 6 } }, out, new Int32Array(128))).toBe(12);
  });
});

describe('createEffects', () => {
  it('one draw per emitter of a kind, however many instances', async () => {
    const scene = fakeScene();
    const fx = createEffects(scene, null, { tier: 'ultra', defs });
    for (let i = 0; i < 10; i++) fx.spawn(EXHAUST.name, [i * 3, 5, 0]);
    await fx.ready(EXHAUST.name);
    expect(scene.kids).toHaveLength(3);
    expect(scene.kids[0].count).toBe(16 * 30);
    fx.update(1 / 60, camera());
    expect(fx.stats).toMatchObject({ kinds: 1, instances: 10, running: 10, drawn: 3 });
    expect(scene.kids.every((m) => m.visible)).toBe(true);
  });
  it("a bolt's NearbyRadius 5 keeps 20 hits in one place to MaxNearbyInstanceCount 5", async () => {
    const fx = createEffects(fakeScene(), null, { tier: 'high', defs });
    for (let i = 0; i < 20; i++) fx.spawn(IMPACT.name, [i * 0.1, 0, 0]);
    await fx.ready(IMPACT.name);
    fx.update(1 / 60, camera(0, 2, 5));
    expect(IMPACT.nearby).toEqual({ radius: 5, max: 5 });
    expect(fx.stats.running).toBe(5);
  });
  it('past the CullDistance nothing is stepped or drawn', async () => {
    const scene = fakeScene();
    const fx = createEffects(scene, null, { tier: 'high', defs });
    fx.spawn(SNOW.name, [0, 0, 0]);
    await fx.ready(SNOW.name);
    fx.update(1 / 60, camera(0, 0, 51));
    expect(fx.stats).toMatchObject({ running: 0, beyond: 1, culled: 1, drawn: 0 });
    expect(scene.kids.every((m) => !m.visible)).toBe(true);
    fx.update(1 / 60, camera(0, 0, 49));
    expect(fx.stats).toMatchObject({ running: 1, beyond: 0 });
  });
  it('the tier picks the meshes: low draws the variant’s emitters only', async () => {
    const low = fakeScene();
    const high = fakeScene();
    const a = createEffects(low, null, { tier: 'low', defs });
    const b = createEffects(high, null, { tier: 'high', defs });
    a.spawn(IMPACT.name);
    b.spawn(IMPACT.name);
    await Promise.all([a.ready(IMPACT.name), b.ready(IMPACT.name)]);
    expect(low.kids).toHaveLength(IMPACT.variants.low.emitters.length);
    expect(high.kids).toHaveLength(IMPACT.variants.high.emitters.length);
  });
  it('autoStart false waits for start(); a one-shot ends by itself', async () => {
    const fx = createEffects(fakeScene(), null, { tier: 'high', defs });
    const h = fx.spawn(IMPACT.name, [0, 0, 0], undefined, 1, { autoStart: false });
    await fx.ready(IMPACT.name);
    fx.update(1 / 60, camera(1, 1, 1));
    expect(fx.stats.running).toBe(0);
    h.start();
    fx.update(1 / 60, camera(1, 1, 1));
    expect(fx.stats.running).toBe(1);
    for (let i = 0; i < 60 * Math.ceil(oneShotLength(IMPACT) + 1); i++) fx.update(1 / 60, camera(1, 1, 1));
    expect(fx.stats.instances).toBe(0);
  });
  it('a name it has no table for does nothing', async () => {
    const fx = createEffects(fakeScene(), null, { defs });
    const h = fx.spawn('FX_Nothing');
    await fx.ready('FX_Nothing');
    expect(fx.stats.unknown).toBe(1);
    expect(() => h.start()).not.toThrow();
  });
  it('places a level’s cells as effects.json gives them, autoStart as the export says', async () => {
    const fx = createEffects(fakeScene(), null, { defs });
    const level = fx.place({ cells: { '0,-2': [{ name: SNOW.name, pos: [61.45, 12.06, -221.94], quat: [0, 0, 0, 1], autoStart: true }, { name: CEILING.name, pos: [4.09, 0.53, -37.99], quat: [0, 1, 0, 0], autoStart: false }] } });
    level.enter('0,-2');
    await Promise.all([fx.ready(SNOW.name), fx.ready(CEILING.name)]);
    fx.update(1 / 60, camera(60, 12, -220));
    expect(fx.stats.instances).toBe(2);
    expect(fx.stats.running).toBe(1);
    level.leave('0,-2');
    fx.update(1 / 60, camera());
    expect(fx.stats.instances).toBe(0);
  });
});

describe('sheets', () => {
  const manifest = { sheets: { 'FX/Textures/Snow/T_Snow_Mist_4x2_D': { sizes: [512, 1024, 2048], bytes: { 512: 40000, 1024: 120000, 2048: 250000 } }, 'FX/A': { sizes: [512], bytes: { 512: 9000 } } } };
  it('the tier’s width, or the largest under it', () => {
    expect(sizeFor(manifest.sheets['FX/Textures/Snow/T_Snow_Mist_4x2_D'], 'ultra')).toBe(2048);
    expect(sizeFor(manifest.sheets['FX/Textures/Snow/T_Snow_Mist_4x2_D'], 'low')).toBe(512);
    expect(sizeFor(manifest.sheets['FX/A'], 'ultra')).toBe(512);
    expect(sheetFile('FX/Textures/Snow/T_Snow_Mist_4x2_D', 1024)).toBe('t_snow_mist_4x2_d.1024.webp');
  });
  it('weighs a level’s set and names what is missing', () => {
    expect(setWeight(manifest, ['FX/Textures/Snow/T_Snow_Mist_4x2_D', 'FX/A', 'FX/B'], 'high')).toEqual({ bytes: 129000, missing: ['FX/B'] });
    expect(SET_CAP).toBe(6 * 1024 * 1024);
  });
});
