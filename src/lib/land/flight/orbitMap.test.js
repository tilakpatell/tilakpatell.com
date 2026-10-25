import { describe, expect, it } from 'vitest';
import { ORBIT_MAP_SIZE, PLANE_WINDOW, bakeOrbitMap, groundColour, orbitMapSize } from './orbitMap';
import { planetField } from './field';
import { chartedAt } from './generated';
import { SLOPE_STEP } from './sphereField';
import { dirOfUv } from './sphere';
import { planetSpecOf as specWith } from './planetSpec';
import { MOONS, lookupOf, randomSystems } from './fixtures/generated';
import { PLANETS, planetSpecOf } from './fixtures/expanse.js';

const rows = randomSystems(40, 6).flat();
const lookup = lookupOf(rows);
const round = rows.filter((r) => ['rock', 'ice', 'ocean', 'forest'].includes(r.type)).slice(0, 4).map((r) => specWith(r.id, { expanse: lookup }));

describe('bakeOrbitMap', () => {
  it('is 256 × 128 RGBA unless asked, and 512 × 256 on high and up', () => {
    const m = bakeOrbitMap(round[0], { width: 32, height: 16 });
    expect(m.rgba).toHaveLength(32 * 16 * 4);
    expect(m.biome).toHaveLength(32 * 16);
    expect(ORBIT_MAP_SIZE).toEqual({ low: [256, 128], mid: [256, 128], high: [512, 256], ultra: [512, 256] });
    expect(orbitMapSize('high')).toEqual({ width: 512, height: 256 });
    expect(orbitMapSize('nonsense')).toEqual({ width: 256, height: 128 });
  });

  it('is the same bytes twice', () => {
    expect(bakeOrbitMap(round[1], { width: 48, height: 24 })).toEqual(bakeOrbitMap(round[1], { width: 48, height: 24 }));
  });

  it('shows what the ground shows: each texel is the flight’s ground at the chart’s middle there', () => {
    const W = 64, H = 32;
    for (const spec of round) {
      const m = bakeOrbitMap(spec, { width: W, height: H });
      for (let k = 0; k < 12; k++) {
        const i = (k * 37) % W, j = (k * 11 + 3) % H;
        const g = planetField(chartedAt(spec, dirOfUv((i + 0.5) / W, (j + 0.5) / H)));
        const s = SLOPE_STEP;
        const gx = (g.heightAt(s, 0) - g.heightAt(-s, 0)) / (2 * s), gz = (g.heightAt(0, s) - g.heightAt(0, -s)) / (2 * s);
        const want = groundColour(spec, { h: g.heightAt(0, 0), slope: 1 - 1 / Math.hypot(1, gx, gz) });
        const at = (j * W + i) * 4;
        expect([...m.rgba.slice(at, at + 3)], `${spec.id} ${i},${j}`).toEqual(want.rgb);
        expect(m.rgba[at + 3]).toBe(want.water ? 0 : 255);
        expect(m.biome[j * W + i]).toBe(g.biomeAt(0, 0));
      }
    }
  });

  it('has no seam where it wraps: its last column meets its first as any two neighbours meet', () => {
    const W = 128, H = 64;
    const m = bakeOrbitMap(round[2], { width: W, height: H });
    const px = (i, j) => [...m.rgba.slice((j * W + i) * 4, (j * W + i) * 4 + 3)];
    const apart = (a, b) => Math.max(...a.map((v, c) => Math.abs(v - b[c])));
    let inner = 0, wrap = 0;
    for (let j = 0; j < H; j++) {
      for (let i = 1; i < W; i++) inner = Math.max(inner, apart(px(i - 1, j), px(i, j)));
      wrap = Math.max(wrap, apart(px(W - 1, j), px(0, j)));
    }
    expect(wrap).toBeLessThanOrEqual(inner + 8);
  });

  it('bakes every kind of spec and never throws: the fifty, a moon, a gas giant', () => {
    const gas = specWith(rows.find((r) => r.type === 'gas').id, { expanse: lookup });
    const moon = specWith(MOONS[0].id, { expanse: MOONS });
    for (const spec of [...PLANETS.map((p) => planetSpecOf(p.id)), moon, gas]) {
      const m = bakeOrbitMap(spec, { width: 16, height: 8 });
      expect(m.rgba, spec.id).toHaveLength(16 * 8 * 4);
    }
  });

  it('shows a plane planet as a window of its plane round the flight’s start, 40 km across', () => {
    const W = 32, H = 16;
    for (const id of ['hoth', 'scarif', 'e:1,0:0:4']) {
      const spec = planetSpecOf(id);
      const m = bakeOrbitMap(spec, { width: W, height: H });
      const g = planetField(spec);
      for (let k = 0; k < 8; k++) {
        const i = (k * 13) % W, j = (k * 5 + 2) % H;
        const x = ((i + 0.5) / W - 0.5) * PLANE_WINDOW, z = ((j + 0.5) / H - 0.5) * (PLANE_WINDOW / 2);
        const s = SLOPE_STEP;
        const gx = (g.heightAt(x + s, z) - g.heightAt(x - s, z)) / (2 * s), gz = (g.heightAt(x, z + s) - g.heightAt(x, z - s)) / (2 * s);
        const want = groundColour(spec, { h: g.heightAt(x, z), slope: 1 - 1 / Math.hypot(1, gx, gz) });
        const at = (j * W + i) * 4;
        expect([...m.rgba.slice(at, at + 4)], `${id} ${i},${j}`).toEqual([...want.rgb, want.water ? 0 : 255]);
        expect(m.biome[j * W + i]).toBe(g.biomeAt(x, z));
      }
    }
    expect(PLANE_WINDOW).toBe(40000);
  });

  it('bands a gas giant in its own colours, with no biome and no water', () => {
    const gas = rows.filter((r) => r.type === 'gas' || r.type === 'ringed').slice(0, 3).map((r) => specWith(r.id, { expanse: lookup }));
    for (const spec of [...gas, planetSpecOf('bespin')]) {
      const m = bakeOrbitMap(spec, { width: 32, height: 64 });
      expect(m.biome.every((b) => b === 0), spec.id).toBe(true);
      expect(m.rgba.filter((_, k) => k % 4 === 3).every((a) => a === 255), spec.id).toBe(true);
      // bands run across the map: one row is near enough one colour, a column isn't
      const colours = (texels) => new Set(texels.map((t) => [...m.rgba.slice(t * 4, t * 4 + 3)].join()));
      const column = colours(Array.from({ length: 64 }, (_, j) => j * 32 + 5));
      expect(column.size, spec.id).toBeGreaterThan(8);
    }
  });

  it('answers null for no spec, and a size it can’t use with the usual one', () => {
    expect(bakeOrbitMap(null)).toBeNull();
    expect(bakeOrbitMap(undefined)).toBeNull();
    const m = bakeOrbitMap(planetSpecOf('bespin'), { width: -4, height: Number.NaN });
    expect([m.width, m.height]).toEqual([256, 128]);
    expect(m.rgba).toHaveLength(256 * 128 * 4);
  });
});

