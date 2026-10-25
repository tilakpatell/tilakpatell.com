import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FROM, SIDE_EFFECT, uncomment } from '../../../../scripts/health/graph.mjs';
import * as gen from './gen';
import * as orbits from './orbits';
import * as extent from '../gen/extent';
import * as genOrbits from '../gen/orbits';
import * as seed from '../gen/seed';
import * as space from '../gen/space';
import * as stations from '../gen/stations';
import * as systems from '../gen/systems';
import * as tables from '../gen/tables';
import * as things from '../gen/things';

// The universe's two faces on the expanse's generator: exactly these names,
// each its source's own. (A file apart from shared.test.js, which pins the
// levels' face.)
const GEN = [
  'UNIVERSE', 'universeOf', 'fullSector', 'placeOf', 'placeIn', 'orbitAt', 'moonAt', 'bodiesAt', 'spaceTime',
  'systemReach', 'THING_BASE', 'THING_CELLS', 'THING_NEAR', 'THING_KINDS', 'SECTOR_EXTRAS', 'thingRow', 'WONDER_KINDS',
  'STATION_BASE', 'stationsOf', 'extentOf',
];
const LIGHT = ['orbitAt', 'moonAt', 'spaceTime', 'extentOf'];
const FACE = [
  [gen, [space, seed, genOrbits, systems, things, tables, stations, extent], GEN],
  [orbits, [genOrbits, extent], LIGHT],
];

const source = (p) => uncomment(readFileSync(new URL(p, import.meta.url), 'utf8'));
// every module a file names in an import or export … from, or imports for its side effects
const importsOf = (p) => {
  const code = source(p);
  return [...code.matchAll(FROM), ...code.matchAll(SIDE_EFFECT)].map((m) => m[2]).sort();
};

describe('expanse/shared, the universe’s faces', () => {
  it.each(FACE.map(([mod, from, names], i) => [i, mod, from, names]))('face %i lends exactly its names, as they are', (_, mod, from, names) => {
    expect(Object.keys(mod).sort()).toEqual([...names].sort());
    for (const n of names) {
      const own = from.filter((src) => n in src);
      expect(own.length, n).toBeGreaterThan(0);
      for (const src of own) expect(mod[n], n).toBe(src[n]);
    }
  });
  it('keeps the light face light: two sources, neither of which imports anything', () => {
    expect([...new Set(importsOf('./orbits.js'))]).toEqual(['../gen/extent', '../gen/orbits']);
    expect(importsOf('../gen/orbits.js')).toEqual([]);
    expect(importsOf('../gen/extent.js')).toEqual([]);
  });
  it('lends the generator from its own files only, never the drawn Expanse, three.js or React', () => {
    const from = importsOf('./gen.js');
    expect(from.length).toBeGreaterThan(0);
    expect(from.filter((p) => !p.startsWith('../gen/'))).toEqual([]);
    expect(from.filter((p) => /scene|three|react/.test(p))).toEqual([]);
  });
});
