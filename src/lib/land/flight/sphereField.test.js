import { describe, expect, it } from 'vitest';
import { CLIMATE_SPHERE, SLOPE_STEP, sphereField } from './sphereField';
import { CHARACTERS } from './characters';
import { angleBetween, chartOf, dirOfLatLon, dirOfUv } from './sphere';
import { randomDirs, roundSpec } from './fixtures/generated';

const TYPES = ['rock', 'ice', 'desert', 'forest', 'lava', 'ocean'];

describe('sphereField', () => {
  it.each(TYPES.flatMap((type, i) => [[type, CHARACTERS[i]], [type, CHARACTERS[i + 2]]]))('%s, %s: finite, within −200…1200, never more than 60 m in 4 m', (type, kind) => {
    const spec = roundSpec({ type, kind });
    const f = sphereField(spec);
    for (const [i, d] of randomDirs(800, 5).entries()) {
      const h = f.heightAt(d);
      expect(h).toBeGreaterThanOrEqual(-200);
      expect(h).toBeLessThanOrEqual(1200);
      if (angleBetween(d, spec.pois[0].dir) * spec.round.radius < 240) continue;
      const n = chartOf(d, spec.round.radius).toDir(Math.cos(i) * 4, Math.sin(i) * 4);
      expect(Math.abs(f.heightAt(n) - h)).toBeLessThanOrEqual(60);
    }
  });

  it('has no seam where the map wraps nor at the poles', () => {
    const f = sphereField(roundSpec({ type: 'ice', kind: 'ridges' }));
    for (let i = 1; i < 200; i++) {
      const v = i / 200;
      expect(Math.abs(f.heightAt(dirOfUv(1 - 1e-9, v)) - f.heightAt(dirOfUv(1e-9, v)))).toBeLessThan(0.01);
    }
    for (const pole of [0, 1]) {
      const hs = Array.from({ length: 36 }, (_, k) => f.heightAt(dirOfUv(k / 36, pole === 0 ? 1e-6 : 1 - 1e-6)));
      expect(Math.max(...hs) - Math.min(...hs)).toBeLessThan(1);
    }
  });

  it('holds a POI flat at the land’s own height there', () => {
    const spec = roundSpec();
    const f = sphereField(spec);
    const at = spec.pois[0].dir;
    const level = f.heightAt(at);
    expect(f.heightAt(chartOf(at, spec.round.radius).toDir(110, 0))).toBeCloseTo(level, 6);
  });

  it('samples what it answers: sample(dir).h is heightAt(dir), its slope 0…1, its biome biomeAt(dir)', () => {
    const f = sphereField(roundSpec({ type: 'desert', kind: 'mesas' }));
    for (const d of randomDirs(50, 8)) {
      const s = f.sample(d);
      expect(s.h).toBe(f.heightAt(d));
      expect(s.slope).toBeGreaterThanOrEqual(0);
      expect(s.slope).toBeLessThan(1);
      expect(s.biome).toBe(f.biomeAt(d));
    }
    expect(SLOPE_STEP).toBe(8);
    expect(CLIMATE_SPHERE.frequency).toBe(1.6);
  });

  it('is colder at the poles than at the equator, on the whole', () => {
    const f = sphereField(roundSpec({ type: 'forest', kind: 'continents' }));
    const mean = (lat) => Array.from({ length: 72 }, (_, k) => f.climateAt(dirOfLatLon(lat, k * 5))[0]).reduce((a, b) => a + b) / 72;
    expect(mean(0)).toBeGreaterThan(mean(80) + 0.2);
  });
});