describe('groundColour', () => {
  const site = (palette, more = {}) => ({ palette: { low: '#000000', high: '#ffffff', accent: '#ff0000' }, ground: { palette }, water: null, ...more });
  const plain = { low: '#204060', high: '#a0c0e0', rock: '#808080', accent: '#ff0000', hLow: 0, hHigh: 100, rockAt: 0.4, accentCover: 0 };

  it('is the low colour below hLow and the high above hHigh, on flat dry ground', () => {
    expect(groundColour(site(plain), { h: -5, slope: 0 })).toEqual({ rgb: [0x20, 0x40, 0x60], water: false });
    expect(groundColour(site(plain), { h: 500, slope: 0 })).toEqual({ rgb: [0xa0, 0xc0, 0xe0], water: false });
  });

  it('mixes in linear light, as the ground’s shader does', () => {
    // halfway from black to white in linear light is sRGB 188, not 128
    expect(groundColour(site({ ...plain, low: '#000000', high: '#ffffff' }), { h: 50, slope: 0 }).rgb).toEqual([188, 188, 188]);
  });

  it('turns to its rock, a shade darker, on a cliff, and lays its accent over a share of the ground', () => {
    expect(groundColour(site({ ...plain, rock: '#ffffff' }), { h: -5, slope: 0.9 }).rgb).toEqual([253, 253, 253]);
    expect(groundColour(site({ ...plain, low: '#000000', accent: '#ffffff', accentCover: 1 }), { h: -5, slope: 0 }).rgb).toEqual([188, 188, 188]);
  });

  it('darkens toward the water’s edge where the ground is wet', () => {
    const wet = site({ ...plain, low: '#ffffff', high: '#ffffff', wet: { level: 0, band: 2, color: '#000000' } });
    const at = (h) => groundColour(wet, { h, slope: 0 }).rgb[0];
    expect(at(0)).toBeLessThan(at(1));
    expect(at(1)).toBeLessThan(at(2));
    expect(at(2)).toBe(255);
  });

  it('shows the water over the ground under its level, and says so', () => {
    const sea = site(plain, { water: { kind: 'sea', level: 0 }, palette: { low: '#000000', high: '#ffffff', accent: '#1f5a6e' } });
    const under = groundColour(sea, { h: -10, slope: 0 });
    expect(under.water).toBe(true);
    expect(under.rgb).not.toEqual([0x20, 0x40, 0x60]);
    expect(groundColour(sea, { h: 0, slope: 0 })).toEqual({ rgb: [0x20, 0x40, 0x60], water: false });
    // lava glows: much redder than the ground under it
    const lava = groundColour(site(plain, { water: { kind: 'lava', level: 0 }, palette: { accent: '#3a0c02' } }), { h: -10, slope: 0 });
    expect(lava.water).toBe(true);
    expect(lava.rgb[0]).toBeGreaterThan(200);
    // a kind with no sheet (Bespin's clouds) is no water
    expect(groundColour(site(plain, { water: { kind: 'clouds', level: 0 } }), { h: -10, slope: 0 })).toEqual({ rgb: [0x20, 0x40, 0x60], water: false });
  });

  it('reads the planet’s own palette, 0 to 120 m, where it has no ground look', () => {
    const bare = { palette: { low: '#000000', high: '#ffffff', rock: '#000000', accent: '#000000' }, ground: null, water: null };
    expect(groundColour(bare, { h: 60, slope: 0 }).rgb).toEqual([188, 188, 188]);
  });
});
