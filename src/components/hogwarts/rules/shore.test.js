import { describe, expect, it } from 'vitest';
import { BOATS, BOUNDS, CASTLE, DOOR, GROUND, JETTY, LEVEL, SPAWN, floorAt, heightAt, inland, nearDoor, scatterOf, solidsOf, waterline } from './shore';

describe('the shore of the Black Lake', () => {
  it('meets the water at its waterline, the bed falling away under it and the bank rising behind', () => {
    for (let x = BOUNDS.x0; x <= BOUNDS.x1; x += 7) {
      const z = waterline(x);
      expect(Math.abs(heightAt(x, z) - LEVEL), `x ${x}`).toBeLessThan(0.25);
      expect(heightAt(x, z - 12), `x ${x}`).toBeLessThan(LEVEL - 0.8);
      expect(heightAt(x, z + 30), `x ${x}`).toBeGreaterThan(LEVEL + 2);
    }
  });

  it('has no cliff in it: the ground never steps more than a stride’s rise in a metre', () => {
    for (let x = GROUND.x0; x <= GROUND.x1; x += 5)
      for (let z = GROUND.z0; z <= GROUND.z1; z += 4) {
        expect(Math.abs(heightAt(x + 1, z) - heightAt(x, z)), `${x}, ${z}`).toBeLessThan(0.9);
        expect(Math.abs(heightAt(x, z + 1) - heightAt(x, z)), `${x}, ${z}`).toBeLessThan(0.9);
      }
  });

  it('puts the castle far across the open water', () => {
    expect(inland(...CASTLE.at)).toBeLessThan(-500);
    expect(Math.hypot(CASTLE.at[0] - SPAWN.at[0], CASTLE.at[1] - SPAWN.at[1])).toBeGreaterThan(500);
  });

  it('starts you on dry shingle, facing the castle', () => {
    const [x, z] = SPAWN.at;
    expect(heightAt(x, z)).toBeGreaterThan(LEVEL + 0.3);
    expect(inland(x, z)).toBeLessThan(14); // (on the shingle, not up the bank)
    // (yaw 0 looks down −z: the castle is straight ahead)
    const ahead = [-Math.sin(SPAWN.yaw), -Math.cos(SPAWN.yaw)];
    const to = [CASTLE.at[0] - x, CASTLE.at[1] - z];
    expect((ahead[0] * to[0] + ahead[1] * to[1]) / Math.hypot(...to)).toBeCloseTo(1, 6);
  });

  it('runs the jetty from the shingle out over the water, its planks above it', () => {
    expect(heightAt(JETTY.x, JETTY.from)).toBeGreaterThan(LEVEL);
    expect(heightAt(JETTY.x, JETTY.to)).toBeLessThan(LEVEL - 1.5);
    expect(floorAt(JETTY.x, (JETTY.from + JETTY.to) / 2)).toBe(JETTY.deck);
    expect(floorAt(JETTY.x + JETTY.wide, JETTY.to + 2)).toBeLessThan(LEVEL);
  });

  it('moors four boats along it, afloat, one with a lantern in its prow', () => {
    expect(BOATS).toHaveLength(4);
    expect(BOATS.filter((b) => b.lantern)).toHaveLength(1);
    for (const b of BOATS) {
      expect(heightAt(...b.at), `${b.at}`).toBeLessThan(LEVEL - 0.5);
      expect(Math.abs(b.at[0] - JETTY.x)).toBeGreaterThan(JETTY.wide / 2 + 0.8);
    }
  });

  it('puts the way in at the boats, in reach from the jetty’s planks', () => {
    expect(nearDoor(...DOOR.at)).toBe(true);
    expect(nearDoor(JETTY.x, JETTY.to + 1)).toBe(true);
    expect(floorAt(JETTY.x, DOOR.at[1])).toBe(JETTY.deck);
    expect(nearDoor(...SPAWN.at)).toBe(false);
  });

  it('lays the same rocks, grass and pines for everyone, fewer on low, none on the way down to the jetty', () => {
    const high = scatterOf({ tier: 'high' });
    expect(scatterOf({ tier: 'high' })).toEqual(high);
    expect(scatterOf({ tier: 'low' }).length).toBeLessThan(high.length * 0.6);
    for (const i of high) {
      expect(Math.abs(i.x)).toBeLessThanOrEqual(240);
      expect(i.z).toBeLessThanOrEqual(GROUND.z1);
      expect(Math.hypot(i.x - SPAWN.at[0], i.z - SPAWN.at[1]), i.model).toBeGreaterThanOrEqual(6);
      // (the pines up the bank, never on the shingle)
      if (i.model.startsWith('Pine')) expect(inland(i.x, i.z), i.model).toBeGreaterThan(19);
    }
    const solids = solidsOf(high);
    expect(solids.length).toBeGreaterThan(50);
    expect(solids.every((s) => s.r > 0)).toBe(true);
  });
});
