import { describe, expect, it } from 'vitest';
import SNOW from '../../../data/bf2017/fx/FX_Snow_FallingSnow_01_Hoth.json';
import IMPACT from '../../../data/bf2017/fx/FX_Impact_Blaster_Snow_01.json';
import EXHAUST from '../../../data/bf2017/fx/FX_Veh_GR75_Engine_Exhaust_01.json';
import { chooseRunning, createEffects, oneShotLength, poolSize, variantFor } from './effects.js';
import { SET_CAP, setWeight, sheetFile, sizeFor } from './sheets.js';

const defs = { [SNOW.name]: SNOW, [IMPACT.name]: IMPACT, [EXHAUST.name]: EXHAUST };
const fakeScene = () => {
  const kids = [];
  return { kids, add: (m) => kids.push(m) };
};
const camera = (x = 0, y = 0, z = 0) => ({ position: { x, y, z } });

describe('the variant and the pools', () => {
  it('takes the blueprint’s variant by tier', () => {
    expect(variantFor(SNOW, 'ultra').emitters).toEqual([0, 1]);
    expect(variantFor(SNOW, 'mid').emitters).toEqual([0]);
    expect(variantFor(EXHAUST, 'low').scale).toBe(0.25);
  });
  it('sizes a pool MaxCount × scale × MaxActiveInstanceCount', () => {
    expect(poolSize(SNOW.emitters[0], SNOW, variantFor(SNOW, 'ultra'))).toBe(400 * 24);
    expect(poolSize(SNOW.emitters[0], SNOW, variantFor(SNOW, 'low'))).toBe(100 * 24);
    expect(poolSize(EXHAUST.emitters[0], EXHAUST, variantFor(EXHAUST, 'high'))).toBe(18 * 16);
  });
  it('a one-shot lasts its spawning and its longest life', () => {
    expect(oneShotLength(IMPACT)).toBeCloseTo(0.1 + 2.5, 6);
    expect(oneShotLength(SNOW)).toBe(Infinity);
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
    expect(out.slice(0, 6).map((i) => i.x)).toEqual([0, 0.1, 0.2, expect.closeTo(0.3, 6), 0.4, 0.5]);
    // (greedy, nearest first: a second cluster past the radius runs too)
    const two = [...list, ...Array.from({ length: 10 }, (_, i) => at(60 + i))];
    expect(chooseRunning(two, 100, { cull: 120, maxActive: 24, nearby: { radius: 20, max: 6 } }, out, new Int32Array(128))).toBe(12);
  });
});

describe('createEffects', () => {
  it('one draw per emitter of a kind, however many instances', async () => {
    const scene = fakeScene();
    const fx = createEffects(scene, null, { tier: 'ultra', defs });
    for (let i = 0; i < 10; i++) fx.spawn(SNOW.name, [i, 5, 0]);
    await fx.ready(SNOW.name);
    expect(scene.kids).toHaveLength(2);
    expect(scene.kids[0].count).toBe(400 * 24);
    fx.update(1 / 60, camera());
    expect(fx.stats).toMatchObject({ kinds: 1, instances: 10, running: 6, drawn: 2 });
    expect(scene.kids.every((m) => m.visible)).toBe(true);
  });
  it('the 90 ceiling snows of the hangar run as the nearby cap allows', async () => {
    const fx = createEffects(fakeScene(), null, { tier: 'high', defs });
    for (let i = 0; i < 90; i++) fx.spawn(SNOW.name, [(i % 10) * 2, 12, Math.floor(i / 10) * 2]);
    await fx.ready(SNOW.name);
    fx.update(1 / 60, camera(5, 2, 5));
    expect(fx.stats.running).toBe(6);
  });
  it('past the CullDistance nothing is stepped or drawn', async () => {
    const scene = fakeScene();
    const fx = createEffects(scene, null, { tier: 'high', defs });
    fx.spawn(SNOW.name, [0, 0, 0]);
    await fx.ready(SNOW.name);
    fx.update(1 / 60, camera(0, 0, 500));
    expect(fx.stats).toMatchObject({ running: 0, beyond: 1, culled: 1, drawn: 0 });
    expect(scene.kids.every((m) => !m.visible)).toBe(true);
  });
  it('the mid tier takes the Medium variant: one emitter, a quarter… of the pool', async () => {
    const scene = fakeScene();
    const fx = createEffects(scene, null, { tier: 'mid', defs });
    fx.spawn(SNOW.name);
    await fx.ready(SNOW.name);
    expect(scene.kids).toHaveLength(1);
    expect(scene.kids[0].count).toBe(200 * 24);
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
    for (let i = 0; i < 200; i++) fx.update(1 / 60, camera(1, 1, 1));
    expect(fx.stats.instances).toBe(0);
  });
  it('a name it has no table for does nothing', async () => {
    const fx = createEffects(fakeScene(), null, { defs });
    const h = fx.spawn('FX_Nothing');
    await fx.ready('FX_Nothing');
    expect(fx.stats.unknown).toBe(1);
    expect(() => h.start()).not.toThrow();
  });
  it('places a level’s cells and kills them as they leave', async () => {
    const fx = createEffects(fakeScene(), null, { defs });
    const level = fx.place({ cells: { '0,0': [{ name: SNOW.name, pos: [1, 10, 1] }, { name: IMPACT.name, pos: [2, 0, 2], autoStart: false }] } });
    level.enter('0,0');
    await Promise.all([fx.ready(SNOW.name), fx.ready(IMPACT.name)]);
    fx.update(1 / 60, camera());
    expect(fx.stats.instances).toBe(2);
    expect(fx.stats.running).toBe(1);
    level.leave('0,0');
    fx.update(1 / 60, camera());
    expect(fx.stats.instances).toBe(0);
  });
});

describe('sheets', () => {
  const manifest = { sheets: { 'FX/Textures/Snow/T_SnowFlake_4x1_01_D': { sizes: [512, 1024, 2048], bytes: { 512: 40000, 1024: 120000, 2048: 250000 } }, 'FX/A': { sizes: [512], bytes: { 512: 9000 } } } };
  it('the tier’s width, or the largest under it', () => {
    expect(sizeFor(manifest.sheets['FX/Textures/Snow/T_SnowFlake_4x1_01_D'], 'ultra')).toBe(2048);
    expect(sizeFor(manifest.sheets['FX/Textures/Snow/T_SnowFlake_4x1_01_D'], 'low')).toBe(512);
    expect(sizeFor(manifest.sheets['FX/A'], 'ultra')).toBe(512);
    expect(sheetFile('FX/Textures/Snow/T_SnowFlake_4x1_01_D', 1024)).toBe('t_snowflake_4x1_01_d.1024.webp');
  });
  it('weighs a level’s set and names what is missing', () => {
    expect(setWeight(manifest, ['FX/Textures/Snow/T_SnowFlake_4x1_01_D', 'FX/A', 'FX/B'], 'high')).toEqual({ bytes: 129000, missing: ['FX/B'] });
    expect(SET_CAP).toBe(6 * 1024 * 1024);
  });
});
