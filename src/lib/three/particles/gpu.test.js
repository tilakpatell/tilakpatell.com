import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import SNOW from '../../../data/bf2017/fx/FX_Snow_FallingSnow_01_Hoth.json';
import { createPool, MAX_BATCHES, MAX_OWNERS, OWNER, stepPool } from './emitter.js';
import { COLLIDE } from './collide.js';
import { depthPlane } from './fixtures/depthPlane.js';
import { createSim, modeFor } from './gpu.js';

// The compute pass itself runs in a browser: scripts/light-fixture.mjs
// --particles steps it 120 frames beside the CPU and reads it back (the
// plan's bar, 1 cm; 0.06 mm measured on two of the game's emitters, the node renderer over WebGL 2).
// Here: the CPU path is emitter.js's step, and the GPU path lays the spawn
// window out as the step does.

const em = SNOW.emitters[0];
const owners = new Float32Array(MAX_OWNERS * OWNER);
owners.set([0, 5, 0, 1, 0, 0, 0, 1], 0);

describe('modeFor', () => {
  it('the GPU on WebGPU, the CPU on the node renderer over WebGL 2', () => {
    expect(modeFor({ isWebGPURenderer: true, backend: {} })).toBe('gpu');
    expect(modeFor({ isWebGPURenderer: true, backend: { isWebGLBackend: true } })).toBe('cpu');
    expect(modeFor(null)).toBe('cpu');
  });
});

describe('the CPU path', () => {
  it('is emitter.js’s step into the instanced attributes', async () => {
    const sim = await createSim(em, 64, { seed: 4, mode: 'cpu' });
    const ref = createPool(em, 64, { seed: 4 });
    const batches = [{ owner: 0, count: 7 }];
    for (let f = 0; f < 30; f++) {
      sim.step(1 / 60, { batches, owners });
      stepPool(ref, 1 / 60, { batches, owners });
    }
    const got = await sim.read();
    expect(Array.from(got.posAge)).toEqual(Array.from(ref.posAge));
    expect(sim.nodes.posAge).toBeTruthy();
  });
});

describe('the GPU path', () => {
  it('one dispatch an emitter a frame, the window laid out as the step lays it', async () => {
    const calls = [];
    const renderer = { isWebGPURenderer: true, backend: {}, compute: (node) => calls.push(node) };
    const sim = await createSim(em, 16, { renderer, seed: 4 });
    expect(sim.mode).toBe('gpu');
    const many = Array.from({ length: MAX_BATCHES + 3 }, (_, i) => ({ owner: i % 2, count: 3 }));
    expect(sim.step(1 / 60, { batches: many, owners })).toBe(16);
    expect(sim.pool.head).toBe(0);
    expect(sim.pool.serial).toBe(16);
    expect(sim.step(1 / 60, { batches: [{ owner: 1, count: 5 }], owners })).toBe(5);
    expect(sim.pool.head).toBe(5);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toBe(calls[1]);
    const ref = createPool(em, 16, { seed: 4 });
    stepPool(ref, 1 / 60, { batches: many, owners });
    stepPool(ref, 1 / 60, { batches: [{ owner: 1, count: 5 }], owners });
    expect([ref.head, ref.serial]).toEqual([sim.pool.head, sim.pool.serial]);
  });
});

// Rubble that falls on a floor (the debris burst's shape): a box 1 m up,
// straight down, under gravity, three seconds' life
const RUBBLE = { spawn: { position: { box: { center: [0, 1, 0], size: [2, 0, 2] } }, direction: { dir: [0, -1, 0], spread: 0 }, speed: 3, size: 0.1 }, lifetime: 3, gravity: { g: 9.8 }, drag: 0 };

describe('the depth collision', () => {
  const run = async (collide) => {
    const sim = await createSim(RUBBLE, 64, { seed: 2, mode: 'cpu', collide: true });
    const view = collide ? depthPlane() : null;
    sim.step(1 / 60, { batches: [{ owner: 0, count: 64 }], owners, collide: view });
    for (let f = 0; f < 60; f++) sim.step(1 / 60, { owners, collide: view });
    const { posAge } = await sim.read();
    return Array.from({ length: 64 }, (_, i) => posAge[i * 4 + 1]);
  };

  it('on the CPU path, rubble lands on the plane and stays on it; without depth it falls through', async () => {
    const landed = await run(true);
    const fell = await run(false);
    expect(Math.min(...landed)).toBeGreaterThan(-COLLIDE.thickness);
    expect(Math.max(...landed)).toBeLessThan(0.5);
    expect(Math.max(...fell)).toBeLessThan(-1);
  });

  it('the kernel’s term compiles to WGSL that reads last frame’s depth with textureLoad', async () => {
    const calls = [];
    const fake = { isWebGPURenderer: true, backend: {}, compute: (node) => calls.push(node) };
    const sim = await createSim(RUBBLE, 16, { renderer: fake, collide: true });
    sim.step(1 / 60, { owners, collide: null });
    const canvas = { style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => null, width: 1, height: 1 };
    const r = new THREE.WebGPURenderer({ canvas });
    // (no device in Node: the builder asks for features and the sample count, and is told none)
    r.hasFeature = () => false;
    r.backend.renderer = r;
    const b = new THREE.WGSLNodeBuilder(null, r);
    b.compute = calls[0];
    b.build();
    expect(b.computeShader).toMatch(/texture_depth_2d/);
    expect(b.computeShader.match(/textureLoad\(/g).length).toBeGreaterThanOrEqual(5);
  });
});
