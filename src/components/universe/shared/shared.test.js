import { describe, expect, it } from 'vitest';
import * as online from './online';
import * as flying from './flying';
import * as room from './room';
import * as space from './space';

// The universe's face: exactly these names and nothing else
const FACE = [
  [online, ['STALE_MS', 'cleanName', 'createLimiter']],
  [flying, ['BUILT_KINDS', 'turnToward']],
  [room, ['joinAsVisitor']],
  [space, ['PLACES', 'SECTORS', 'SECTOR_RADIUS', 'sectorOf']],
];

describe('universe/shared', () => {
  it.each(FACE.map(([mod, names], i) => [i, mod, names]))('face %i lends exactly its names', (_, mod, names) => {
    expect(Object.keys(mod).sort()).toEqual([...names].sort());
    for (const n of names) expect(['function', 'object', 'number']).toContain(typeof mod[n]);
  });
});
