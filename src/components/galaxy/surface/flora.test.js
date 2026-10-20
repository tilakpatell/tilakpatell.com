import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BIOMES, floraNames, floraRows, floraTint } from './flora';

const MANIFEST = JSON.parse(readFileSync(new URL('../../../../public/kit/naturemega/index.json', import.meta.url), 'utf8'));
const plains = (flora = {}, more = {}) => ({ flora: { biome: 'plains', ...flora }, reach: 590, ground: {}, grass: {}, ...more });
const band = (rows, b) => rows.filter((r) => r.band === b);
const total = (rows) => rows.reduce((s, r) => s + r.n, 0);

describe('floraRows: a world’s cover from its biome', () => {
  it('lays a plains world’s three bands from its recipe, counts by density, every row a kit model', () => {
    const rows = floraRows(plains());
    const cover = band(rows, 'cover');
    expect(total(cover)).toBeCloseTo(2200, -2);
    expect(total(band(rows, 'mid'))).toBeCloseTo(300, -1);
    expect(total(band(rows, 'trees'))).toBeCloseTo(120, -1);
    expect(rows.every((r) => /^kit:naturemega\/\S+$/.test(r.model))).toBe(true);
    expect(band(rows, 'trees').every((r) => r.clear === 25 && r.solid === true && r.within[0] === 60 && r.within[1] === 560)).toBe(true);
    expect(band(rows, 'mid').every((r) => r.solid === true && r.within[0] === 20 && r.within[1] === 320)).toBe(true);
    expect(cover.every((r) => r.solid === false && r.flat === 0.86 && r.shadow === false)).toBe(true);
    expect(rows.filter((r) => r.band !== 'cover').some((r) => 'shadow' in r)).toBe(false);
  });

  it('lays each cover model once: the small things near, the rest out to 160 m', () => {
    const cover = band(floraRows(plains()), 'cover');
    const models = cover.map((r) => r.model);
    expect(new Set(models).size).toBe(models.length);
    expect(cover.every((r) => r.within[0] === 4 && (r.within[1] === 60 || r.within[1] === 160))).toBe(true);
    expect(cover.filter((r) => r.within[1] === 60).length).toBeGreaterThan(0);
  });

  it('lays the cover thicker near than far: one an about 12 m² inside 60 m, one an about 60 m² out to 160 m', () => {
    const cover = band(floraRows(plains()), 'cover');
    const area = ([r0, r1]) => Math.PI * (r1 * r1 - r0 * r0);
    // (a row spread evenly over its ring: its share inside 60 m by area)
    const inside = cover.reduce((s, r) => s + r.n * Math.min(1, area([4, 60]) / area(r.within)), 0);
    const outside = total(cover) - inside;
    expect(area([4, 60]) / inside).toBeGreaterThan(8);
    expect(area([4, 60]) / inside).toBeLessThan(15);
    expect(area([60, 160]) / outside).toBeGreaterThan(45);
    expect(area([60, 160]) / outside).toBeLessThan(80);
  });

  it('halves at density 0.5 and lays no trees when told not to', () => {
    expect(total(band(floraRows(plains({ density: 0.5 })), 'cover'))).toBeCloseTo(1100, -2);
    expect(band(floraRows(plains({ trees: false })), 'trees')).toEqual([]);
  });

  it('keeps the trees inside the world’s reach', () => {
    const rows = floraRows(plains({}, { reach: 400 }));
    expect(band(rows, 'trees').every((r) => r.within[1] === 400)).toBe(true);
    // (a raw site with none: terrain.js's REACH)
    const { reach, ...raw } = plains();
    expect(reach).toBe(590);
    expect(band(floraRows(raw), 'trees').every((r) => r.within[1] === 560)).toBe(true);
  });

  it('lays nothing on a world with no ground, and nothing for the none biome', () => {
    expect(floraRows(plains({}, { noGround: true }))).toEqual([]);
    expect(floraRows({ flora: { biome: 'none' }, ground: {} })).toEqual([]);
    expect(floraRows({ ground: {} })).toEqual([]);
  });

  it('lays cover on a world with ground and no grass', () => {
    const { grass, ...bare } = plains();
    expect(grass).toBeTruthy();
    expect(total(band(floraRows(bare), 'cover'))).toBeCloseTo(2200, -2);
  });

  it('keeps out of the water: every row carries `above` when the site has water', () => {
    const rows = floraRows(plains({}, { water: { level: -3 } }));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.above === 0.4 && r.flat === 0.86)).toBe(true);
    expect(floraRows(plains()).some((r) => 'above' in r)).toBe(false);
  });

  it('lays a band of cover and mid round each place past the landing’s rings, outside its flat', () => {
    const places = [
      { id: 'far', at: [240, -60], r: 70, flat: { r: 50 } },
      { id: 'unflat', at: [-200, 220], r: 50 },
      { id: 'near', at: [60, 40], r: 30 },
    ];
    const rows = floraRows(plains({}, { places }));
    const round = (id) => rows.filter((r) => r.at === places.find((p) => p.id === id).at);
    expect(round('far').map((r) => r.band)).toEqual([...BIOMES.plains.cover.map(() => 'cover'), ...BIOMES.plains.mid.map(() => 'mid')]);
    expect(round('far').every((r) => r.within[0] === 50 && r.within[1] === 110)).toBe(true);
    expect(round('unflat').every((r) => r.within[0] === 30 && r.within[1] === 90)).toBe(true);
    // (one an about 70 m² of cover, 500 of mid, over the band)
    const area = Math.PI * (110 ** 2 - 50 ** 2);
    expect(total(band(round('far'), 'cover'))).toBeCloseTo(area / 70, -1);
    expect(total(band(round('far'), 'mid'))).toBeCloseTo(area / 500, -1);
    expect(band(round('far'), 'cover').every((r) => r.solid === false && r.shadow === false)).toBe(true);
    // (the landing's own rings reach a place near it)
    expect(round('near')).toEqual([]);
    // (the bands round the landing are as they were)
    expect(total(band(rows.filter((r) => !r.at), 'cover'))).toBeCloseTo(2200, -2);
  });

  it('gives the pebbles a world’s rock colour unless it gives them their own', () => {
    const rock = { recolour: '#6a625a' };
    expect(floraTint({ flora: { biome: 'tundra', tint: { Rocks: rock } } }).PathRocks).toEqual(rock);
    expect(floraTint({ flora: { biome: 'tundra', tint: { Rocks: rock, PathRocks: '#ffffff' } } }).PathRocks).toBe('#ffffff');
    expect(floraTint({ flora: { biome: 'ash' } }).PathRocks).toEqual(BIOMES.ash.tint.PathRocks);
  });

  it('stands in a built kind for each row, for when the kit won’t load', () => {
    const rows = floraRows(plains());
    const kindOf = (name) => rows.find((r) => r.model === `kit:naturemega/${name}`).kind;
    expect(kindOf('Rock_Medium_1')).toBe('rock');
    expect(kindOf('Bush_Common')).toBe('bush');
    expect(kindOf('Pebble_Round_2')).toBe('stones');
    expect(kindOf('Flower_2_Single')).toBe('flower');
    expect(kindOf('CommonTree_1')).toBe('commontree');
  });

  it('gives a tree row its crown, the ground map’s shade under it', () => {
    const trees = band(floraRows(plains()), 'trees');
    expect(trees.every((r) => r.canopy === 3.5)).toBe(true);
    expect(band(floraRows(plains()), 'cover').some((r) => 'canopy' in r)).toBe(false);
  });

  it('sizes every model to stand beside a person: grass to the knee, a flower below the hip', () => {
    for (const r of floraRows(plains())) {
      const h = MANIFEST.models[r.model.split('/')[1]].height;
      const [lo, hi] = r.scale;
      expect(lo).toBeLessThanOrEqual(hi);
      if (/^Grass_|^Flower_|^Clover_/.test(r.model.split('/')[1])) expect(h * hi).toBeLessThan(1);
    }
  });
});

