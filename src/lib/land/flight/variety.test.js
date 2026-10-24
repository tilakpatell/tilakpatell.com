import { describe, expect, it } from 'vitest';
import { CHARACTERS, TERRAIN } from './characters';
import { FAMILIES, SLOT_JITTER, colourDistance, dominantOf, varietyOf } from './variety';
import { SEEDED_EXPANSE, TYPE_LOOK } from './planetTables';
import { randomSystems } from './fixtures/generated';

const templateDominant = (type) => dominantOf(TYPE_LOOK[type].palette);

describe('the palette slots', () => {
  it('keep every slot of every family apart, jitter and all, within a family and across', () => {
    const all = Object.entries(FAMILIES).filter(([f]) => f !== 'ringed').flatMap(([f, { slots }]) => slots.map((s) => [f, s]));
    const gap = 1 + 2 * Math.hypot(SLOT_JITTER.hue / 15, SLOT_JITTER.light / 0.08);
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(colourDistance(all[i][1], all[j][1]), `${all[i][0]} ${all[i][1]} · ${all[j][0]} ${all[j][1]}`).toBeGreaterThanOrEqual(gap);
    for (const { slots } of Object.values(FAMILIES)) expect(slots.length).toBeGreaterThanOrEqual(8);
  });

  it('measures the hue round the circle', () => {
    expect(colourDistance([355, 0.5], [5, 0.5])).toBeCloseTo(10 / 15, 12);
    expect(colourDistance([0, 0.5], [0, 0.58])).toBeCloseTo(1, 12);
  });
});

