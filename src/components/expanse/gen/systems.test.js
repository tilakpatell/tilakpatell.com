import { describe, expect, it } from "vitest";
import { PRINTED, plainSector } from "./fixtures/fingerprint";
import { revsFor } from "./orbits";
import { UNIVERSE, hash64, moonSeed, sectorSeed, sectorSeedOf } from "./seed";
import { makeSector } from "./sector";
import { addBodies, moonsOf, ringBandOf, systemReach } from "./systems";

const raw = PRINTED.map(([sx, sz]) => makeSector(UNIVERSE, sx, sz));
const made = raw.map(addBodies);
const systems = made.flatMap((s) => s.systems);
const planets = systems.flatMap((s) => s.planets.map((p) => [s, p]));

describe("seeds", () => {
  it("moonSeed and sectorSeedOf", () => {
    expect(moonSeed(5n, 2)).toBe(hash64(5n, "moon", 2));
    expect(sectorSeedOf(UNIVERSE, 3, 0, -2)).toBe(sectorSeed(UNIVERSE, 3, -2));
    expect(sectorSeedOf(UNIVERSE, 3, 1, -2)).not.toBe(
      sectorSeed(UNIVERSE, 3, -2),
    );
  });
});

describe("addBodies", () => {
  it("has planets to test", () => {
    expect(planets.length).toBeGreaterThan(100);
  });
  it("changes no existing field and does not touch its input", () => {
    made.forEach((m, n) => {
      expect(plainSector(m)).toEqual(plainSector(raw[n]));
    });
    expect(raw[0].systems[0].reach).toBeUndefined();
    expect(raw[0].systems[0].planets[0].moonList).toBeUndefined();
  });
  it("gives every planet its centre and revs", () => {
    for (const [s, p] of planets) {
      expect(p.centre).toEqual(s.at);
      expect(p.revs).toBe(revsFor(p.orbit));
    }
  });
});

describe("moonsOf", () => {
  it("makes the moons the planet says", () => {
    for (const [, p] of planets) {
      expect(p.moonList).toHaveLength(p.moons);
      p.moonList.forEach((m, k) => {
        expect(m.id).toBe(`${p.id}:${k}`);
        expect(m.k).toBe(k);
        expect(m.name).toBe(`${p.name} ${["I", "II", "III", "IV", "V", "VI"][k]}`);
        expect(["rocky", "icy"]).toContain(m.type);
        expect(m.seed).toBe(moonSeed(p.seed, k));
        expect(m.revs).toBe(revsFor(m.orbit));
        expect(m.phase).toBeGreaterThanOrEqual(0);
        expect(m.phase).toBeLessThan(2 * Math.PI);
        expect(Math.abs(m.tilt)).toBeLessThanOrEqual(0.35);
        expect(m.radius).toBeGreaterThanOrEqual(3);
        expect(m.radius).toBeLessThanOrEqual(0.25 * p.radius + 3);
      });
    }
  });
  it("keeps the orbits rising, clear of the planet and its rings", () => {
    for (const [, p] of planets) {
      let last = Math.max(1.8 * p.radius, p.ringBand ? p.ringBand.outer : 0);
      for (const m of p.moonList) {
        expect(m.orbit).toBeGreaterThan(last);
        last = m.orbit;
      }
      expect(last).toBeLessThanOrEqual(4.4 * p.radius);
    }
  });
  it("is icier round cold planets", () => {
    const share = (types) => {
      const ms = planets
        .filter(([, p]) => types.includes(p.type))
        .flatMap(([, p]) => p.moonList);
      return ms.filter((m) => m.type === "icy").length / ms.length;
    };
    expect(share(["ice", "gas", "ringed"])).toBeGreaterThan(
      share(["rock", "lava", "desert"]),
    );
  });
  it("is pure", () => {
    const [, p] = planets.find(([, q]) => q.moons > 1);
    expect(moonsOf(p)).toEqual(moonsOf(p));
    expect(moonsOf(p)).toEqual(p.moonList);
  });
});

describe("ringBandOf", () => {
  it("is null unless the planet has rings, else within 1.3 to 2.4 radii", () => {
    for (const [, p] of planets) {
      const b = ringBandOf(p);
      if (!p.rings) expect(b).toBeNull();
      else {
        expect(b.inner).toBeGreaterThanOrEqual(1.3 * p.radius);
        expect(b.inner).toBeLessThan(b.outer);
        expect(b.outer).toBeLessThanOrEqual(2.4 * p.radius);
      }
    }
    expect(planets.some(([, p]) => p.rings)).toBe(true);
  });
});

describe("systemReach", () => {
  it("covers the star, every planet, its rings and its last moon", () => {
    for (const s of systems) {
      expect(s.reach).toBe(systemReach(s));
      expect(s.reach).toBeGreaterThanOrEqual(s.star.size * 3);
      for (const p of s.planets) {
        const last = p.moonList.at(-1);
        const out = Math.max(
          p.radius,
          p.ringBand ? p.ringBand.outer : 0,
          last ? last.orbit + last.radius : 0,
        );
        expect(s.reach).toBeGreaterThanOrEqual(p.orbit + out);
      }
    }
  });
});
