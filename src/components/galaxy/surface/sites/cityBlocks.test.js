import { describe, expect, it } from 'vitest';
import { blocksOf, fillSide } from './cityBlocks';
import { seeded } from '../../../../lib/seeded.js';

const spec = { r: 220, block: [84, 48], plaza: 30, marks: [{ at: [96, 60], r: 20 }], crowd: { kinds: ['villager'], n: 6 }, traffic: { kind: 'airspeeder', n: 2 } };
const city = blocksOf(spec, { seed: 7 });
const row = (name) => city.rows.find((r) => r.model === `kit:city/${name}`);
const buildings = city.rows.filter((r) => r.model?.includes('Building_'));
const turn = (x, z, yaw) => [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];
// a building's footprint in the city, as its box says (placer.js)
const footOf = (it) => {
  const [hw, hd, ox, oz] = it.box;
  const [mx, mz] = turn(ox * it.scale, oz * it.scale, it.yaw);
  return { x: it.at[0] + mx, z: it.at[1] + mz, hw: hw * it.scale, hd: hd * it.scale, yaw: it.yaw };
};

describe('a city of blocks (the city kit’s)', () => {
  it('fills a side exactly, its buildings scaled together no further than a quarter', () => {
    const rand = seeded(3);
    for (const gap of [11.04, 23, 47.04, 60]) {
      const got = fillSide(rand, { medium: 1, small: 1 }, gap);
      expect(got, String(gap)).not.toBeNull();
      expect(got.scale).toBeGreaterThanOrEqual(0.8);
      expect(got.scale).toBeLessThanOrEqual(1.25);
    }
    // (too little room for even the smallest, scaled down a fifth)
    expect(fillSide(rand, { small: 1 }, 6)).toBeNull();
  });

  it('builds its blocks round, a hundred buildings and more, each solid over its own footprint', () => {
    expect(city.lots).toBeGreaterThan(100);
    expect(buildings.every((r) => r.solid && r.shadow)).toBe(true);
    const all = buildings.flatMap((r) => r.items);
    expect(all).toHaveLength(city.lots);
    for (const f of all.map(footOf)) expect(Math.hypot(f.x, f.z)).toBeLessThan(spec.r);
  });

  it('stands each building’s footprint back from its street, never over the road', () => {
    // (every footprint's middle inside a block, none in a street's 12 m)
    const pitch = [96, 60];
    for (const it of buildings.flatMap((r) => r.items)) {
      const f = footOf(it);
      for (const [k, v] of [f.x, f.z].entries()) {
        const off = Math.abs(v - Math.round(v / pitch[k]) * pitch[k]);
        expect(off, JSON.stringify(f)).toBeLessThan([42, 24][k]);
      }
    }
  });

  it('keeps no two buildings of a block standing in each other', () => {
    const feet = buildings.flatMap((r) => r.items).map(footOf);
    let overlaps = 0;
    for (let i = 0; i < feet.length; i++)
      for (let j = i + 1; j < feet.length; j++) {
        const a = feet[i];
        const b = feet[j];
        // (axis-aligned: every building faces one of the four ways)
        const [aw, ad] = Math.abs(Math.sin(a.yaw)) > 0.5 ? [a.hd, a.hw] : [a.hw, a.hd];
        const [bw, bd] = Math.abs(Math.sin(b.yaw)) > 0.5 ? [b.hd, b.hw] : [b.hw, b.hd];
        if (Math.abs(a.x - b.x) < aw + bw - 0.5 && Math.abs(a.z - b.z) < ad + bd - 0.5) overlaps++;
      }
    expect(overlaps).toBe(0);
  });

  it('makes the middle and a landmark’s block squares, paved and unbuilt', () => {
    const tiles = row('Sidewalk_NoCurb_3m').items;
    expect(tiles.length).toBe(2 * (84 / 3) * (48 / 3));
    for (const it of buildings.flatMap((r) => r.items)) {
      const f = footOf(it);
      expect(Math.abs(f.x) < 42 && Math.abs(f.z) < 24).toBe(false);
      expect(Math.abs(f.x - 96) < 42 && Math.abs(f.z - 60) < 24).toBe(false);
    }
  });

  it('lays its streets a tile every 6 m and a crossing at every corner, flattened onto the ground', () => {
    const street = row('Street_2Lane');
    expect(street.items.length).toBeGreaterThan(200);
    expect(street.items.every((it) => it.stretch === 0.2)).toBe(true);
    expect(street.solid).toBe(false);
    expect(street.shadow).toBe(false);
    // (the road 2 cm over the ground: its tile's road 0.15 under its pavement, a fifth of it kept)
    expect(-street.sink - 0.15 * 0.2).toBeCloseTo(0.02, 6);
    const crossings = row('Street_Asphalt_9x9').items;
    expect(row('Sidewalk_Corner_Round_3m').items).toHaveLength(crossings.length * 4);
    expect(row('Decal_Crosswalk').items.length).toBeGreaterThan(crossings.length * 2);
    // (each asphalt square's middle on a crossing: its origin is its corner)
    for (const it of crossings) {
      const mid = [it.at[0] - 6, it.at[1] - 6];
      expect(Math.abs(Math.abs(mid[0] % 96) - 48)).toBeLessThan(1e-6);
      expect(Math.abs(Math.abs(mid[1] % 60) - 30)).toBeLessThan(1e-6);
    }
  });

  it('turns each kerb’s curve toward its crossing’s middle', () => {
    // (the tile's own curve is to its -x, +z)
    for (const it of row('Sidewalk_Corner_Round_3m').items) {
      const [cx, cz] = turn(-1, 1, it.yaw);
      // (the way to the nearest crossing's middle, 4.5 m off each way)
      const k = [Math.round((it.at[0] - 48) / 96) * 96 + 48 - it.at[0], Math.round((it.at[1] - 30) / 60) * 60 + 30 - it.at[1]];
      expect(Math.abs(k[0])).toBeCloseTo(4.5, 6);
      expect(cx * k[0] > 0 && cz * k[1] > 0).toBe(true);
    }
  });

  it('lights its pavements and walks and flies its streets, paving them all into the ground', () => {
    expect(city.rows.find((r) => r.kind === 'lamp').items.length).toBeGreaterThan(40);
    expect(city.life.filter((a) => a.kind === 'villager')).toHaveLength(6);
    expect(city.life.filter((a) => a.kind === 'airspeeder')).toHaveLength(2);
    expect(city.paving.filter((p) => p.w === 12).length).toBeGreaterThan(20);
    expect(city.flat.r).toBe(spec.r + 18);
  });

  it('keeps a person’s spot clear of buildings', () => {
    const at = [96 + 42 - 8, 0];
    const kept = blocksOf({ ...spec, keep: [{ at, r: 6 }] }, { seed: 7 });
    const feet = kept.rows.filter((r) => r.model?.includes('Building_')).flatMap((r) => r.items).map(footOf);
    expect(feet.every((f) => Math.hypot(f.x - at[0], f.z - at[1]) > 6)).toBe(true);
    expect(kept.lots).toBeLessThan(city.lots);
  });

  it('is the same city every visit', () => {
    expect(blocksOf(spec, { seed: 7 })).toEqual(city);
  });
});
