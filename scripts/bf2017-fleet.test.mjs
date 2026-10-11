import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import PUBLISHED from '../src/data/galaxyAssets.json';
import { HQ, ULTRA, modelsAt } from '../src/components/galaxy/models.js';
import { FLEET, writtenTurn } from './bf2017-fleet.mjs';
import { qmul } from './lib/rig-clips.mjs';

// the space layer's rows the fleet is written for, as galaxy/models.js has
// them on a desktop (MODELS is this device's: a test runs at ultra, where
// the kits' rows are their ultra cuts)
const MODELS = modelsAt('high');
const rowOf = (file) => (file.startsWith('hq/') ? HQ[file.slice(3)] : MODELS[file]);
const at = (path) => new URL(`../public${path}`, import.meta.url);
// a file's bytes: on disk, or as published to the bucket (src/data/galaxyAssets.json)
const bytesOf = (path) => (existsSync(at(path)) ? statSync(at(path)).size : PUBLISHED[path.slice(1)]?.bytes);

describe('the fleets on the game’s ships', () => {
  it('writes each over a file the galaxy flies, with the nose its row says, never a Meshy remake', () => {
    for (const [file, nose] of FLEET) {
      const row = rowOf(file);
      expect(row, file).toBeTruthy();
      // (at high the nebulon's row is its close-up cut, which this writes too)
      expect([`/models/galaxy/${file}.glb`, `/models/galaxy/hq/${file}.glb`], file).toContain(row.url);
      expect(row.nose, file).toBeCloseTo(nose, 9);
    }
    // (the Meshy remakes are gone: the interceptor is lane V's native file, galaxy/models.js)
    expect(FLEET.map((r) => r[0])).not.toContain('interceptor');
    expect(MODELS.interceptor.url).toBe('/models/galaxy/surface/tieinterceptor.glb');
  });

  // (lane S1: every capital the game has, from the space levels' kits; the
  // fleet's cut is 24,000 triangles with maps at 256 and 128, `_source`:
  // scripts/bf2017-space.mjs's FLEET_CUT, so a file stays under 2.5 MB (the
  // Star Destroyer's kit is 50 maps, 2,049 KB, measured 2026-10-11; the rest
  // under 1 MB); its ultra cut beside it, to the bucket, under the capital
  // cap's 60,000 triangles with 1,024 maps: the Star Destroyer's 21.6 MB the
  // heaviest, held under 40 MB)
  it('writes the space levels’ kits as the war’s capitals at the fleet’s cut, credited to the game, each with its ultra cut', () => {
    const credits = JSON.parse(readFileSync(new URL('../src/data/modelCredits.json', import.meta.url), 'utf8'));
    const rows = FLEET.filter((r) => r[3].space);
    expect(rows.map((r) => r[0])).toEqual(['lucrehulk', 'lightcruiser', 'destroyer', 'moncal', 'venator', 'corvette', 'providence']);
    for (const [file, , key, from] of rows) {
      expect(statSync(at(`/models/galaxy/${file}.glb`)).size, file).toBeLessThan(2.5e6);
      expect(credits[key].author, file).toBe('EA DICE');
      if (from.ultra) {
        expect(ULTRA[file], file).toBe(`/models/galaxy/${file}.ultra.glb`);
        expect(bytesOf(ULTRA[file]), `${file}.ultra`).toBeGreaterThan(statSync(at(`/models/galaxy/${file}.glb`)).size);
        expect(bytesOf(ULTRA[file]), `${file}.ultra`).toBeLessThan(40e6);
      } else expect(ULTRA[file], file).toBeUndefined();
    }
    // (every kit capital's row is the fleet's file, bow to +z)
    for (const kind of ['destroyer', 'moncal', 'venator', 'corvette', 'providence', 'lucrehulk', 'lightcruiser']) expect(MODELS[kind].url, kind).toBe(`/models/galaxy/${kind}.glb`);
  });

  it('writes the close-up Nebulon-B from the game’s own frigate at its first LOD, with its engine and lights, over Daniel Andersson’s', () => {
    const row = FLEET.find((r) => r[0] === 'hq/nebulon');
    expect(row[3]).toMatchObject({ cut: 0, parts: '*_engine_01_mesh,*_emissive_01_mesh' });
    expect(HQ).toEqual({ nebulon: { url: '/models/galaxy/hq/nebulon.glb', nose: 0 } }); // (the Star Destroyer's close-up cut is the kit's ultra cut since)
    const credits = JSON.parse(readFileSync(new URL('../src/data/modelCredits.json', import.meta.url), 'utf8'));
    expect(credits['galaxy-nebulonhq'].author).toBe('EA DICE');
    expect(credits['galaxy-destroyerhq']).toBeUndefined();
    expect(existsSync(at('/models/galaxy/hq/destroyer.glb'))).toBe(false);
  });

  it('turns a file so its row’s nose brings it back to +z', () => {
    for (const nose of [0, Math.PI, Math.PI / 2, -Math.PI / 2]) {
      const back = qmul([0, Math.sin(nose / 2), 0, Math.cos(nose / 2)], writtenTurn(nose));
      expect(Math.abs(back[3]), String(nose)).toBeCloseTo(1, 9);
    }
  });
});
