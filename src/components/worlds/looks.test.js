import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BLOOM } from '../../lib/three/bloom';
import { freeRoamOnly } from '../galaxy/gameLevels';
import { LOOK_FOLDERS, oklabDistance, validateLook } from './looks';

const COMPONENTS = fileURLToPath(new URL('..', import.meta.url));

// The folders with no look yet, each Phase 2 lane’s to empty
// (docs/superpowers/HANDOFF-one-feel.md). The sweep holds the list to
// exactly what is missing: a lane that adds a look takes its folder off,
// and a folder that loses one fails until it is put back.
const EXPECTED_MISSING = [
  'cockpit',
];

const looks = import.meta.glob('../**/look.js');
const lookOf = async (folder) => {
  const load = looks[`../${folder}/look.js`];
  return load ? (await load()).LOOK : undefined;
};

// a folder’s own scene files: its .js sources, tests left out, down to
// (not into) a folder that has its own entry
const OWN = new Set(LOOK_FOLDERS.map((f) => f.folder));
function sources(folder) {
  const out = [];
  const walk = (rel) => {
    for (const name of readdirSync(join(COMPONENTS, rel))) {
      const child = `${rel}/${name}`;
      if (statSync(join(COMPONENTS, child)).isDirectory()) {
        if (!OWN.has(child) && !name.startsWith('__')) walk(child);
      } else if (/\.m?js$/.test(name) && !/\.test\.m?js$/.test(name) && name !== 'look.js') out.push(child);
    }
  };
  walk(folder);
  return out;
}

// a bloom number written in a scene rather than read from its look (the
// .jsx pages’ threshold: is an IntersectionObserver’s, so .js only)
const LITERAL = /threshold:\s*[\d.]/;

const PAINTED = { art: 'painted', palette: ['#b4b536', '#d8cf3b', '#6b4a32', '#b98a4e', '#3f6a8a', '#d8572a'], tone: 'house', bloom: BLOOM, why: {} };

describe('validateLook', () => {
  it('finds nothing wrong with a good painted look, or a scanned one with no bloom', () => {
    expect(validateLook(PAINTED)).toEqual([]);
    expect(validateLook({ art: 'scanned', tone: 'house', bloom: false })).toEqual([]);
  });

  it('wants a why for a bloom under white, a world with no tone mapper, and an art of its own', () => {
    expect(validateLook({ ...PAINTED, bloom: { threshold: 0.8, strength: 0.5, radius: 0.4 } })).toEqual([expect.stringMatching(/^bloom:/)]);
    expect(validateLook({ ...PAINTED, bloom: { threshold: 0.8, strength: 0.5, radius: 0.4 }, why: { bloom: 'the sea’s foam is the glow' } })).toEqual([]);
    expect(validateLook({ ...PAINTED, tone: 'none' })).toEqual([expect.stringMatching(/^tone:/)]);
    expect(validateLook({ art: 'own', tone: 'house', bloom: false })).toEqual([expect.stringMatching(/^art:/)]);
    expect(validateLook({ art: 'own', tone: 'none', bloom: false, why: { art: 'a dither', tone: 'colours as final' } })).toEqual([]);
  });

  it('holds a painted palette to six to sixteen colours, each its own', () => {
    expect(validateLook({ ...PAINTED, palette: PAINTED.palette.slice(0, 5) })).toEqual([expect.stringMatching(/^palette:/)]);
    expect(validateLook({ ...PAINTED, palette: [...PAINTED.palette.slice(0, 4), '#ffffff', '#fefefe'] })).toEqual([expect.stringMatching(/^palette: #ffffff and #fefefe/)]);
    expect(validateLook({ art: 'scanned', palette: PAINTED.palette, tone: 'house', bloom: false })).toEqual([expect.stringMatching(/^palette:/)]);
  });

  it('names an art or a tone it doesn’t know, and a bloom that isn’t one', () => {
    expect(validateLook({ ...PAINTED, art: 'toon', palette: undefined })).toEqual([expect.stringMatching(/^art:/)]);
    expect(validateLook({ ...PAINTED, tone: 'aces' })).toEqual([expect.stringMatching(/^tone:/)]);
    expect(validateLook({ ...PAINTED, bloom: { strength: 0.25 } })).toEqual([expect.stringMatching(/^bloom:/)]);
    expect(validateLook(undefined)).toEqual([expect.stringMatching(/^look:/)]);
  });

  it('measures colours as they look: none between a colour and itself, white and black far apart', () => {
    expect(oklabDistance('#5b3fd1', 0x5b3fd1)).toBe(0);
    expect(oklabDistance('#ffffff', '#000000')).toBeCloseTo(1, 2);
  });
});

describe('every world says its art', () => {
  it('lists real folders, each once', () => {
    const folders = LOOK_FOLDERS.map((f) => f.folder);
    expect(new Set(folders).size).toBe(folders.length);
    for (const { folder, routes } of LOOK_FOLDERS) {
      expect(existsSync(join(COMPONENTS, folder)), folder).toBe(true);
      expect(routes.length, folder).toBeGreaterThan(0);
      // (a route that draws the folder: a world the engine plays is free roam on its surface, so no mission there)
      for (const r of routes) {
        const system = /^\/galaxy\/([^/?]+)\/surface/.exec(r)?.[1];
        if (system && freeRoamOnly(system)) expect(r, `${folder}: ${r}`).not.toMatch(/[?&](mission|mode)=(?!free\b)/);
      }
    }
    expect([...EXPECTED_MISSING].sort()).toEqual([...new Set(EXPECTED_MISSING)].sort());
  });

  it('has a look.js that validates in every folder but the ones still to come, and exactly those', async () => {
    const missing = [];
    for (const { folder } of LOOK_FOLDERS) {
      const look = await lookOf(folder);
      if (look === undefined) {
        missing.push(folder);
        continue;
      }
      expect(validateLook(look), folder).toEqual([]);
    }
    expect(missing.sort()).toEqual([...EXPECTED_MISSING].sort());
  });

  it('reads the bloom from the look, not a number in a scene, wherever there is a look', async () => {
    for (const { folder } of LOOK_FOLDERS) {
      if (!(await lookOf(folder))) continue;
      const literal = sources(folder).filter((file) => LITERAL.test(readFileSync(join(COMPONENTS, file), 'utf8')));
      expect(literal, folder).toEqual([]);
    }
  });
});