describe('varietyOf', () => {
  const systems = randomSystems(500, 1);

  it('gives every pair of siblings a hue and lightness distance of at least 1 (500 planets)', () => {
    expect(systems.flat().length).toBeGreaterThanOrEqual(500);
    for (const rows of systems) {
      const v = rows.map(varietyOf);
      for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) expect(colourDistance(v[i].dominant, v[j].dominant), `${rows[i].id} ${rows[j].id}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('keeps a generated planet clear of its seeded siblings', () => {
    const seededIn = (sys) => SEEDED_EXPANSE.filter(([id]) => id.startsWith(`${sys}:`));
    for (const sys of ['e:1,0:1', 'e:1,0:2']) for (let j = 3; j < 7; j++) for (const type of ['rock', 'ice', 'desert', 'forest', 'lava', 'ocean', 'gas']) {
      const v = varietyOf({ id: `${sys}:${j}`, name: 'X', type, seed: String(1000n + BigInt(j)), system: { faction: null, traffic: 0, hazard: null } });
      for (const [id, t] of seededIn(sys)) expect(colourDistance(v.dominant, templateDominant(t)), `${sys}:${j} ${type} · ${id}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('is the planet’s alone: the same row gives the same variety, with no sibling read', () => {
    const row = systems[3][0];
    expect(varietyOf({ ...row })).toEqual(varietyOf(row));
    expect(varietyOf.length).toBe(1);
  });

  it('keeps each type in its family', () => {
    for (const row of systems.flat()) {
      const v = varietyOf(row);
      const box = FAMILIES[v.family].slots;
      expect(box.some((s) => colourDistance(s, v.dominant) <= Math.hypot(SLOT_JITTER.hue / 15, SLOT_JITTER.light / 0.08) + 1e-9), row.id).toBe(true);
    }
  });

  it('spreads the kinds: every character, weather, POI kind and flora family shows; about one in twenty is exotic', () => {
    const v = randomSystems(2000, 2).flat().map(varietyOf);
    const seen = (f) => new Set(v.map(f).flat().filter(Boolean));
    expect([...seen((x) => x.character?.kind)].sort()).toEqual([...CHARACTERS].sort());
    for (const w of ['none', 'rain', 'snow', 'dust', 'ash', 'spores']) expect(seen((x) => x.weather.kind).has(w), w).toBe(true);
    for (const k of ['ruins', 'wreck', 'outpost', 'monolith', 'signal']) expect(seen((x) => x.poiKinds).has(k), k).toBe(true);
    for (const f of ['forest', 'temperate', 'desert', 'ice', 'ocean', 'volcanic']) expect(seen((x) => x.flora?.family).has(f), f).toBe(true);
    const share = v.filter((x) => x.exotic).length / v.length;
    expect(share).toBeGreaterThan(0.03);
    expect(share).toBeLessThan(0.07);
  });

  it('takes a moon as its family, its siblings by moon index', () => {
    const moon = (k, type) => varietyOf({ id: `e:3,-2:1:0:${k}`, name: 'M', type, seed: String(77n + BigInt(k)), parent: 'e:3,-2:1:0' });
    expect(moon(0, 'rocky').family).toBe('rock');
    expect(moon(1, 'icy').family).toBe('ice');
    expect(colourDistance(moon(0, 'rocky').dominant, moon(1, 'rocky').dominant)).toBeGreaterThanOrEqual(1);
  });

  const many = randomSystems(2000, 3).flat();
  const all = many.map((row) => [row, varietyOf(row)]);

  it('draws the palette round its dominant colour, as near as #rrggbb allows', () => {
    const HEX = /^#[0-9a-f]{6}$/;
    const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    // the chroma of what dominantOf reads: an ocean's water, else the mix of low and high
    const chromaOf = (v) => {
      const c = v.family === 'ocean' ? rgb(v.water.colour) : rgb(v.palette.low).map((x, i) => (x + rgb(v.palette.high)[i]) / 2);
      return Math.max(...c) - Math.min(...c);
    };
    for (const [row, v] of all) {
      for (const [k, c] of Object.entries(v.palette)) expect(c, `${row.id} ${k}`).toMatch(HEX);
      const [h, l] = dominantOf(v.palette, v.family === 'ocean' ? v.water : null);
      expect(Math.abs(l - v.dominant[1]), row.id).toBeLessThan(0.01);
      // a channel half a step off moves a hue by up to 0.47° over the chroma,
      // so a pale or a dark planet's hue is only as near as that
      expect(colourDistance([h, l], [v.dominant[0], l]) * 15, row.id).toBeLessThan(1 + 0.47 / chromaOf(v));
    }
  });

  it('gives each family its own water, land, weather and life', () => {
    for (const [row, v] of all) {
      const gas = v.family === 'gas' || v.family === 'ringed';
      expect(v.family, row.id).toBe(row.type);
      if (gas) {
        expect(v, row.id).toMatchObject({ character: null, flora: null, fauna: null, water: null, poiKinds: [] });
        expect(v.weather.kind, row.id).toBe(v.exotic === 'glowing' ? 'spores' : 'none');
        continue;
      }
      const { kind, sea, peaks } = v.character;
      expect(sea).toBeGreaterThanOrEqual(TERRAIN[kind].sea[0]);
      expect(sea).toBeLessThanOrEqual(TERRAIN[kind].sea[1]);
      expect(peaks).toBeGreaterThanOrEqual(TERRAIN[kind].peaks[0]);
      expect(peaks).toBeLessThanOrEqual(TERRAIN[kind].peaks[1]);
      if (v.family === 'ocean') expect(v.water).toEqual({ kind: 'sea', colour: v.palette.accent });
      else if (v.family === 'forest') expect(v.water).toMatchObject({ kind: 'sea', colour: expect.stringMatching(/^#/) });
      else if (v.family === 'lava') expect(v.water).toEqual({ kind: 'lava' });
      else expect(v.water, row.id).toBe(null);
      expect(v.poiKinds.length).toBeLessThanOrEqual(3);
      expect(new Set(v.poiKinds).size).toBe(v.poiKinds.length);
      expect(v.fauna.plans.length).toBeGreaterThanOrEqual(1);
      expect(new Set(v.fauna.plans.map((p) => p.body)).size).toBe(v.fauna.plans.length);
      for (const p of v.fauna.plans) expect([v.palette.rock, v.palette.accent]).toContain(p.tint);
      if (v.exotic === 'glowing') expect(v.weather.kind).toBe('spores');
    }
  });

  it('puts its rings and moons in its sky, and the sky in its palette', () => {
    for (const [row, v] of all) {
      expect(v.sky).toMatchObject({ rings: row.rings, moons: row.moons, low: v.palette.skyLow, high: v.palette.skyHigh });
      expect(v.sky.haze).toBeGreaterThanOrEqual(0);
      expect(v.sky.clouds).toBeLessThanOrEqual(1);
    }
    expect(varietyOf({ id: 'e:3,-2:1:0:0', type: 'rocky', seed: '5', parent: 'e:3,-2:1:0' }).sky).toMatchObject({ rings: false, moons: 0 });
  });

  it('is plain data, the same from either case of its id', () => {
    for (const [row, v] of all.slice(0, 200)) {
      expect(JSON.parse(JSON.stringify(v))).toEqual(v);
      expect(varietyOf({ ...row, id: row.id.toUpperCase() })).toEqual(v);
    }
  });

  it('reads its system for its places only, and a held or pirate system for more outposts and wrecks', () => {
    const quiet = { faction: null, traffic: 0, hazard: null };
    let outposts = 0;
    let wrecks = 0;
    let held = 0;
    let pirate = 0;
    for (const [row, v] of all.slice(0, 600)) {
      const calm = varietyOf({ ...row, system: quiet });
      expect({ ...calm, poiKinds: null }).toEqual({ ...v, poiKinds: null });
      outposts += calm.poiKinds.includes('outpost');
      wrecks += calm.poiKinds.includes('wreck');
      held += varietyOf({ ...row, system: { ...quiet, faction: { id: 'empire' } } }).poiKinds.includes('outpost');
      pirate += varietyOf({ ...row, system: { ...quiet, hazard: 'pirates' } }).poiKinds.includes('wreck');
    }
    expect(held).toBeGreaterThan(outposts);
    expect(pirate).toBeGreaterThan(wrecks);
  });

  it('has no variety for a type no family knows, and never throws', () => {
    expect(varietyOf({ id: 'e:3,-2:1:0', type: 'plasma', seed: '9' })).toBe(null);
    expect(() => varietyOf({ id: 'nonsense', type: 'rock', seed: '9' })).not.toThrow();
  });
});
