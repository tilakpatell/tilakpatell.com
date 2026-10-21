import { describe, expect, it } from 'vitest';
import * as castle from './castle';

// Hogwarts' face: exactly these names and nothing else, so a world that
// reads Hogwarts through it knows what it may lean on
const FACE = [[castle, ['CASTLE_SIZE', 'castleParts']]];

describe('hogwarts/shared', () => {
  it.each(FACE.map(([mod, names], i) => [i, mod, names]))('face %i lends exactly its names', (_, mod, names) => {
    expect(Object.keys(mod).sort()).toEqual([...names].sort());
    for (const n of names) expect(['function', 'object']).toContain(typeof mod[n]);
  });
});
