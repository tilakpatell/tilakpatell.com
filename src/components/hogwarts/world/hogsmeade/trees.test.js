import { describe, expect, it } from 'vitest';
import { SHACK, VILLAGE } from '../../rules/hogsmeade';
import { EDGE, streetFrame, terrainAt } from './layout';
import { pinesOf } from './trees';

describe('the pines round the village', () => {
  it('stand on the land, clear of the street, the road and the Shack’s hill', () => {
    const pines = pinesOf({ count: 160 });
    expect(pines.length).toBe(160);
    const hill = [SHACK.at[0] - VILLAGE.at[0], SHACK.at[1] - VILLAGE.at[1]];
    for (const p of pines) {
      const f = streetFrame([p.x, p.z]);
      const inYards = f.along > EDGE.a0 - 12 && f.along < EDGE.a1 + 12 && f.across > EDGE.c0 - 12 && f.across < EDGE.c1 + 12;
      expect(inYards).toBe(false);
      expect(f.along < EDGE.a0 && Math.abs(f.across) < 16).toBe(false);
      expect(Math.hypot(p.x - hill[0], p.z - hill[1])).toBeGreaterThan(SHACK.r * 1.7);
      expect(p.y).toBe(terrainAt(p.x, p.z));
    }
  });

  it('are the same pines every time', () => {
    expect(pinesOf({ count: 20 })).toEqual(pinesOf({ count: 20 }));
  });
});
