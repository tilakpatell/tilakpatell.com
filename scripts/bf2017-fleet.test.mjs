import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HQ, MODELS } from '../src/components/galaxy/models.js';
import { FLEET, writtenTurn } from './bf2017-fleet.mjs';
import { qmul } from './lib/rig-clips.mjs';

// the space layer's rows the fleet is written for, as galaxy/models.js has them
const rowOf = (file) => (file.startsWith('hq/') ? HQ[file.slice(3)] : MODELS[file]);

describe('the fleets on the game’s ships', () => {
  it('writes each over a file the galaxy flies, with the nose its row says, never a Meshy remake', () => {
    for (const [file, nose] of FLEET) {
      const row = rowOf(file);
      expect(row, file).toBeTruthy();
      // (at high the nebulon's row is its close-up cut, which this writes too)
      expect([`/models/galaxy/${file}.glb`, `/models/galaxy/hq/${file}.glb`], file).toContain(row.url);
      expect(row.nose, file).toBeCloseTo(nose, 9);
    }
    for (const kept of ['corvette', 'interceptor']) expect(FLEET.map((r) => r[0])).not.toContain(kept);
  });

  it('writes the space levels’ kits as the war’s capitals at the fleet’s cut, credited to the game', () => {
    const credits = JSON.parse(readFileSync(new URL('../src/data/modelCredits.json', import.meta.url), 'utf8'));
    const rows = FLEET.filter((r) => r[3].space);
    expect(rows.map((r) => r[0])).toEqual(['lucrehulk', 'lightcruiser']);
    for (const [file, , key] of rows) {
      expect(statSync(new URL(`../public/models/galaxy/${file}.glb`, import.meta.url)).size, file).toBeLessThan(2e6);
      expect(credits[key].author, file).toBe('EA DICE');
    }
  });

  it('turns a file so its row’s nose brings it back to +z', () => {
    for (const nose of [0, Math.PI, Math.PI / 2, -Math.PI / 2]) {
      const back = qmul([0, Math.sin(nose / 2), 0, Math.cos(nose / 2)], writtenTurn(nose));
      expect(Math.abs(back[3]), String(nose)).toBeCloseTo(1, 9);
    }
  });
});
