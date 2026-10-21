import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from './destinations';
import { NAMES, nameOf } from './names';

describe('the dial’s people’s names', () => {
  it('names a kind, and a lettered kind by its family', () => {
    expect(nameOf('gromflomite')).toBe('A Gromflomite');
    expect(nameOf('snake-a')).toBe('A snake');
    expect(nameOf('deathstalker-b')).toBe('A Death Stalker');
    expect(nameOf('frundleshouse')).toBe(null);
    expect(nameOf(null)).toBe(null);
  });

  it('gives everyone who speaks or hunts a name, so no line is captioned with an id', () => {
    const nameless = [];
    for (const d of DESTINATIONS) {
      for (const p of d.people) if ((p.ai?.bark || p.ai?.hunt) && !d.say[p.id]?.who && !nameOf(p.who ?? p.id)) nameless.push(`${d.id}: ${p.id}`);
      for (const e of d.extras) if ((e.ai?.bark || e.ai?.hunt) && !nameOf(e.kind)) nameless.push(`${d.id}: ${e.kind}`);
    }
    expect(nameless).toEqual([]);
  });

  it('writes a name as a caption: a capital, curly apostrophes', () => {
    for (const [k, v] of Object.entries(NAMES)) {
      expect(v[0], k).toBe(v[0].toUpperCase());
      expect(v, k).not.toContain("'");
    }
  });
});
