import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CASCADES, FADE, FRAME_BUDGET, createBudget, createProbes, probeFor, probeIndex, probesPerFrame, recentre, runsOf, scheduleProbes } from './probes';

const hall = { min: [0, 0, 0], max: [40, 10, 40] };
const room = { min: [10, 0, 10], max: [18, 4, 18] };

describe('probeFor', () => {
  it('the smallest volume holding the point, and how far in', () => {
    expect(probeFor([hall, room], [14, 2, 14])).toEqual({ i: 1, blend: 0.5 }); // (2 m under the ceiling)
    expect(probeFor([hall, room], [30, 2, 30]).i).toBe(0);
    expect(probeFor([hall, room], [11, 2, 14]).blend).toBeCloseTo(0.25);
    expect(probeFor([hall, room], [50, 2, 50])).toEqual({ i: -1, blend: 0 });
    expect(probeFor([], [0, 0, 0]).i).toBe(-1);
  });
});

const cube = (name) => Object.assign(new THREE.CubeTexture(), { name });
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('createProbes', () => {
  it('starts on the fallback, crossfades into a volume’s cube over FADE and swaps in place', async () => {
    const scene = { environment: cube('sky'), environmentNode: null };
    const loaded = [];
    const probes = await createProbes(scene, [hall, room], async (v, i) => {
      loaded.push(i);
      return cube(`probe${i}`);
    });
    const node = scene.environmentNode;
    expect(node).not.toBe(null);
    probes.update([14, 2, 14], 0);
    await flush();
    expect(loaded).toEqual([1]);
    expect(probes.current).toBe(1);
    probes.update([14, 2, 14], FADE / 2);
    expect(probes.fade).toBeCloseTo(0.5);
    probes.update([14, 2, 14], FADE);
    expect(probes.fade).toBe(0);
    // (the same node throughout: nothing recompiles)
    expect(scene.environmentNode).toBe(node);
    // back out to the hall, then back in: the room's cube is not loaded twice
    probes.update([30, 2, 30], 0);
    await flush();
    probes.update([14, 2, 14], 0);
    await flush();
    expect(loaded).toEqual([1, 0]);
    await probes.dispose();
    expect(scene.environmentNode).toBe(null);
  });
  it('a quick crossing shows only the last volume asked for', async () => {
    const scene = { environment: null };
    let release;
    const slow = new Promise((r) => (release = r));
    const probes = await createProbes(scene, [hall, room], (v, i) => (i === 0 ? slow : Promise.resolve(cube('room'))));
    probes.update([30, 2, 30], 0);
    probes.update([14, 2, 14], 0);
    await flush();
    release(cube('hall'));
    await flush();
    expect(probes.current).toBe(1);
  });
});


describe('the budgeted grid’s rules (lane N3)', () => {
  it('scheduleProbes: the oldest first, the nearest among equals, n at most', () => {
    const stale = [
      { age: 3, distance: 10 },
      { age: 9, distance: 30 },
      { age: 9, distance: 5 },
      { age: 1, distance: 1 },
    ];
    expect(scheduleProbes(stale, 2)).toEqual([2, 1]);
    expect(scheduleProbes(stale, 9)).toEqual([2, 1, 0, 3]);
    expect(scheduleProbes(stale, 0)).toEqual([]);
    expect(scheduleProbes([], 3)).toEqual([]);
    // (a probe already done this sweep is not stale: age −1 is skipped)
    expect(scheduleProbes([{ age: -1, distance: 0 }, { age: 0, distance: 4 }], 2)).toEqual([1]);
  });
  it('probesPerFrame: halves over the budget, adds one under half of it, holds between; never under one', () => {
    expect(probesPerFrame(0.8, FRAME_BUDGET, 8)).toBe(4);
    expect(probesPerFrame(0.2, FRAME_BUDGET, 8)).toBe(9);
    expect(probesPerFrame(0.4, FRAME_BUDGET, 8)).toBe(8);
    expect(probesPerFrame(5, FRAME_BUDGET, 1)).toBe(1);
    // (no measure yet: hold)
    expect(probesPerFrame(null, FRAME_BUDGET, 3)).toBe(3);
    expect(probesPerFrame(0, FRAME_BUDGET, 3, 4)).toBe(4);
    expect(probesPerFrame(0, FRAME_BUDGET, 4, 4)).toBe(4);
  });
  it('recentre: a cascade re-centred on the player by whole probe spacings (a 9 m move shifts the 8 m cascade by one)', () => {
    expect(recentre([0, 0, 0], 8)).toEqual([0, 0, 0]);
    expect(recentre([9, 0, 0], 8)).toEqual([8, 0, 0]);
    expect(recentre([3.9, 1, -12.1], 8)).toEqual([0, 0, -16]);
    expect(recentre([9, 0, 0], 32)).toEqual([0, 0, 0]);
    expect(recentre([17, 40, 0], 32)).toEqual([32, 32, 0]);
  });
  it('runsOf: a set of probe indices as the contiguous ranges LightProbeGrid bakes', () => {
    expect(runsOf([5, 1, 2, 3, 9])).toEqual([{ start: 1, count: 3 }, { start: 5, count: 1 }, { start: 9, count: 1 }]);
    expect(runsOf([])).toEqual([]);
  });
  it('probeIndex: LightProbeGrid’s order, x then z then y', () => {
    // res [4, 2, 3]: index = x + z·4 + y·4·3
    expect(probeIndex(1, 0, 0, [4, 2, 3])).toBe(1);
    expect(probeIndex(0, 0, 1, [4, 2, 3])).toBe(4);
    expect(probeIndex(0, 1, 0, [4, 2, 3])).toBe(12);
    expect(probeIndex(3, 1, 2, [4, 2, 3])).toBe(23);
  });
  it('the cascades’ spacings and the budget are the design’s', () => {
    expect(CASCADES).toEqual([8, 32]);
    expect(FRAME_BUDGET).toBe(0.5);
  });
});

describe('createBudget against lane G1’s GPU clock (a test double of its face)', () => {
  const clock = () => ({ available: true, last: 10, median: 10, p95: 11, frame() {} });
  it('idle frames set the base; a frame that drew costs its time over it; over budget halves, under half adds one', () => {
    const gpuTime = clock();
    const b = createBudget({ gpuTime, first: 8 });
    for (let i = 0; i < 5; i++) b.after(0, 0);
    expect(b.base).toBe(10);
    expect(b.n).toBe(8);
    gpuTime.last = 10.8;
    expect(b.after(8, 0.01)).toBe(4);
    expect(b.ms).toBeCloseTo(0.8);
    gpuTime.last = 10.1;
    expect(b.after(4, 0.01)).toBe(5);
    gpuTime.last = 10.3;
    expect(b.after(5, 0.01)).toBe(5);
  });
  it('a clock that is not available (no timestamp-query): the CPU’s ms to issue the bakes', () => {
    const b = createBudget({ gpuTime: { available: false, last: null }, first: 2 });
    expect(b.after(2, 0.1)).toBe(3);
    expect(b.after(3, 0.9)).toBe(1);
    expect(b.ms).toBe(0.9);
  });
  it('drawing nothing changes nothing without a clock; n never passes `most`', () => {
    const b = createBudget({ first: 3, most: 4 });
    expect(b.after(0, 0)).toBe(3);
    expect(b.after(3, 0)).toBe(4);
    expect(b.after(4, 0)).toBe(4);
  });
});
