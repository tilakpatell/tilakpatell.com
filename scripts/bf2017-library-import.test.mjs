import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { asOf, namesFrom } from './bf2017-library-import.mjs';

const ROWS = [
  { name: 'objects/props/objectsets/_galacticempire/box_m_04/box_m_04_mesh', set: '_galacticempire', kind: 'prop', size: 'medium', tags: ['box'] },
  { name: 'objects/nature/volcanic/rock_01/rock_01_mesh', set: 'volcanic', kind: 'nature', size: 'large', tags: ['rock'] },
  { name: 'objects/nature/volcanic/pebble_01/pebble_01_mesh', set: 'volcanic', kind: 'nature', size: 'small', tags: ['pebble'] },
];

describe('the library’s import, on demand', () => {
  it('takes names given, a set’s (by kind and size), or every `game:` a file names', () => {
    expect(namesFrom({ _: ['a/b_mesh,c/d_mesh'] }, ROWS)).toEqual(['a/b_mesh', 'c/d_mesh']);
    expect(namesFrom({ _: [], set: 'volcanic', size: 'small' }, ROWS)).toEqual(['objects/nature/volcanic/pebble_01/pebble_01_mesh']);
    const dir = mkdtempSync(join(tmpdir(), 'lib-'));
    const f = join(dir, 'site.js');
    writeFileSync(f, "const ROCK = 'game:objects/nature/volcanic/rock_01/rock_01_mesh';\nconst again = `game:objects/nature/volcanic/rock_01/rock_01_mesh`;");
    expect(namesFrom({ _: [], from: f }, ROWS)).toEqual(['objects/nature/volcanic/rock_01/rock_01_mesh']);
  });

  it('says what a row is, for its credit, from its words and its set', () => {
    expect(asOf(ROWS[0])).toBe('box (the Empire’s prop)');
    expect(asOf(ROWS[1])).toBe('rock (Volcanic nature)');
  });
});
