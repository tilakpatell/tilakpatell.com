import { describe, expect, it } from 'vitest';
import SNOW from '../../../data/bf2017/fx/FX_Snow_FallingSnow_01_Hoth.json';
import IMPACT from '../../../data/bf2017/fx/FX_Impact_Blaster_Snow.json';
import EXHAUST from '../../../data/bf2017/fx/FX_EngineExhaust_TransportGR75_Prim.json';
import { evalCurve, pcg, rnd } from './curves.js';
import { aliveCount, createPool, MAX_OWNERS, OWNER, spawnCount, spawnFactor, stepPool, stretchLength, wrapLight } from './emitter.js';

// the game's tables (scripts/bf2017-emitters.mjs over the bf2017-assets bucket)
const em = (fx, part) => fx.emitters.find((e) => e.name.includes(part));
const powder = em(SNOW, 'powder');
const thin = em(SNOW, 'dust_thin');
const burn = em(EXHAUST, 'burn');
const glow = em(EXHAUST, 'prim_glow');
const sparks = em(IMPACT, 'sparksflash');
const plume = em(IMPACT, 'plume');

const owners = (list = [{ pos: [0, 0, 0] }]) => {
  const a = new Float32Array(MAX_OWNERS * OWNER);
  list.forEach(({ pos = [0, 0, 0], scale = 1, quat = [0, 0, 0, 1], vel = [0, 0, 0], move = [0, 0, 0] }, o) => a.set([...pos, scale, ...quat, ...vel, 0, ...move, 0], o * OWNER));
  return a;
};

describe('curves', () => {
  it("a GR-75 burn's HDR colour over EfNormTime, born hot: scaled, never clamped", () => {
    const at = (t) => burn.color.map((c) => +evalCurve(c, t).toFixed(2));
    expect(at(0)).toEqual([21.39, 98.28, 302.3]);
    expect(at(0.5)).toEqual([12.96, 59.55, 186.72]);
    expect(at(1)).toEqual([4.53, 20.82, 71.14]);
  });
  it("the hangar powder's colour as stored, 12.7", () => {
    expect(powder.color.map((c) => +c.toFixed(1))).toEqual([12.7, 12.3, 12.1]);
  });
  it('a table (a spline sampled) read linearly', () => {
    expect(evalCurve({ table: [0, 1, 0] }, 0.25)).toBe(0.5);
    expect(evalCurve({ table: [0, 1, 0] }, 2)).toBe(0);
  });
  it('a random curve is its draw across the range', () => {
    expect(evalCurve({ random: [2, 4] }, 0.3, 0.25)).toBe(2.5);
  });
  it('the hash is PCG in u32, the same integers the TSL twin computes', () => {
    expect(pcg(0)).toBe(129708002);
    expect(pcg(1)).toBe(2831084092);
    expect(pcg(0xffffffff)).toBe(pcg(-1));
    const r = rnd(7, 123, 4);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThan(1);
    expect(r * 16777216).toBe(Math.floor(r * 16777216));
  });
});

