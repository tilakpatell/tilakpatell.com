import { describe, expect, it } from "vitest";
import { parseSpaceId, sectorCentre } from "../../../lib/space/address.js";
import { keepOutsNear } from "./keepOuts";
import { UNIVERSE, sectorSeedOf } from "./seed";
import { makeSector } from "./sector";
import { addBodies, systemReach } from "./systems";
import {
  SECTOR_EXTRAS,
  THING_BASE,
  THING_CELLS,
  THING_JITTER,
  THING_KINDS,
  THING_NEAR,
  thingInCell,
  thingRow,
  thingSeed,
  thingsOf,
} from "./things";

const build = (sx, sz) => {
  const sector = addBodies(makeSector(UNIVERSE, sx, sz));
  const origin = sectorCentre(sx, 0, sz);
  const seed = sectorSeedOf(UNIVERSE, sx, 0, sz);
  return {
    sx,
    sy: 0,
    sz,
    origin,
    seed,
    systems: sector.systems,
    outs: keepOutsNear(sx, 0, sz),
  };
};
const ctx = build(3, -2);
const set = thingsOf(ctx).things;
const CELL = 6000;

describe("constants and kinds", () => {
  it("holds the brief's values", () => {
    expect([THING_BASE, THING_CELLS, THING_JITTER, THING_NEAR]).toEqual([64, 20, 0.8, 8]);
    expect(SECTOR_EXTRAS).toEqual([]);
  });
  it("has four valid kinds", () => {
    expect(THING_KINDS.map((k) => k.kind)).toEqual(["rock", "ice", "derelict", "rogue"]);
    for (const k of THING_KINDS) {
      expect(k.weight).toBeGreaterThan(0);
      expect(k.size[0]).toBeLessThan(k.size[1]);
      expect(k.look.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(k.look.lit).toBe(true);
    }
  });
});

describe("thingsOf", () => {
  it("fills the lattice, slots unique and ascending", () => {
    expect(set.count).toBeGreaterThan(1000);
    expect(set.count).toBeLessThanOrEqual(8000);
    for (let i = 1; i < set.count; i++) expect(set.slot[i]).toBeGreaterThan(set.slot[i - 1]);
  });
  it("keeps each thing near its cell's centre, in a known kind and size", () => {
    for (let i = 0; i < set.count; i++) {
      const s = set.slot[i];
      const cell = [s % 20, Math.floor(s / 20) % 20, Math.floor(s / 400)];
      for (let a = 0; a < 3; a++) {
        const c = -60000 + 3000 + CELL * cell[a];
        expect(Math.abs(set.at[i * 3 + a] - c)).toBeLessThanOrEqual(0.8 * 3000 + 0.01);
      }
      const k = THING_KINDS[set.kind[i]];
      expect(set.size[i]).toBeGreaterThanOrEqual(k.size[0] - 0.01);
      expect(set.size[i]).toBeLessThanOrEqual(k.size[1] + 0.01);
    }
  });
  it("leaves keep-outs and systems clear", () => {
    const reach = ctx.systems.map(systemReach);
    for (let i = 0; i < set.count; i++) {
      const p = [0, 1, 2].map((a) => ctx.origin[a] + set.at[i * 3 + a]);
      for (const k of ctx.outs) {
        const d = Math.hypot(p[0] - k.at[0], p[1] - k.at[1], p[2] - k.at[2]);
        expect(d).toBeGreaterThanOrEqual(k.r + (THING_NEAR + 1) * set.size[i] - 0.5);
      }
      ctx.systems.forEach((s, j) => {
        const d = Math.hypot(p[0] - s.at[0], p[1] - s.at[1], p[2] - s.at[2]);
        expect(d).toBeGreaterThanOrEqual(reach[j] + set.size[i] - 0.5);
      });
    }
  });
  it("is the same on a second build", () => {
    const again = thingsOf(build(3, -2)).things;
    expect(again.count).toBe(set.count);
    expect(Array.from(again.at)).toEqual(Array.from(set.at));
  });
  it("gives any cell alone what the full list gives, in any order", () => {
    const fresh = build(3, -2);
    const bySlot = new Map();
    for (let i = 0; i < set.count; i++) bySlot.set(set.slot[i], i);
    for (let n = 0; n < 50; n++) {
      const slot = 7999 - ((n * 157 + 13) % 8000);
      const one = thingInCell(fresh, slot);
      const i = bySlot.get(slot);
      if (i === undefined) expect(one).toBeNull();
      else {
        expect(one.kind).toBe(set.kind[i]);
        expect(one.size).toBeCloseTo(set.size[i], 2);
        for (let a = 0; a < 3; a++) expect(one.at[a]).toBeCloseTo(set.at[i * 3 + a], 2);
      }
    }
  });
  it("is fast enough", () => {
    const c = build(-4, 5);
    const t = performance.now();
    thingsOf(c);
    expect(performance.now() - t).toBeLessThan(200);
  });
});

describe("thingRow", () => {
  const sector = { ...ctx, things: set };
  it("names, ids and seeds a thing", () => {
    for (const i of [0, 1, set.count - 1]) {
      const row = thingRow(sector, i);
      expect(parseSpaceId(row.id).wonder).toBe(THING_BASE + set.slot[i]);
      expect(row.n).toBe(THING_BASE + set.slot[i]);
      expect(row.seed).toBe(thingSeed(ctx.seed, row.n));
      expect(row.name).toMatch(/^[A-Z]/);
      expect(row.kind).toBe(THING_KINDS[set.kind[i]].kind);
      expect(Math.abs(row.at[0] - (ctx.origin[0] + set.at[i * 3]))).toBeLessThan(0.01);
    }
  });
});

describe("hooks", () => {
  it("keeps the first max rows of an extra, with ids from base", () => {
    const a = { kind: "rock", at: [0, 0, 0], size: 1 };
    const out = thingsOf(ctx, [{ list: "test", base: 3, max: 2, make: () => [a, a, a] }]);
    expect(out.extras.test).toHaveLength(2);
    expect(out.extras.test.map((r) => r.id.split(":").pop())).toEqual(["w3", "w4"]);
  });
  it("refuses an extra that reaches into the lattice's ids", () => {
    expect(() => thingsOf(ctx, [{ list: "x", base: 63, max: 2, make: () => [] }])).toThrow();
  });
  it("refuses an extra below the middle layer's wonders, and two extras that overlap", () => {
    expect(() => thingsOf(ctx, [{ list: "x", base: 2, max: 2, make: () => [] }])).toThrow(/middle layer/);
    const a = { list: "a", base: 10, max: 5, make: () => [] };
    expect(() => thingsOf(ctx, [a, { list: "b", base: 14, max: 3, make: () => [] }])).toThrow(/share ids/);
    expect(() => thingsOf(ctx, [{ list: "b", base: 12, max: 1, make: () => [] }, a])).toThrow(/share ids/);
    expect(() => thingsOf(ctx, [a, { list: "b", base: 15, max: 3, make: () => [] }])).not.toThrow();
  });
  it("drops a site whose kind's place gives null, and moves one it moves", () => {
    const kinds = [{ ...THING_KINDS[0], place: () => null }];
    expect(thingsOf(ctx, [], kinds).things.count).toBe(0);
    const moved = [{ ...THING_KINDS[0], place: (site) => [site.at[0], site.at[1] + 1, site.at[2]] }];
    const plain = [THING_KINDS[0]];
    const a = thingInCell(ctx, 4000, plain);
    const b = thingInCell(ctx, 4000, moved);
    expect(a).not.toBeNull();
    expect(b.at[1] - a.at[1]).toBeCloseTo(1, 2);
  });
});

describe("clearance, forced", () => {
  const home = build(0, 0);
  const homeSet = thingsOf(home).things;
  it("removes slots near the home keep-out, and the rest clear it", () => {
    expect(home.outs.length).toBeGreaterThan(0);
    expect(homeSet.count).toBeLessThan(8000);
    for (let i = 0; i < homeSet.count; i++) {
      const p = [0, 1, 2].map((a) => home.origin[a] + homeSet.at[i * 3 + a]);
      for (const k of home.outs) {
        const d = Math.hypot(p[0] - k.at[0], p[1] - k.at[1], p[2] - k.at[2]);
        expect(d).toBeGreaterThanOrEqual(k.r + (THING_NEAR + 1) * homeSet.size[i] - 0.5);
      }
    }
  });
  const slot = 4210;
  const free = thingInCell({ ...ctx, systems: [], outs: [] }, slot);
  const spot = free && free.at.map((v, a) => ctx.origin[a] + v);
  it("has a free site to aim at", () => {
    expect(free).not.toBeNull();
  });
  it("drops a thing whose site is inside a system's reach", () => {
    const hit = { ...ctx, outs: [], systems: [{ at: spot, reach: 1 }] };
    expect(thingInCell(hit, slot)).toBeNull();
    const miss = { ...ctx, outs: [], systems: [{ at: spot.map((v) => v + 5000), reach: 1 }] };
    expect(thingInCell(miss, slot)).not.toBeNull();
    expect(thingsOf(hit).things.slot).not.toContain(slot);
  });
  it("drops a thing whose site is inside a keep-out", () => {
    const hit = { ...ctx, systems: [], outs: [{ id: "t", at: spot, r: 1 }] };
    expect(thingInCell(hit, slot)).toBeNull();
    const miss = { ...ctx, systems: [], outs: [{ id: "t", at: spot.map((v) => v + 5000), r: 1 }] };
    expect(thingInCell(miss, slot)).not.toBeNull();
  });
  it("drops a thing inside a wonder's radius plus its size, except for a nebula", () => {
    const wonder = (kind, size) => ({ id: "w", kind, at: spot, size });
    const hit = { ...ctx, outs: [], systems: [], wonders: [wonder("pulsar", 1)] };
    expect(thingInCell(hit, slot)).toBeNull();
    expect(thingsOf(hit).things.slot).not.toContain(slot);
    const edge = { ...hit, wonders: [{ ...wonder("derelict", 1), at: spot.map((v, a) => v + (a ? 0 : free.size + 0.5)) }] };
    expect(thingInCell(edge, slot)).toBeNull();
    const clear = { ...hit, wonders: [{ ...wonder("rogue", 1), at: spot.map((v, a) => v + (a ? 0 : free.size + 5)) }] };
    expect(thingInCell(clear, slot)).not.toBeNull();
    const nebula = { ...hit, wonders: [wonder("nebula", 2000)] };
    expect(thingInCell(nebula, slot)).toEqual(free);
    expect(thingsOf(nebula).things.slot).toContain(slot);
  });
});
