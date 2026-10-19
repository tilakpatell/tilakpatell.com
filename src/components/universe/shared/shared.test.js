import { describe, expect, it } from 'vitest';
import * as online from './online';
import * as flying from './flying';
import * as room from './room';
import * as hangar from './hangar';
import * as wallet from './wallet';
import * as powerBar from './powerBar';
import * as fit from './fit';
import * as space from './space';

// The universe's face: exactly these names and nothing else
const FACE = [
  [online, ['STALE_MS', 'cleanName', 'createLimiter']],
  [flying, ['BUILT_KINDS', 'POWERS', 'armsView', 'arsenalOf', 'blastPunch', 'chargeFor', 'createArmory', 'createGalaxyPowers', 'createPowerTiles', 'createPowers', 'createRounds', 'createUniqueArms', 'fan', 'gainPower', 'picksFor', 'powerOn', 'powersView', 'pressPower', 'retunePowers', 'steer', 'stepPowers', 'turnToward']],
  [room, ['joinAsVisitor']],
  [hangar, ['LINES', 'POWERS', 'POWER_ICONS', 'POWER_KEYS', 'SHIP_WEAPONS', 'SKILL_NODES', 'STOCK_LOADOUT', 'ShipyardBody', 'armsView', 'arsenalOf', 'createArmory', 'crewById', 'picksFor', 'powersOf', 'useYard']],
  [wallet, ['EARN', 'LEVELS', 'TITLES', 'createPayLedger', 'tellSkills', 'useEarn', 'useEconomy']],
  [powerBar, ['PowerBar']],
  [fit, ['statsOf', 'useShipyardPage']],
  [space, ['PLACES', 'SECTORS', 'SECTOR_RADIUS', 'sectorOf']],
];

describe('universe/shared', () => {
  it.each(FACE.map(([mod, names], i) => [i, mod, names]))('face %i lends exactly its names', (_, mod, names) => {
    expect(Object.keys(mod).sort()).toEqual([...names].sort());
    for (const n of names) expect(['function', 'object', 'number']).toContain(typeof mod[n]);
  });
});
