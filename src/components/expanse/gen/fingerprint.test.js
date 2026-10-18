/* global process */
import { existsSync,readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRINTED, digest, plainSector } from './fixtures/fingerprint';
import { makeSector } from './sector';
import { UNIVERSE } from './seed';

const FILE = new URL('./fixtures/fingerprint.json', import.meta.url);
const today = () => Object.fromEntries(PRINTED.map(([sx, sz]) => {
  const s = makeSector(UNIVERSE, sx, sz);
  return [s.id, { systems: s.systems.length, wonders: s.wonders.length, sha256: digest(plainSector(s)) }];
}));

describe('the middle layer, fingerprinted', () => {
  it('pins 25 sectors, the seeded planets’ five first', () => {
    expect(PRINTED).toHaveLength(25);
    expect(PRINTED.slice(0, 5)).toEqual([[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1]]);
  });
  it('makeSector makes today’s sectors, field for field', () => {
    // (written once, from the generator as it was on main; never rewritten)
    if (!existsSync(FILE) && process.env.FINGERPRINT_WRITE) writeFileSync(FILE, `${JSON.stringify(today(), null, 2)}\n`);
    expect(today()).toEqual(JSON.parse(readFileSync(FILE, 'utf8')));
  });
});
