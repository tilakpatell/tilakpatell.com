import { describe, expect, it } from 'vitest';
import { deflateSync } from 'node:zlib';
import { MASK_VERSION, buildMask, decodeMask, encodeMask, fineBlocked, inflateMask, maskFits } from './navMask.js';

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

  it('fits a grid only of its own cell, size and corner', () => {
    expect(maskFits(mask, { cell: 2, cols: 10, rows: 10, origin: [-10, -10] })).toBe(true);
    expect(maskFits(mask, { cell: 2, cols: 10, rows: 11, origin: [-10, -10] })).toBe(false);
    expect(maskFits(mask, { cell: 2, cols: 10, rows: 10, origin: [-9, -10] })).toBe(false);
    expect(maskFits(null, { cell: 2, cols: 10, rows: 10, origin: [-10, -10] })).toBe(false);
  });
});
