import { describe, expect, it } from 'vitest';
import * as levels from './levels';
import * as own from '../scene/levels';
import * as space from './space';
import * as expanse from '../scene/expanse';
import * as seed from '../gen/seed';
import * as sector from '../gen/sector';
import * as systems from '../gen/systems';
import * as orbits from '../gen/orbits';

// The Expanse's face: exactly these names and nothing else
const FACE = [
  [levels, own, ['BRIGHT_AT', 'FADE', 'FAR', 'REAL_LEAST', 'REAL_REACHES', 'SPECK_LEAST', 'beyondFade', 'discPx', 'levelWeights', 'realAt', 'speckBright']],
  [space, { ...expanse, ...seed, ...sector, ...systems, ...orbits }, ['UNIVERSE', 'addBodies', 'createExpanse', 'farRoom', 'makeSector', 'moonAt', 'orbitAt', 'spaceTime']],
];

describe('expanse/shared', () => {
  it.each(FACE.map(([mod, from, names], i) => [i, mod, from, names]))('face %i lends exactly its names, as they are', (_, mod, from, names) => {
    expect(Object.keys(mod).sort()).toEqual([...names].sort());
    for (const n of names) expect(mod[n]).toBe(from[n]);
  });
});
