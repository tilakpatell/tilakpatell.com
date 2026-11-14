import { describe, expect, it } from 'vitest';
import { THING_KINDS, UNIVERSE, fullSector, thingRow, traitsOf } from '../../expanse/shared/gen';
import { THING_CARDS, placeCard } from '../places/cards';
import { PLACE } from '../words';
import { CATALOGUE_CARDS } from './cards';

const s = fullSector(UNIVERSE, 1, 0, 0);
const rowsOf = (kind) => {
  const out = [];
  for (let i = 0; i < s.things.count; i++) if (THING_KINDS[s.things.kind[i]].kind === kind) out.push(thingRow(s, i));
  return out;
};

describe('lane 4a’s cards', () => {
  it('gives every lattice kind lane 3’s card, in the glossary’s words', () => {
    for (const { kind } of THING_KINDS) {
      expect(THING_CARDS[kind], kind).toBeDefined();
      expect(THING_CARDS[kind].type).toBe(PLACE.thing[kind]);
      expect(THING_CARDS[kind].about).toBe(PLACE.about[kind]);
    }
  });
  it('lands on a rocky rogue world, never on a gas one', () => {
    const rogues = rowsOf('rogue');
    const rocky = rogues.find((r) => traitsOf(r).land);
    const gas = rogues.find((r) => !traitsOf(r).land);
    expect(placeCard({ kind: 'thing', row: rocky, sector: s }).land).toBe(true);
    expect(placeCard({ kind: 'thing', row: gas, sector: s }).land).toBe(false);
    expect(placeCard({ kind: 'thing', row: rowsOf('rock')[0], sector: s }).land).toBe(false);
  });
  it('marks the four new kinds on the chart as dots', () => {
    for (const k of ['outpost', 'beacon', 'relay', 'monolith']) expect(CATALOGUE_CARDS[k].chart, k).toEqual({ shape: 'dot', priority: 20 });
  });
});
