import { describe, expect, it } from 'vitest';
import { fieldKey, planetField } from './field';
import { sphereField } from './sphereField';
import { roundSpec } from './fixtures/generated';
import { chartOf } from './sphere';
import { TYPE_BIOMES } from './planetSpec';
import { PLANETS, planetSpecOf } from './fixtures/expanse.js';
import { WORLDS } from './planetTables';
import { seeded } from '../../seeded.js';

describe('planetField', () => {
  const hoth = planetSpecOf('hoth');
  const f = planetField(hoth);

  it('gives the same height at a point twice', () => {
    expect(f.heightAt(321.5, -987.25)).toBe(f.heightAt(321.5, -987.25));
  });

  it('holds Echo Base flat at 12 inside its r', () => {
    expect(f.heightAt(1200, -800)).toBe(12);
    expect(f.heightAt(1200 + 219, -800)).toBe(12);
    expect(f.heightAt(1200, -800 - 217)).toBe(12);
  });

  it('is the land again past r + edge', () => {
    const h = f.heightAt(1200 + 380, -800);
    expect(Number.isFinite(h)).toBe(true);
    expect(h).not.toBe(12);
  });

  it('has no step anywhere: no cliff where one biome gives way to another', () => {
    // a 3 km line a metre at a time, twice, across the ridges' reach: never
    // steeper than the flight's limit (60 m in 4 m) in any one metre
    for (const [x0, z0, dx, dz] of [[-20000, 4000, 1, 0], [6000, -15000, 0.6, 0.8]]) {
      let was = f.heightAt(x0, z0);
      for (let i = 1; i <= 3000; i++) {
        const h = f.heightAt(x0 + dx * i, z0 + dz * i);
        expect(Math.abs(h - was), `${x0 + dx * i}, ${z0 + dz * i}`).toBeLessThan(15);
        was = h;
      }
    }
  });

  it('names a biome by index', () => {
    for (let i = 0; i < 20; i++) {
      const b = f.biomeAt(i * 1700, -i * 900);
      expect(Number.isInteger(b)).toBe(true);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(hoth.biomes.length);
    }
  });

  it('is finite on every planet', () => {
    for (const p of PLANETS) {
      const g = planetField(planetSpecOf(p.id));
      for (const [x, z] of [[0, 0], [5000, -3000], [-12000, 9000]]) expect(Number.isFinite(g.heightAt(x, z))).toBe(true);
    }
  });

  // every named world and every Expanse type: 2,000 points over 40 km, each
  // with a neighbour 4 m off; the ship at its slowest clears 60 m in 4 m
  const CASES = [...WORLDS.map((w) => [w.id, w.id]), ...Object.keys(TYPE_BIOMES).map((t) => [`expanse ${t}`, PLANETS.find((p) => p.type === t && p.id.startsWith('e:'))?.id])].filter(([, id]) => id);
  it.each(CASES)('%s: finite, within −200…1200 m, never more than 60 m in 4 m', (name, id) => {
    const spec = planetSpecOf(id);
    const g = planetField(spec);
    const rnd = seeded(7);
    const nearPoi = (x, z) => [...spec.pois, ...spec.pits.map((p) => ({ ...p, edge: 0 }))].some((q) => Math.hypot(x - q.at[0], z - q.at[1]) < q.r + (q.edge ?? 0) + 8);
    for (let i = 0; i < 2000; i++) {
      const x = (rnd() * 2 - 1) * 20000, z = (rnd() * 2 - 1) * 20000;
      const h = g.heightAt(x, z);
      expect(Number.isFinite(h)).toBe(true);
      expect(h, `${id} at ${x}, ${z}`).toBeGreaterThanOrEqual(-200);
      expect(h, `${id} at ${x}, ${z}`).toBeLessThanOrEqual(1200);
      if (nearPoi(x, z)) continue;
      const a = rnd() * Math.PI * 2;
      expect(Math.abs(g.heightAt(x + Math.cos(a) * 4, z + Math.sin(a) * 4) - h), `${id} at ${x}, ${z}`).toBeLessThanOrEqual(60);
    }
  });

  it('snaps the pixel world to its step, POIs and all', () => {
    const g = planetField(planetSpecOf('dot-matrix'));
    for (let i = 0; i < 200; i++) expect(Math.abs(g.heightAt(i * 131 - 9000, i * -77 + 4000) % 4)).toBe(0);
    expect(g.heightAt(1200, -800)).toBe(60);
  });

  it('digs the pits', () => {
    const g = planetField(planetSpecOf('tatooine'));
    expect(g.heightAt(2800, -1900)).toBeLessThan(g.heightAt(2800 + 120, -1900) - 25);
  });
});

