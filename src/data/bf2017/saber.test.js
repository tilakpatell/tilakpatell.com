// The saber rulebook (scripts/bf2017-data.mjs saber): every number names its
// record (or is `hand`, with its line in NOTES.md), every saber hero the
// galaxy's roster fields on the game's rig has a row, and no sequel hero got in.
import { describe, expect, it } from 'vitest';
import BOOK from './saber.json';
import { HEROES } from '../../components/galaxy/heroes';

function unsourced(json) {
  const bad = [];
  const real = (s) => s === 'hand' || (typeof s === 'string' && /^[^#\s]+#\S/.test(s));
  const walk = (v, path, covered) => {
    if (typeof v === 'number') return covered || bad.push(path);
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}[${i}]`, covered));
    if (!v || typeof v !== 'object') return;
    const all = real(v._source);
    for (const [k, x] of Object.entries(v)) if (!k.endsWith('_source') && k !== '_source' && k !== '_from') walk(x, `${path}.${k}`, all || real(v[`${k}_source`]));
  };
  walk(json, 'saber', false);
  return bad;
}

describe('saber.json', () => {
  it('names a source for every number', () => {
    expect(unsourced(BOOK)).toEqual([]);
  });
  it('has a row for every saber hero on the game’s rig the roster fields, the Emperor aside (he has no saber in the game)', () => {
    const want = HEROES.filter((h) => h.weapon === 'saber' && h.rig === 'walrus' && !h.soon && h.id !== 'palpatine').map((h) => h.id);
    expect(want.length).toBeGreaterThan(4);
    for (const id of want) expect(BOOK.heroes[id], id).toBeTruthy();
  });
  it('keeps the sequel era out', () => {
    expect(Object.keys(BOOK.heroes).filter((id) => /rey|kylo|finn|phasma/i.test(id))).toEqual([]);
  });
});
