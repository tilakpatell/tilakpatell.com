import { describe, expect, it } from "vitest";
import {
  UNIVERSE,
  UNIVERSE_SEED,
  hash64,
  hash64Big,
  int,
  pick,
  planetSeed,
  range,
  rngOf,
  sectorSeed,
  systemSeed,
  universeOf,
} from "./seed";

describe("hash64", () => {
  it("is FNV-1a 64", () => {
    expect(hash64("")).toBe(0xcbf29ce484222325n);
    expect(hash64("a")).toBe(0xaf63dc4c8601ec8cn);
    expect(hash64("a")).not.toBe(hash64("b"));
  });
  it("joins parts with a nul, bigints as decimal", () => {
    expect(hash64("a", 1)).toBe(hash64("a\u00001"));
    expect(hash64(5n, "x")).toBe(hash64("5", "x"));
    expect(hash64("a", 1)).not.toBe(hash64("a1"));
  });
  it("stays 64 bits", () => {
    for (const s of ["x", "tilakverse", "ünïcode"])
      expect(hash64(s) >= 0n && hash64(s) < 1n << 64n).toBe(true);
  });
});

describe("universe and child seeds", () => {
  it("seeds the universe from its word", () => {
    expect(UNIVERSE_SEED).toBe("tilakverse");
    expect(UNIVERSE).toBe(hash64("tilakverse"));
    expect(universeOf("other")).toBe(hash64("other"));
  });
  it("derives sector, system and planet seeds", () => {
    const s = sectorSeed(UNIVERSE, 3, -2);
    expect(s).toBe(hash64(UNIVERSE, "sector", 3, -2));
    expect(systemSeed(s, 4)).toBe(hash64(s, "system", 4));
    expect(planetSeed(7n, 1)).toBe(hash64(7n, "planet", 1));
    expect(sectorSeed(UNIVERSE, 3, -2)).not.toBe(sectorSeed(UNIVERSE, -2, 3));
  });
});

describe("rngOf", () => {
  it("repeats for a seed and differs for another", () => {
    const a = rngOf(42n),
      b = rngOf(42n),
      c = rngOf(43n);
    const xs = Array.from({ length: 20 }, a),
      ys = Array.from({ length: 20 }, b),
      zs = Array.from({ length: 20 }, c);
    expect(xs).toEqual(ys);
    expect(xs).not.toEqual(zs);
  });
  it("is uniform in [0, 1)", () => {
    // (±5% is under two standard deviations a bin, so not every seed's
    // first 10,000 make it; this one's fixed, so the test is too)
    const r = rngOf(3n);
    const bins = new Array(10).fill(0);
    for (let i = 0; i < 10000; i++) {
      const v = r();
      expect(v >= 0 && v < 1).toBe(true);
      bins[Math.floor(v * 10)]++;
    }
    for (const n of bins) expect(n >= 950 && n <= 1050).toBe(true);
  });
  it("has range, int and pick helpers", () => {
    const r = rngOf(9n);
    for (let i = 0; i < 500; i++) {
      const x = range(r, -5, 5);
      expect(x >= -5 && x < 5).toBe(true);
      const n = int(r, 2, 4);
      expect([2, 3, 4]).toContain(n);
      expect(["a", "b"]).toContain(pick(r, ["a", "b"]));
    }
  });
});

describe('hash64 in two halves', () => {
  it('is the BigInt FNV-1a, byte for byte, ASCII or not', () => {
    const words = [[''], ['tilakverse'], [UNIVERSE, 'sector', 3, -2], [123456789n, 'planet', 7], ['ü', 'ünïcødé ✓'], ['a'.repeat(300)], [0xffffffffffffffffn, 'x']];
    for (const w of words) expect(hash64(...w), String(w)).toBe(hash64Big(...w));
    for (let i = 0; i < 2000; i++) expect(hash64(UNIVERSE, 'thing', i)).toBe(hash64Big(UNIVERSE, 'thing', i));
  });
});
