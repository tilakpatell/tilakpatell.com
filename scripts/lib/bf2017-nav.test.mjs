import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cellAt } from '../../src/lib/battlefront/nav.js';
import { encodeMask, fineBlocked } from '../../src/lib/battlefront/navMask.js';
import { capsuleOf, navMaskOf } from './bf2017-nav.mjs';

// lane P0's fixture pack: snow piles 0.9 m tall at (10, 0, 10), (20, 0, 10), (30, 0, 10)
const PACK = new URL('../fixtures/bf2017/physics/pack/', import.meta.url);
const pack = JSON.parse(readFileSync(new URL('level.json', PACK), 'utf8'));
const loadBin = async (file) => {
  const b = readFileSync(new URL(file, PACK));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
// (cell middles on the even metres, so (10, 10) is one)
const BOUNDS = { min: [-81, -21], max: [161, 41] };
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

  it('blocks where a pile stands above the step, and nowhere else', async () => {
    const mask = await navMaskOf({ pack, loadBin, heightAt: () => 0, bounds: BOUNDS, capsule });
    expect(blockedAt(mask, 10, 10)).toBe(true);
    expect(blockedAt(mask, 10, 30)).toBe(false);
    expect(mask.top[cellAt(mask, 10, 10)[1] * mask.cols + cellAt(mask, 10, 10)[0]]).toBeGreaterThanOrEqual(5);
    expect(fineBlocked(mask, 10, 10)).toBe(true);
    expect(fineBlocked(mask, 10, 12)).toBe(false);
  });

  it('puts the pack back at its origin: the export’s frame', async () => {
    const mask = await navMaskOf({ pack: { ...pack, origin: [100, 0, 0] }, loadBin, heightAt: () => 0, bounds: { min: [19, -21], max: [261, 41] }, capsule });
    expect(blockedAt(mask, 110, 10)).toBe(true);
    expect(blockedAt(mask, 10 + 20, 30)).toBe(false);
  });

  it('measures the capsule from the ground the heights give', async () => {
    // (the ground 2 m up, the pack's spot 2 m up too: the same piles)
    const lifted = await navMaskOf({ pack: { ...pack, origin: [0, 2, 0] }, loadBin, heightAt: () => 2, bounds: BOUNDS, capsule });
    expect(blockedAt(lifted, 10, 10)).toBe(true);
    // (the ground over the piles' tops: the capsule clears them)
    const buried = await navMaskOf({ pack, loadBin, heightAt: () => 1, bounds: BOUNDS, capsule });
    expect(blockedAt(buried, 10, 10)).toBe(false);
  });

  it('gives the same bytes twice', async () => {
    const a = encodeMask(await navMaskOf({ pack, loadBin, heightAt: () => 0, bounds: BOUNDS, capsule }));
    const b = encodeMask(await navMaskOf({ pack, loadBin, heightAt: () => 0, bounds: BOUNDS, capsule }));
    expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).toBe(0);
  });
});
