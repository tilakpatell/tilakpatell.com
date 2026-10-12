import { describe, expect, it } from 'vitest';
import { deflateSync } from 'node:zlib';
import { CLIMB, MASK_VERSION, buildMask, buildWalkMask, decodeMask, encodeMask, fineBlocked, fineStand, inflateMask, maskFits } from './navMask.js';

// a 4 × 4 m block 2.5 m tall at the middle of flat ground, as a capsule of radius r meets it
const BLOCK = { half: 2, top: 2.5 };
const blockedAt = (x, y, z, r) => Math.abs(x) < BLOCK.half + r && Math.abs(z) < BLOCK.half + r;
const topAt = (x, z, ground) => (blockedAt(x, ground, z, 0) ? BLOCK.top : 0);
const CAPSULE = { step: 0.4, height: 1.7, radius: 0.3 };
const opts = { bounds: { min: [-10, -10], max: [10, 10] }, cell: 2, fine: 0.5, heightAt: () => 0, blockedAt, topAt, capsule: CAPSULE };

describe('the nav mask', () => {
  const mask = buildMask(opts);

  it('blocks exactly the coarse cells whose middle the capsule cannot stand in', () => {
    expect(mask.cols).toBe(10);
    expect(mask.rows).toBe(10);
    const blocked = [];
    for (let i = 0; i < mask.blocked.length; i++) if (mask.blocked[i]) blocked.push([i % mask.cols, Math.floor(i / mask.cols)]);
    expect(blocked).toEqual([
      [4, 4],
      [5, 4],
      [4, 5],
      [5, 5],
    ]);
  });

  it('keeps each blocked cell’s top above the ground in decimetres, 0 where open', () => {
    expect(mask.top[4 * 10 + 4]).toBe(25);
    expect(mask.top[0]).toBe(0);
  });

  it('samples the fine grid round the block, the capsule’s radius out', () => {
    let n = 0;
    for (let i = 0; i < mask.fine.cols * mask.fine.rows; i++) if (mask.fine.bits[i >> 3] & (1 << (i & 7))) n++;
    // (fine middles ±0.25 … ±2.25 lie within 2 + 0.3 of the block's middle: 10 a side)
    expect(n).toBe(100);
    expect(fineBlocked(mask, 2.2, 0)).toBe(true);
    expect(fineBlocked(mask, 2.6, 0)).toBe(false);
    expect(fineBlocked(mask, 0, 0)).toBe(true);
    expect(fineBlocked(mask, 50, 0)).toBe(false);
  });

  it('round-trips through its bytes', () => {
    const back = decodeMask(encodeMask(mask));
    expect(back.version).toBe(MASK_VERSION);
    expect(back.cell).toBe(2);
    expect(back.origin).toEqual([-10, -10]);
    expect(back.capsule).toEqual(CAPSULE);
    expect([...back.blocked]).toEqual([...mask.blocked]);
    expect([...back.top]).toEqual([...mask.top]);
    expect([...back.fine.bits]).toEqual([...mask.fine.bits]);
    expect(fineBlocked(back, 2.2, 0)).toBe(true);
  });

  it('reads back from its deflated bytes, as the page fetches them', async () => {
    const back = await inflateMask(deflateSync(encodeMask(mask)));
    expect([...back.top]).toEqual([...mask.top]);
  });

  it('keeps what it was built from', () => {
    const meta = { sources: { radius: 'CharacterPhysicsData.PhysicalRadius' }, terrain: { near: 123 } };
    expect(decodeMask(encodeMask({ ...mask, meta })).meta).toEqual(meta);
  });

  it('refuses another version, or bytes that are not a mask', () => {
    const bytes = encodeMask(mask);
    bytes[4] = MASK_VERSION + 1;
    expect(() => decodeMask(bytes)).toThrow(/version/);
    expect(() => decodeMask(new Uint8Array(64))).toThrow(/not a nav mask/);
  });

  it('still reads a version 1 mask (no stand, the climb the rule’s)', () => {
    // (version 1's layout: the same header without the climb, then the meta, the tops and the fine bits)
    const v2 = encodeMask(mask);
    const bytes = new Uint8Array(v2.length - 8 - 4);
    bytes.set(v2.subarray(0, 68), 0);
    bytes.set(v2.subarray(76, v2.length - 4), 68);
    bytes[4] = 1;
    const back = decodeMask(bytes);
    expect(back.version).toBe(1);
    expect(back.stand).toBeNull();
    expect(back.climb).toBe(CLIMB);
    expect([...back.top]).toEqual([...mask.top]);
    expect([...back.fine.bits]).toEqual([...mask.fine.bits]);
    expect(fineStand(back, 0, 0)).toBe(0);
  });

  it('fits a grid only of its own cell, size and corner', () => {
    expect(maskFits(mask, { cell: 2, cols: 10, rows: 10, origin: [-10, -10] })).toBe(true);
    expect(maskFits(mask, { cell: 2, cols: 10, rows: 11, origin: [-10, -10] })).toBe(false);
    expect(maskFits(mask, { cell: 2, cols: 10, rows: 10, origin: [-9, -10] })).toBe(false);
    expect(maskFits(null, { cell: 2, cols: 10, rows: 10, origin: [-10, -10] })).toBe(false);
  });
});

