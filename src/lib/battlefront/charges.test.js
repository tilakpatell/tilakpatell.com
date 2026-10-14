import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import hoth from '../../data/bf2017/maps/hoth.json';
import { load } from './navmesh.js';
import { attachMesh, meshPath } from './meshNav.js';
import { ANGLE, REACH, SCALE, canUse, keypadStand, reachOf } from './charges.js';

// (Hoth's playthrough mesh alone, cut from the bucket's navmesh.bin: scripts/bf2017-navmesh-cut.mjs)
const BIN = join(import.meta.dirname, '../../../scripts/fixtures/bf2017/navmesh/hoth-playthrough.bin');
const bytes = readFileSync(BIN);
const grid = () => ({ cols: 1, rows: 1, origin: [-1e6, -1e6], cell: 2e6, height: new Float32Array([-1000]) });
const navOf = () => attachMesh(grid(), load(bytes, { mesh: 'playthrough' }));
const CHARGES = hoth.rows.charges;

describe('a fuel charge’s keypad', () => {
  it('is read for each of Hoth’s three charges, the keypad by its charge', () => {
    expect(CHARGES.map((c) => c.id).sort()).toEqual(['FantasyBattle_Logic:131', 'FantasyBattle_Logic:4', 'FantasyBattle_Logic:63']);
    for (const c of CHARGES) {
      expect(Math.hypot(c.keypad.at[0] - c.at[0], c.keypad.at[2] - c.at[2])).toBeLessThan(0.5);
      // (1.28 m up the core, the button 0.3 m more)
      expect(c.keypad.at[1] - c.at[1]).toBeCloseTo(1.58, 2);
    }
  });

  it('reaches 3 m from any side: the keypad’s 1 m on the button’s 3× transform, its 360°', () => {
    const c = CHARGES[0];
    expect([REACH, SCALE, ANGLE]).toEqual([1, 3, 360]);
    expect(reachOf(c)).toBe(3);
    const [x, y, z] = c.keypad.at;
    expect(canUse(c, [x + 2.9, y, z])).toBe(true);
    expect(canUse(c, [x - 2.9, y, z])).toBe(true);
    expect(canUse(c, [x, y, z + 3.1])).toBe(false);
    // (from the floor 1.58 m under it: 2.5 m out)
    expect(canUse(c, [x + 2.5, y - 1.58, z])).toBe(true);
    expect(canUse(c, [x + 2.6, y - 1.58, z])).toBe(false);
  });

  it('gives each a stand on the navmesh that reaches it, and a way to it from the hangars', () => {
    const nav = navOf();
    for (const c of CHARGES) {
      const at = keypadStand(nav, c);
      expect(at, c.id).not.toBeNull();
      expect(canUse(c, at)).toBe(true);
      // (on the fuel room's floor, not the snow over it)
      expect(at[1]).toBeGreaterThan(c.at[1] - 1);
      expect(at[1]).toBeLessThan(c.at[1] + 1);
      expect(meshPath(nav, [209, -1755], [at[0], at[2]], { fromY: 359.2, toY: at[1] }), c.id).not.toBeNull();
    }
  });
});
