import { describe, expect, it } from 'vitest';
import * as online from './online';
import * as flying from './flying';
import * as room from './room';
import * as hangar from './hangar';

// The universe's face: exactly these names and nothing else
const FACE = [
  [online, ['STALE_MS', 'cleanName', 'createLimiter']],
  [flying, ['BUILT_KINDS', 'armsView', 'arsenalOf', 'chargeFor', 'createArmory', 'createGalaxyPowers', 'createRounds', 'fan', 'turnToward']],
  [room, ['joinAsVisitor']],
  [hangar, ['LEVELS', 'LINES', 'POWERS', 'POWER_ICONS', 'POWER_KEYS', 'SHIP_WEAPONS', 'STOCK_LOADOUT', 'ShipyardBody', 'TITLES', 'armsView', 'arsenalOf', 'createArmory', 'crewById', 'powersOf', 'useEconomy']],
];

describe('universe/shared', () => {
  it.each(FACE.map(([mod, names], i) => [i, mod, names]))('face %i lends exactly its names', (_, mod, names) => {
    expect(Object.keys(mod).sort()).toEqual([...names].sort());
    for (const n of names) expect(['function', 'object', 'number']).toContain(typeof mod[n]);
  });
});
