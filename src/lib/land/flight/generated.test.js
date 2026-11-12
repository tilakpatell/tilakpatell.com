import { describe, expect, it } from 'vitest';
import { POI_NAMES, chartedAt, groundRadius } from './generated';
import { sphereField } from './sphereField';
import { angleBetween, dirOfUv } from './sphere';
import { planetSpecOf as specWith } from './planetSpec';
import { MOONS, lookupOf, randomSystems } from './fixtures/generated';
import { PLANETS, planetSpecOf } from './fixtures/expanse.js';

// every key a roster spec has (its 17 and ROSTER_EXTRA's)
const KEYS = Object.keys(planetSpecOf('hoth'));
const rows = randomSystems(60, 4).flat();
const lookup = lookupOf(rows);
const landable = rows.filter((r) => !['gas', 'ringed'].includes(r.type)).slice(0, 40);

describe('generatedSpecOf', () => {
  it('makes a round planet of every landable type, and a moon, with every field a spec has', () => {
    for (const r of [...landable, ...MOONS]) {
      const s = specWith(r.id, { expanse: (id) => lookup(id) ?? MOONS.find((m) => m.id === id) ?? null });
      for (const k of KEYS) expect(k in s, `${r.id} ${k}`).toBe(true);
      expect(s.round.radius).toBeGreaterThanOrEqual(15000);
      expect(s.round.radius).toBeLessThanOrEqual(60000);
      expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    }
  });

  it('sizes the ground from the universe radius', () => {
    expect(groundRadius({ radius: 18 })).toBe(15000);
    expect(groundRadius({ radius: 70 })).toBe(60000);
    expect(groundRadius({ radius: 140 })).toBe(60000);
    expect(groundRadius({ radius: 44 })).toBe(37500);
    expect(groundRadius({})).toBe(15000);
  });

  it('puts its places on dry, gentle land, apart, and starts the chart at the first', () => {
    for (const r of landable) {
      const s = specWith(r.id, { expanse: lookup });
      const f = sphereField(s);
      s.pois.forEach((p, i) => {
        expect(POI_NAMES[p.kind]).toBe(p.name);
        expect(f.sample(p.dir).h).toBeGreaterThan((s.water?.level ?? -Infinity) + 3);
        for (const q of s.pois.slice(0, i)) expect(angleBetween(p.dir, q.dir)).toBeGreaterThanOrEqual(0.3);
      });
      if (s.pois.length) expect(Math.hypot(...s.pois[0].at)).toBe(0);
    }
  });

  it('gives the seeded thirteen no new places', () => {
    for (const p of PLANETS.slice(37)) expect(planetSpecOf(p.id).pois).toEqual([]);
  });

  it('charts again at any spot: the origin and the POIs move, nothing else', () => {
    const s = specWith(landable[0].id, { expanse: lookup });
    const t = chartedAt(s, dirOfUv(0.1, 0.3));
    expect(angleBetween(t.round.at, dirOfUv(0.1, 0.3))).toBeLessThan(1e-12);
    expect({ ...t, round: null, pois: null }).toEqual({ ...s, round: null, pois: null });
    expect(t.pois.map((p) => p.dir)).toEqual(s.pois.map((p) => p.dir));
  });

  it('is the same spec from any lookup that knows the row (the universe’s or the flight’s)', () => {
    for (const r of landable.slice(0, 10)) expect(specWith(r.id, { expanse: [r] })).toEqual(specWith(r.id, { expanse: lookup }));
  });

  it('wears its variety in the flight: the sky in its palette, the haze in its fog', () => {
    const s = specWith(landable[1].id, { expanse: lookup });
    expect(s.palette.skyLow).toBe(s.sky.low);
    expect(s.fog.far).toBe(Math.round(21000 - 9000 * s.sky.haze));
  });

  it('keeps a gas giant a plane cloud deck, recoloured', () => {
    const g = rows.find((r) => r.type === 'gas');
    const s = specWith(g.id, { expanse: lookup });
    expect(s).toMatchObject({ round: null, soft: true, pois: [], water: null, buildable: false });
  });

  it('shows several biomes on its sphere', () => {
    let many = 0;
    for (const r of landable) {
      const f = sphereField(specWith(r.id, { expanse: lookup }));
      const count = new Map();
      for (let j = 0; j < 32; j++) for (let i = 0; i < 64; i++) { const b = f.biomeAt(dirOfUv((i + 0.5) / 64, (j + 0.5) / 32)); count.set(b, (count.get(b) ?? 0) + 1); }
      const big = [...count.values()].filter((n) => n >= 0.03 * 2048).length;
      expect(big, r.id).toBeGreaterThanOrEqual(2);
      if (big >= 3) many++;
    }
    expect(many / landable.length).toBeGreaterThanOrEqual(0.9);
  });
});