describe('floraTint', () => {
  it('tints: the biome’s defaults under the site’s own', () => {
    const was = BIOMES.plains.tint;
    BIOMES.plains.tint = { Grass: '#000000', Flowers: '#ffeedd' };
    try {
      expect(floraTint(plains({ tint: { Grass: '#c6ad72' } }))).toEqual({ Grass: '#c6ad72', Flowers: '#ffeedd' });
    } finally {
      BIOMES.plains.tint = was;
    }
  });

  it('greens the kit’s red-leaved bush on the plains, as Naboo’s meadows are green', () => {
    const c = floraTint(plains()).Leaves_TwistedTree.recolour;
    const [r, g] = [1, 3].map((i) => parseInt(c.slice(i, i + 2), 16));
    expect(g).toBeGreaterThan(r);
  });

  it('is null for a world with no flora or nothing to tint', () => {
    expect(floraTint({ ground: {} })).toBeNull();
    expect(floraTint({ flora: { biome: 'none' } })).toBeNull();
  });

  it('names only materials the manifest has, in every biome', () => {
    for (const b of Object.values(BIOMES)) for (const name of Object.keys(b.tint ?? {})) expect(MANIFEST.materials[name], name).toBeTruthy();
  });
});

describe('floraNames', () => {
  it('names every model it uses from the manifest', () => {
    for (const biome of Object.keys(BIOMES)) {
      const names = floraNames(floraRows({ flora: { biome }, reach: 590, ground: {} }));
      for (const name of names) expect(MANIFEST.models[name], `${biome}: ${name}`).toBeTruthy();
    }
    expect(floraNames(floraRows(plains())).has('CommonTree_1')).toBe(true);
  });

  it('ignores a row that isn’t the kit’s', () => {
    expect([...floraNames([{ kind: 'rock', n: 3 }, { kind: 'x', model: 'kit:naturemega/Fern_1' }])]).toEqual(['Fern_1']);
  });

  it('every biome’s shares sum to one a band', () => {
    for (const [id, b] of Object.entries(BIOMES))
      for (const list of [b.near, b.cover, b.mid, b.trees]) if (list.length) expect(list.reduce((s, [, share]) => s + share, 0), id).toBeCloseTo(1, 2);
  });
});
