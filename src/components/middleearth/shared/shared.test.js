import { describe, expect, it } from 'vitest';
import * as travellers from './travellers';
import * as ghosts from './ghosts';
import * as ghostsOf from './ghostsOf';
import * as ghostNodes from './ghostNodes';

// Middle-earth's face: exactly these names and nothing else
const FACE = [
  [travellers, ['useTravellers']],
  [ghosts, ['ALLY_HALO', 'GHOST_HALO', 'createGhosts']],
  [ghostsOf, ['createGhostsOf']],
  [ghostNodes, ['ghostNodeMaterial']],
];

describe('middleearth/shared', () => {
  it.each(FACE.map(([mod, names], i) => [i, mod, names]))('face %i lends exactly its names', (_, mod, names) => {
    expect(Object.keys(mod).sort()).toEqual([...names].sort());
    for (const n of names) expect(['function', 'object', 'number']).toContain(typeof mod[n]);
  });
});