describe('planetField on a round planet', () => {
  const spec = roundSpec({ type: 'ice', kind: 'ridges', radius: 18000 });
  const g = planetField(spec);
  const R = spec.round.radius;

  it('reads the sphere through the chart: its middle is the spot', () => {
    expect(g.heightAt(0, 0)).toBe(sphereField(spec).heightAt(spec.round.at));
  });

  it('comes round to the same ground after 2πR, any way it flies', () => {
    for (const a of [0, 0.7, 2, 3.9, 5.5]) for (const d of [10, 2500, 41000]) {
      const [ux, uz] = [Math.cos(a), Math.sin(a)];
      const k = d + 2 * Math.PI * R;
      expect(g.heightAt(ux * k, uz * k)).toBeCloseTo(g.heightAt(ux * d, uz * d), 6);
    }
  });

  it('is finite and gentle out to three turns, the far side included', () => {
    const rnd = seeded(13);
    for (let i = 0; i < 1500; i++) {
      const d = rnd() * 3 * Math.PI * R, a = rnd() * Math.PI * 2;
      const [x, z] = [Math.cos(a) * d, Math.sin(a) * d];
      const h = g.heightAt(x, z);
      expect(Number.isFinite(h)).toBe(true);
      const b = rnd() * Math.PI * 2;
      expect(Math.abs(g.heightAt(x + Math.cos(b) * 4, z + Math.sin(b) * 4) - h)).toBeLessThanOrEqual(60);
    }
    for (let k = 0; k < 16; k++) expect(Number.isFinite(g.heightAt(Math.cos(k) * Math.PI * R, Math.sin(k) * Math.PI * R))).toBe(true);
  });

  it('has no step across the far side: a line through the antipode, a metre at a time', () => {
    for (const a of [0.3, 2.2, 4.4]) {
      const [ux, uz] = [Math.cos(a), Math.sin(a)];
      let was = g.heightAt(ux * (Math.PI * R - 300), uz * (Math.PI * R - 300));
      for (let i = 1; i <= 600; i++) {
        const d = Math.PI * R - 300 + i;
        const h = g.heightAt(ux * d, uz * d);
        expect(Math.abs(h - was), `${a} at ${d}`).toBeLessThan(15);
        was = h;
      }
    }
  });

  it('names a biome from the sphere through the same chart', () => {
    const sf = sphereField(spec);
    const chart = chartOf(spec.round.at, R);
    const seen = new Set();
    for (let i = 0; i < 40; i++) {
      const [x, z] = [i * 1900 - 30000, i * -1300 + 20000];
      expect(g.biomeAt(x, z)).toBe(sf.biomeAt(chart.toDir(x, z)));
      seen.add(g.biomeAt(x, z));
    }
    // (more than one biome on the line, so the match isn't one index twice)
    expect(seen.size).toBeGreaterThan(1);
  });

  it('keys a round field by its spot, a plane one by its id', () => {
    expect(fieldKey(planetSpecOf('hoth'))).toBe('hoth');
    expect(fieldKey(spec)).not.toBe(fieldKey({ ...spec, round: { ...spec.round, at: [0, 1, 0] } }));
  });
});
