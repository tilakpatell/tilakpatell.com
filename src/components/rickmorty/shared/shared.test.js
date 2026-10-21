import { describe, expect, it } from 'vitest';
import * as wardrobe from './wardrobe';

// Rick and Morty's face: exactly these names and nothing else, so a part of
// the site that reads it (the Hangar's Crew) knows what it may lean on
const FACE = [[wardrobe, ['CASTS', 'NAME', 'WardrobeControls', 'WardrobeStage', 'castOfCrew', 'useLooks']]];

describe('rickmorty/shared', () => {
  it.each(FACE.map(([mod, names], i) => [i, mod, names]))('face %i lends exactly its names', (_, mod, names) => {
    expect(Object.keys(mod).sort()).toEqual([...names].sort());
    for (const n of names) expect(['function', 'object']).toContain(typeof mod[n]);
  });
});
