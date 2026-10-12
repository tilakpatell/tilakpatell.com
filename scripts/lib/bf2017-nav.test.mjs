import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cellAt } from '../../src/lib/battlefront/nav.js';
import { encodeMask, fineBlocked, fineStand } from '../../src/lib/battlefront/navMask.js';
import { bodyBox, capsuleOf, navMaskOf, raysOf } from './bf2017-nav.mjs';

// lane P0's fixture pack: snow piles 0.9 m tall at (10, 0, 10), (20, 0, 10), (30, 0, 10)
const PACK = new URL('../fixtures/bf2017/physics/pack/', import.meta.url);
const pack = JSON.parse(readFileSync(new URL('level.json', PACK), 'utf8'));
const loadBin = async (file) => {
  const b = readFileSync(new URL(file, PACK));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
// (cell middles on the even metres, so (10, 10) is one; the walk starts at the corner)
const BOUNDS = { min: [-1, -1], max: [41, 21] };
const SEEDS = [[0, 0, 0]];
const soldier = JSON.parse(readFileSync(new URL('../../src/data/bf2017/physics/soldier.json', import.meta.url), 'utf8'));
const capsule = capsuleOf(soldier);
const blockedAt = (mask, x, z) => {
  const [c, r] = cellAt(mask, x, z);
  return mask.blocked[r * mask.cols + c] === 1;
};

describe('the nav mask from a pack’s shapes', () => {
  it('takes the soldier’s capsule from the records, with their sources', () => {
    expect(capsule).toMatchObject({ radius: 0.3, step: 0.4, height: 1.7 });
    expect(capsule.sources.radius).toBe('Gameplay/Characters/DefaultSoldierPhysics#CharacterPhysicsData.PhysicalRadius');
    expect(capsule.sources.step).toMatch(/Poses\[0\]\.StepHeight$/);
  });

  it('reads the ground rays from the records, the in-air end for the drops', () => {
    expect(raysOf(soldier)).toMatchObject({ start: 1.2, end: -4 });
    expect(raysOf(soldier).sources.start).toMatch(/RayStartHeightOnGround$/);
  });

  it('boxes a body on the ground: its hulls’ points turned and placed, a ball by its radius', () => {
    // (a quarter turn about +Y: x → −z, z → x)
    const q = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
    const box = bodyBox({ position: [10, 0, 20], rotation: q, colliders: [{ shape: 'hull', args: [new Float32Array([0, 0, 0, 4, 1, 0, 0, 2, 1])] }] });
    expect(box.map((v) => Math.round(v * 1000) / 1000)).toEqual([10, 16, 11, 20]);
    expect(bodyBox({ position: [0, 0, 0], colliders: [{ shape: 'ball', args: [2], position: [5, 1, 5] }] })).toEqual([3, 3, 7, 7]);
    expect(bodyBox({ colliders: [] })[0]).toBe(Infinity);
  });

  // (the engine's first load can take the default five seconds on a busy machine)
  it('walks up a pile’s slope as the game’s step allows, and stands on it', { timeout: 60000 }, async () => {
    const mask = await navMaskOf({ pack, loadBin, heightAt: () => 0, bounds: BOUNDS, seeds: SEEDS, capsule });
    // (the columns near a shape are few: the rest ask the engine nothing)
    expect(mask.stats.near).toBeGreaterThan(0);
    expect(mask.stats.near).toBeLessThan(mask.stats.columns / 4);
    expect(blockedAt(mask, 10, 10)).toBe(false);
    expect(fineBlocked(mask, 10, 10)).toBe(false);
    expect(fineStand(mask, 10, 10)).toBeGreaterThan(0.6);
    expect(fineStand(mask, 10, 10)).toBeLessThan(1);
    expect(fineBlocked(mask, 10, 18)).toBe(false);
    expect(fineStand(mask, 10, 18)).toBe(0);
  });

  it('blocks the pile when the climb is less than its slope’s rise, with its top', async () => {
    const mask = await navMaskOf({ pack, loadBin, heightAt: () => 0, bounds: BOUNDS, seeds: SEEDS, capsule, climb: 0.3 });
    expect(blockedAt(mask, 10, 10)).toBe(true);
    expect(blockedAt(mask, 10, 18)).toBe(false);
    expect(mask.top[cellAt(mask, 10, 10)[1] * mask.cols + cellAt(mask, 10, 10)[0]]).toBeGreaterThanOrEqual(5);
    expect(fineBlocked(mask, 10, 10)).toBe(true);
    expect(fineStand(mask, 10, 10)).toBe(0);
  });

  it('puts the pack back at its origin: the export’s frame', async () => {
    const mask = await navMaskOf({ pack: { ...pack, origin: [100, 0, 0] }, loadBin, heightAt: () => 0, bounds: { min: [99, -1], max: [141, 21] }, seeds: [[100, 0, 0]], capsule });
    expect(fineStand(mask, 110, 10)).toBeGreaterThan(0.6);
    expect(fineStand(mask, 110, 18)).toBe(0);
    expect(blockedAt(mask, 110, 10)).toBe(false);
  });

  it('measures the capsule from the ground the heights give', async () => {
    // (the ground 2 m up, the pack's spot 2 m up too: the same piles)
    const lifted = await navMaskOf({ pack: { ...pack, origin: [0, 2, 0] }, loadBin, heightAt: () => 2, bounds: BOUNDS, seeds: [[0, 2, 0]], capsule });
    expect(fineStand(lifted, 10, 10)).toBeGreaterThan(0.6);
    // (the ground over the piles' tops: the walk never meets them)
    const buried = await navMaskOf({ pack, loadBin, heightAt: () => 1, bounds: BOUNDS, seeds: [[0, 1, 0]], capsule });
    expect(blockedAt(buried, 10, 10)).toBe(false);
    expect(fineStand(buried, 10, 10)).toBe(0);
  });

  it('gives the same bytes twice', async () => {
    const a = encodeMask(await navMaskOf({ pack, loadBin, heightAt: () => 0, bounds: BOUNDS, seeds: SEEDS, capsule }));
    const b = encodeMask(await navMaskOf({ pack, loadBin, heightAt: () => 0, bounds: BOUNDS, seeds: SEEDS, capsule }));
    expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).toBe(0);
  });
});
