import { describe, expect, it } from 'vitest';
import kit from '../src/data/bf2017/unitKit.json';
import heroes from '../src/data/bf2017/heroes.json';
import reinforcements from '../src/data/bf2017/reinforcements.json';
import { checkSources } from './lib/bf2017-rulebook.mjs';

// The file scripts/bf2017-abilities-units.mjs writes, as the sim reads it.
describe('unitKit.json', () => {
  it('has a kit for every hero and reinforcement, each of its abilities with a kind', () => {
    for (const u of [...Object.values(heroes.rows), ...Object.values(reinforcements.rows)]) {
      expect(kit.kits[u.id]?.abilities).toEqual(u.abilities.map((a) => a.id));
      for (const a of u.abilities) expect(kit.abilities[a.id]?.kind, a.id).toBeTruthy();
    }
  });

  it('names the record of every number', () => {
    expect(checkSources(kit)).toEqual([]);
  });

  it('keeps every affector an ability applies', () => {
    for (const a of Object.values(kit.abilities)) for (const ap of a.applies) expect(kit.affectors[ap.affector], ap.affector).toBeTruthy();
  });
});
