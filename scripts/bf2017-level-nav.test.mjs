import { describe, expect, it } from 'vitest';
import { buildNav } from '../src/lib/battlefront/nav.js';
import { frameCheck, navPicture } from './bf2017-level-nav.mjs';

describe('the frame check (lane G2)', () => {
  const spawns = [
    { id: 'a', mode: 'galacticAssault', at: [0, 10.5, 0] }, // on the ground
    { id: 'b', mode: 'galacticAssault', at: [5, 14, 5] }, // on a crate's top
    { id: 'c', mode: 'hvv', at: [20, 30, 20] }, // in the air: a pack out of frame
    { id: 'd', mode: 'hvv', at: [1, 2] }, // (no height: not counted)
  ];
  const check = frameCheck(spawns, { groundAt: () => 10, boxes: [{ x: 5, z: 5, hw: 1, hd: 1, yaw: 0, top: 13, base: 10 }], floors: [] });

  it('holds each spawn to the nearest surface the pack has under it, within 2 m', () => {
    expect(check.total).toBe(3);
    expect(check.near).toBe(2);
    expect(check.byMode).toEqual({ galacticAssault: { total: 2, near: 2 }, hvv: { total: 1, near: 0 } });
    expect(check.worst).toEqual([{ id: 'c', d: 20 }]);
  });

  it('draws the grid from above, north up, the spawns on it', () => {
    const nav = buildNav({ heightAt: (x) => x / 10, bounds: { min: [0, 0], max: [8, 4] } });
    const pic = navPicture(nav, [{ x: 1, z: 1, ok: true }]);
    expect([pic.w, pic.h]).toEqual([4, 2]);
    // (the spawn's cell, row 0, is the picture's last row)
    expect(Array.from(pic.data.subarray(3 * 4, 3 * 4 + 3))).toEqual([40, 210, 80]);
  });
});
