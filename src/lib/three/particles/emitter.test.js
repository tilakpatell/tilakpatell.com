import { describe, expect, it } from 'vitest';
import SNOW from '../../../data/bf2017/fx/FX_Snow_FallingSnow_01_Hoth.json';
import IMPACT from '../../../data/bf2017/fx/FX_Impact_Blaster_Snow_01.json';
import EXHAUST from '../../../data/bf2017/fx/FX_Veh_GR75_Engine_Exhaust_01.json';
import { evalCurve, pcg, rnd } from './curves.js';
import { aliveCount, createPool, MAX_OWNERS, OWNER, spawnCount, spawnFactor, stepPool, stretchLength, wrapLight } from './emitter.js';

const owners = (list = [{ pos: [0, 0, 0] }]) => {
  const a = new Float32Array(MAX_OWNERS * OWNER);
  list.forEach(({ pos = [0, 0, 0], scale = 1, quat = [0, 0, 0, 1], vel = [0, 0, 0], move = [0, 0, 0] }, o) => a.set([...pos, scale, ...quat, ...vel, 0, ...move, 0], o * OWNER));
  return a;
};

describe('curves', () => {
  it("the powder's colour over EfNormTime: HDR, scaled not clamped", () => {
    const [r, g, b] = SNOW.emitters[1].color;
    expect([0, 0.5, 1].map((t) => +evalCurve(r, t).toFixed(4))).toEqual([12.7, 8.89, 5.08]);
    expect(+evalCurve(g, 1).toFixed(4)).toBe(5.08);
    expect(+evalCurve(b, 0.5).toFixed(4)).toBe(9.525);
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
  const em = SNOW.emitters[0];
  it('spawns the same particle in the same slot from the same seed', () => {
    const a = createPool(em, 64, { seed: 9 });
    const b = createPool(em, 64, { seed: 9 });
    const c = createPool(em, 64, { seed: 10 });
    const o = owners([{ pos: [3, 8, -2] }]);
    for (const p of [a, b, c]) stepPool(p, 1 / 60, { batches: [{ owner: 0, count: 10 }], owners: o });
    expect(Array.from(a.posAge)).toEqual(Array.from(b.posAge));
    expect(Array.from(a.posAge)).not.toEqual(Array.from(c.posAge));
    expect(aliveCount(a)).toBe(10);
  });
  it('spawns inside the box round its owner and falls', () => {
    const p = createPool(em, 32, { seed: 3 });
    const o = owners([{ pos: [10, 20, 30] }]);
    stepPool(p, 1 / 60, { batches: [{ owner: 0, count: 32 }], owners: o });
    const y0 = p.posAge[1];
    for (let i = 0; i < 32; i++) {
      expect(Math.abs(p.posAge[i * 4] - 10)).toBeLessThanOrEqual(6.1);
      expect(Math.abs(p.posAge[i * 4 + 2] - 30)).toBeLessThanOrEqual(6.1);
      expect(p.extra[i * 4]).toBeGreaterThanOrEqual(0.025);
      expect(p.extra[i * 4]).toBeLessThanOrEqual(0.05);
    }
    for (let k = 0; k < 60; k++) stepPool(p, 1 / 60, { owners: o });
    expect(p.posAge[1]).toBeLessThan(y0 - 1);
    // the drag holds the fall near its terminal speed, g·(1 ± 0.3) / 2.2
    expect(Math.abs(p.velLife[1])).toBeLessThan((9.8 * 1.3) / 2.2 + 0.7);
  });
  it('the wind carries a particle with drag', () => {
    const p = createPool(em, 4, { seed: 1 });
    const o = owners();
    stepPool(p, 1 / 60, { batches: [{ owner: 0, count: 1 }], owners: o });
    const x0 = p.posAge[0];
    for (let k = 0; k < 60; k++) stepPool(p, 1 / 60, { owners: o, wind: [5, 0, 0] });
    expect(p.posAge[0] - x0).toBeGreaterThan(2);
  });
  it('a following emitter moves with its owner and takes its velocity', () => {
    const glow = EXHAUST.emitters[0];
    const p = createPool(glow, 8, { seed: 1 });
    const o = owners([{ pos: [0, 0, 0], vel: [0, 0, 50] }]);
    stepPool(p, 1 / 60, { batches: [{ owner: 0, count: 1 }], owners: o });
    expect(p.velLife[2]).toBeGreaterThan(45);
    const z = p.posAge[2];
    stepPool(p, 1 / 60, { owners: owners([{ move: [0, 0, 2] }]) });
    expect(p.posAge[2] - z).toBeGreaterThan(2);
  });
  it('the ring walks round and the batches past the pool are dropped', () => {
    const p = createPool(em, 8, { seed: 1 });
    const o = owners([{}, { pos: [100, 0, 0] }]);
    expect(stepPool(p, 0.01, { batches: [{ owner: 0, count: 5 }, { owner: 1, count: 5 }], owners: o })).toBe(8);
    expect(p.head).toBe(0);
    expect(p.serial).toBe(8);
    expect(p.extra[5 * 4 + 3]).toBe(1);
    expect(p.posAge[5 * 4]).toBeGreaterThan(90);
  });
  it('a particle dies at its lifetime', () => {
    const p = createPool(IMPACT.emitters[0], 30, { seed: 2 });
    stepPool(p, 1 / 60, { batches: [{ owner: 0, count: 24 }], owners: owners() });
    expect(aliveCount(p)).toBe(24);
    for (let k = 0; k < 50; k++) stepPool(p, 1 / 60, { owners: owners() });
    expect(aliveCount(p)).toBe(0);
  });
});

describe('spawnCount', () => {
  it('a burst once, then nothing past a non-looping emitter’s duration', () => {
    const em = IMPACT.emitters[0];
    const s = { t: 0, acc: 0, burst: false };
    expect(spawnCount(s, em, 1 / 60)).toBe(24);
    let more = 0;
    for (let k = 0; k < 60; k++) more += spawnCount(s, em, 1 / 60);
    expect(more).toBe(0);
  });
  it('the rate, scaled by the tier and held to MaxCount alive', () => {
    const em = SNOW.emitters[0];
    const s = { t: 0, acc: 0, burst: false };
    let n = 0;
    for (let k = 0; k < 600; k++) n += spawnCount(s, em, 1 / 60);
    expect(n).toBeGreaterThanOrEqual(599);
    expect(n).toBeLessThanOrEqual(601);
    const half = { t: 0, acc: 0, burst: false };
    let m = 0;
    for (let k = 0; k < 600; k++) m += spawnCount(half, em, 1 / 60, { scale: 0.5 });
    expect(m).toBeCloseTo(300, -1);
    const cap = { ...em, maxCount: 60 };
    const c = { t: 0, acc: 0, burst: false };
    let k2 = 0;
    for (let k = 0; k < 600; k++) k2 += spawnCount(c, cap, 1 / 60);
    expect(k2).toBeLessThanOrEqual(101);
  });
});

describe('culling by distance', () => {
  const em = SNOW.emitters[0];
  it('full to 0.8 of MaxSpawnDistance 55, thinning to nothing at it', () => {
    expect(spawnFactor(10, em)).toBe(1);
    expect(spawnFactor(44, em)).toBe(1);
    expect(spawnFactor(49.5, em)).toBeCloseTo(0.5, 6);
    expect(spawnFactor(55, em)).toBe(0);
    expect(spawnFactor(500, { maxSpawnDistance: null })).toBe(1);
  });
});

describe('MotionStretchScreen', () => {
  const s = SNOW.emitters[0].stretch;
  it('the size plus the distance moved in the multiplier’s seconds, clamped', () => {
    expect(stretchLength(0.04, 0, s)).toBe(0.04);
    expect(stretchLength(0.04, 2, s)).toBeCloseTo(0.16, 6);
    expect(stretchLength(0.04, 50, s)).toBeCloseTo(0.24, 6);
    expect(stretchLength(0.04, 50, null)).toBe(0.04);
    expect(stretchLength(0.04, 50, { mult: 1, min: 1, max: null })).toBeCloseTo(50.04, 6);
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
