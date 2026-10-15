import { describe, expect, it } from 'vitest';
import hoth from '../../../public/models/galaxy/bf2017/levels/hoth/level.json';
import { holesOf } from './holes.js';

const TERRAIN = { holes: { metresPerPixel: 0.5, min: [-10, -20], size: [8, 4], rows: { 1: [[2, 3]], 3: [[0, 1]] } } };

describe('the terrain’s holes', () => {
  it('reads the runs into a grid in the pack’s frame', () => {
    const h = holesOf(TERRAIN);
    expect(h.count).toBe(4);
    // (row 1, columns 2 to 4: x −9…−8, z −19.5)
    expect(h.at(-9, -19.5)).toBe(true);
    expect(h.at(-8, -19.5)).toBe(true);
    expect(h.at(-7.5, -19.5)).toBe(false);
    expect(h.at(-10, -18.5)).toBe(true);
    expect(h.at(-100, -100)).toBe(false);
  });

  it('says whether a box holds any', () => {
    const h = holesOf(TERRAIN);
    expect(h.any(-9.2, -19.6, -8.9, -19.4)).toBe(true);
    expect(h.any(-7, -20, -6.5, -18.5)).toBe(false);
  });

  it('a terrain without holes has none', () => {
    expect(holesOf({})).toBeNull();
    expect(holesOf(null)).toBeNull();
  });

  it('Hoth’s are the game’s 7,502, at the two hangar mouths', () => {
    const h = holesOf(hoth.terrain);
    expect(h.count).toBe(7502);
    const [ox, , oz] = hoth.origin;
    // (the mouths by the two gates, PF_InteractGate_Hoth_01 at x 179 and 251: holes within 12 m of each)
    for (const [x, z] of [[176, -1568], [256, -1584]]) expect(h.any(x - 12 - ox, z - 12 - oz, x + 12 - ox, z + 12 - oz)).toBe(true);
  });
});
