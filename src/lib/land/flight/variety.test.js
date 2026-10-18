import { describe, expect, it } from 'vitest';
import { CHARACTERS } from './characters';
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
});