// The walk: flat ground at 0 with a snow pile (a cone 1.2 m tall, 3 m round,
// at the middle), a wall 2 m tall from x 5 to 6, and a trench 2 m deep from
// x −8 to −6 (the ground a hole there), each across z −5…5; the soldier
// starts in the south-west corner.
const pile = (x, z) => Math.max(0, 1.2 * (1 - Math.hypot(x, z) / 3));
const inWall = (x, z, r = 0) => x >= 5 - r && x < 6 + r && Math.abs(z) < 5 + r;
const inTrench = (x, z) => x > -8 && x < -6 && Math.abs(z) < 5;
const WALK = {
  bounds: { min: [-10, -10], max: [10, 10] },
  cell: 2,
  fine: 0.5,
  heightAt: () => 0,
  holeAt: inTrench,
  surfacesAt: (x, z, top, bottom) => [inWall(x, z) ? 2 : pile(x, z) || null, inTrench(x, z) ? -2 : null].filter((h) => h !== null && h <= top && h >= bottom).sort((a, b) => b - a),
  // (the capsule's foot at y: free unless it is inside the wall or under a pile's surface)
  freeAt: (x, y, z) => !(inWall(x, z, 0.3) && y < 2 - 0.05) && !(pile(x, z) > 0 && y < pile(x, z) - 0.05),
  topAt: (x, z) => (inWall(x, z) ? 2 : 0),
  seeds: [[-9.5, 0, -9.5]],
  capsule: CAPSULE,
  rays: { start: 1.2, end: -4 },
};

describe('the walk mask', () => {
  const mask = buildWalkMask(WALK);

  it('walks up a pile and stands on it, the height kept over the ground', () => {
    expect(fineBlocked(mask, 0, 0)).toBe(false);
    expect(fineStand(mask, 0.1, 0.1)).toBeCloseTo(pile(0.25, 0.25), 1);
    expect(fineStand(mask, 2.6, 0)).toBeCloseTo(pile(2.75, 0.25), 1);
    expect(fineStand(mask, -3, 8)).toBe(0);
  });

  it('blocks a wall taller than the climb, and never stands on its top', () => {
    expect(fineBlocked(mask, 5.5, 0)).toBe(true);
    expect(fineStand(mask, 5.5, 0)).toBe(0);
    // (the far side is reached round the wall's end)
    expect(fineBlocked(mask, 8, 0)).toBe(false);
    expect(mask.blocked[5 * 10 + 7]).toBe(1);
    expect(mask.top[5 * 10 + 7]).toBe(20);
    expect(mask.climb).toBe(CLIMB);
  });

  it('drops into a trench, a floor below the ground', () => {
    expect(fineBlocked(mask, -7, 0)).toBe(false);
    expect(fineStand(mask, -7, 0)).toBeCloseTo(-2, 1);
  });

  it('round-trips its stands through the bytes, sparse where the ground is bare', () => {
    const back = decodeMask(encodeMask(mask));
    expect(back.version).toBe(2);
    expect(back.climb).toBe(CLIMB);
    expect(back.stand.k).toBe(4);
    expect([...back.stand.offsets]).toEqual([...mask.stand.offsets]);
    expect([...back.stand.bytes]).toEqual([...mask.stand.bytes]);
    expect(fineStand(back, 0.1, 0.1)).toBe(fineStand(mask, 0.1, 0.1));
    expect(fineStand(back, -7, 0)).toBe(fineStand(mask, -7, 0));
    // (a block only where something stands off the ground)
    expect(mask.stand.offsets[0]).toBe(-1);
    expect(mask.stand.offsets[4 * 10 + 4]).toBeGreaterThanOrEqual(0);
  });
});