describe('the step', () => {
  it('spawns the same particle in the same slot from the same seed', () => {
    const a = createPool(thin, 64, { seed: 9 });
    const b = createPool(thin, 64, { seed: 9 });
    const c = createPool(thin, 64, { seed: 10 });
    const o = owners([{ pos: [3, 8, -2] }]);
    for (const p of [a, b, c]) stepPool(p, 1 / 60, { batches: [{ owner: 0, count: 10 }], owners: o });
    expect(Array.from(a.posAge)).toEqual(Array.from(b.posAge));
    expect(Array.from(a.posAge)).not.toEqual(Array.from(c.posAge));
    expect(aliveCount(a)).toBe(10);
  });
  it('spawns in its box, sized by its draw, and moves along its drawn direction', () => {
    const p = createPool(thin, 32, { seed: 3 });
    stepPool(p, 1 / 60, { batches: [{ owner: 0, count: 32 }], owners: owners([{ pos: [10, 20, 30] }]) });
    for (let i = 0; i < 32; i++) {
      expect(Math.abs(p.posAge[i * 4] - 10)).toBeLessThanOrEqual(0.21);
      expect(Math.abs(p.posAge[i * 4 + 2] - 30)).toBeLessThanOrEqual(0.06);
      expect(p.extra[i * 4]).toBeGreaterThanOrEqual(0.7);
      expect(p.extra[i * 4]).toBeLessThanOrEqual(3.5);
      // (straight down at 3 to 5 m/s, times a speed of 1 to 2)
      expect(p.velLife[i * 4 + 1]).toBeLessThanOrEqual(-3);
      expect(p.velLife[i * 4 + 1]).toBeGreaterThanOrEqual(-10);
    }
  });
  it('falls under its gravity', () => {
    const p = createPool(powder, 8, { seed: 1 });
    const o = owners();
    stepPool(p, 1 / 60, { batches: [{ owner: 0, count: 1 }], owners: o });
    const v0 = p.velLife[1];
    for (let k = 0; k < 30; k++) stepPool(p, 1 / 60, { owners: o });
    expect(p.velLife[1] - v0).toBeLessThan(-0.5 * 9.8 * 0.8 + 0.1);
  });
  it('the wind carries a particle by its multiplier and drag', () => {
    const p = createPool(plume, 4, { seed: 1 });
    const o = owners();
    stepPool(p, 1 / 60, { batches: [{ owner: 0, count: 1 }], owners: o });
    const x0 = p.posAge[0];
    for (let k = 0; k < 60; k++) stepPool(p, 1 / 60, { owners: o, wind: [10, 0, 0] });
    // (dragged at 2 towards a tenth of a 10 m/s wind: about 1 m/s by the end)
    expect(p.posAge[0] - x0).toBeGreaterThan(0.4);
    expect(p.posAge[0] - x0).toBeLessThan(1.1);
  });
  it('a following emitter moves with its owner; following its velocity takes it', () => {
    const p = createPool(glow, 8, { seed: 1 });
    stepPool(p, 1 / 60, { batches: [{ owner: 0, count: 1 }], owners: owners() });
    const z = p.posAge[2];
    stepPool(p, 1 / 60, { owners: owners([{ move: [0, 0, 2] }]) });
    expect(p.posAge[2] - z).toBeCloseTo(2, 5);
    const q = createPool({ ...glow, follow: { source: false, velocity: true } }, 8, { seed: 1 });
    stepPool(q, 1 / 60, { batches: [{ owner: 0, count: 1 }], owners: owners([{ vel: [0, 0, 50] }]) });
    expect(q.velLife[2]).toBe(50);
  });
  it('the emitter’s offset in its effect, turned with its owner', () => {
    const p = createPool(burn, 4, { seed: 1 });
    stepPool(p, 1 / 60, { batches: [{ owner: 0, count: 1 }], owners: owners([{ pos: [5, 0, 0], quat: [0, 0.7071068, 0, 0.7071068] }]) });
    // (0, 0, −0.876) turned a quarter about +Y is (−0.876, 0, 0); then 10 m/s up for a frame
    expect(p.posAge[0]).toBeCloseTo(5 - 0.8758, 3);
    expect(p.posAge[2]).toBeCloseTo(0, 3);
  });
  it('the ring walks round and the batches past the pool are dropped', () => {
    const p = createPool(thin, 8, { seed: 1 });
    const o = owners([{}, { pos: [100, 0, 0] }]);
    expect(stepPool(p, 0.01, { batches: [{ owner: 0, count: 5 }, { owner: 1, count: 5 }], owners: o })).toBe(8);
    expect(p.head).toBe(0);
    expect(p.serial).toBe(8);
    expect(p.extra[5 * 4 + 3]).toBe(1);
    expect(p.posAge[5 * 4]).toBeGreaterThan(90);
  });
  it('a particle dies at its lifetime', () => {
    const p = createPool(sparks, 10, { seed: 2 });
    stepPool(p, 1 / 60, { batches: [{ owner: 0, count: 10 }], owners: owners() });
    expect(aliveCount(p)).toBe(10);
    for (let k = 0; k < 12; k++) stepPool(p, 1 / 60, { owners: owners() });
    expect(aliveCount(p)).toBe(0);
  });
});

describe('spawnCount', () => {
  it('a one-shot spawns its MaxCount over its duration, then nothing', () => {
    const s = { t: 0, acc: 0, burst: false };
    let n = 0;
    for (let k = 0; k < 120; k++) n += spawnCount(s, sparks, 1 / 120);
    expect(n).toBe(10);
  });
  it('a loop at its rate, scaled by the tier, holding MaxCount alive', () => {
    const s = { t: 0, acc: 0, burst: false };
    let n = 0;
    for (let k = 0; k < 600; k++) n += spawnCount(s, burn, 1 / 60);
    // (100 a second, held to 16 alive over a life of 0.15 s: 100 a second)
    expect(n).toBeGreaterThanOrEqual(999);
    expect(n).toBeLessThanOrEqual(1001);
    const half = { t: 0, acc: 0, burst: false };
    let m = 0;
    for (let k = 0; k < 600; k++) m += spawnCount(half, burn, 1 / 60, { scale: 0.5 });
    expect(m).toBeCloseTo(500, -1);
    const cap = { ...burn, maxCount: 6 };
    const c = { t: 0, acc: 0, burst: false };
    let k2 = 0;
    for (let k = 0; k < 600; k++) k2 += spawnCount(c, cap, 1 / 60);
    expect(k2).toBeLessThanOrEqual(401);
  });
});

describe('culling by distance', () => {
  it('the powder: full to 0.8 of MaxSpawnDistance 55, thinning to nothing at it', () => {
    expect(powder).toMatchObject({ maxSpawnDistance: 55, cullingFactor: 0.8 });
    expect(spawnFactor(10, powder)).toBe(1);
    expect(spawnFactor(44, powder)).toBe(1);
    expect(spawnFactor(49.5, powder)).toBeCloseTo(0.5, 6);
    expect(spawnFactor(55, powder)).toBe(0);
    expect(spawnFactor(500, burn)).toBe(1);
  });
});

describe('MotionStretchScreen', () => {
  const s = powder.stretch;
  it('stretched by the multiplier over the speed normalisation, clamped', () => {
    expect(s).toEqual({ mult: 10, norm: 50, min: 1, max: 100 });
    expect(stretchLength(0.04, 0, s)).toBe(0.04);
    expect(stretchLength(0.04, 5, s)).toBeCloseTo(0.08, 6);
    expect(stretchLength(0.04, 1000, s)).toBeCloseTo(4, 6);
    expect(stretchLength(0.04, 50, null)).toBe(0.04);
  });
});

describe('light wrap', () => {
  it('wraps n·l by LightWrapAroundFactor', () => {
    expect(wrapLight(1, 0.5)).toBe(1);
    expect(wrapLight(0, 0.5)).toBeCloseTo(1 / 3, 6);
    expect(wrapLight(-0.5, 0.5)).toBe(0);
    expect(wrapLight(-0.2, 0)).toBe(0);
  });
});
