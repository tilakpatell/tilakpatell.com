import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROSTER_EXTRA, TERRAIN_VERSION, TYPE_BIOMES, planetSpecOf as specWith } from './planetSpec';
import { SEEDED_EXPANSE, WORLDS } from './planetTables';
import { MOONS } from './fixtures/generated';
import { EXPANSE, PLANETS, lifeFor, planetSpecOf } from './fixtures/expanse.js';
import { planetField } from './field';
import { clutterKitOf } from './landmarkTables';

const ROOT = fileURLToPath(new URL('../../../..', import.meta.url));
const GALAXY = 'tatooine hoth endor yavin bespin dagobah mustafar coruscant naboo kashyyyk kamino geonosis scarif nevarro mandalore lothal sorgan'.split(' ');
const SECTOR = 'gazorpazorp squanch birdworld gearworld pluto snakeplanet nuptia resort cronenberg purge'.split(' ');
const FANDOM = 'cybertron middle-earth caribbean albuquerque scranton avengers invincible c-137 earth dot-matrix'.split(' ');

describe('PLANETS', () => {
  it('lists the roster’s fifty in its order: galaxy, sector, fandom, then 13 of the Expanse', () => {
    expect(PLANETS).toHaveLength(50);
    expect(PLANETS.slice(0, 37).map((p) => p.id)).toEqual([...GALAXY, ...SECTOR, ...FANDOM]);
    expect(PLANETS.slice(37).every((p) => p.id.startsWith('e:'))).toBe(true);
    expect(PLANETS.some((p) => p.id === 'alderaan')).toBe(false);
  });

  it('has unique ids the database takes, plain rows', () => {
    expect(new Set(PLANETS.map((p) => p.id)).size).toBe(50);
    for (const p of PLANETS) {
      expect(Object.keys(p)).toEqual(['id', 'name', 'type', 'seed']);
      expect(p.id).toMatch(/^[a-z0-9:_,-]{1,64}$/);
      expect(typeof p.name).toBe('string');
      expect(Number.isInteger(p.seed)).toBe(true);
    }
  });

  it('takes the Expanse’s planets from the rows it is given, in their order', () => {
    expect(PLANETS.slice(37).map((p) => p.id)).toEqual(EXPANSE.map((r) => r.id));
    for (const p of PLANETS.slice(37)) expect(TYPE_BIOMES[p.type]).toBeTruthy();
  });
});

describe('planetSpecOf', () => {
  it('knows Hoth, Echo Base and all', () => {
    const s = planetSpecOf('hoth');
    expect(s.type).toBe('ice');
    expect(s.seed).toBe(0x48f1a2c3);
    expect(s.pois[0]).toMatchObject({ name: 'Echo Base', at: [1200, -800], r: 220, edge: 160, h: 12 });
  });

  it('gives every named world three to five biomes, each with a base, and its POIs', () => {
    for (const w of WORLDS) {
      const s = planetSpecOf(w.id);
      expect(s.biomes.length, w.id).toBeGreaterThanOrEqual(3);
      expect(s.biomes.length, w.id).toBeLessThanOrEqual(5);
      for (const b of s.biomes) {
        expect(Number.isFinite(b.base), `${w.id} ${b.id}`).toBe(true);
        expect(b.at.every((v) => v >= 0 && v <= 1), `${w.id} ${b.id}`).toBe(true);
        expect(b.scatter).toBeUndefined();
      }
      expect(s.palette).toMatchObject({ low: expect.any(String), high: expect.any(String), rock: expect.any(String), accent: expect.any(String) });
    }
  });


  it('gives every world a ground look, every Expanse type its template’s', () => {
    for (const p of PLANETS) expect(planetSpecOf(p.id).ground?.palette, p.id).toBeTruthy();
  });

  it('stands each landmark at a place the planet has, from a model the site carries', () => {
    let n = 0;
    for (const p of PLANETS) {
      const s = planetSpecOf(p.id);
      for (const l of s.landmarks) {
        n++;
        expect(s.pois.some((q) => q.id === l.at), `${p.id} ${l.id}`).toBe(true);
        for (const part of l.parts) {
          expect(existsSync(join(ROOT, 'public', part.url)), part.url).toBe(true);
          if (part.hq) expect(existsSync(join(ROOT, 'public', part.hq)), part.hq).toBe(true);
          expect(part.metres).toBeGreaterThan(0);
          expect(part.count).toBeGreaterThan(0);
        }
      }
    }
    expect(n).toBeGreaterThanOrEqual(10);
  });

  it('marks what the note marks: the pixel world stepped, the cloud deck soft, the cities blocked', () => {
    expect(planetSpecOf('dot-matrix').step).toBe(4);
    expect(planetSpecOf('bespin').soft).toBe(true);
    expect(planetSpecOf('hoth').soft).toBe(false);
    for (const id of ['invincible', 'cybertron']) expect(planetSpecOf(id).biomes.some((b) => b.relief.some((l) => l.type === 'blocks')), id).toBe(true);
    // Coruscant's city is towers standing on its floor, not bumps in it: one city to the haze, its landmarks the film-made models
    const c = planetSpecOf('coruscant');
    expect(c.biomes.some((b) => b.relief.some((l) => l.type === 'blocks' || l.type === 'mountains' || l.type === 'ridges'))).toBe(false);
    expect(c.clutter[0]).toMatchObject({ kinds: ['tower', 'slab', 'needle'], grid: 150 });
    expect(c.landmarks.map((l) => l.at)).toEqual(['senate', 'jedi-temple']);
    expect(c.hero.url).toMatch(/corutower\.glb$/);
    expect(planetSpecOf('tatooine').pits[0]).toMatchObject({ at: [2800, -1900], r: 90, depth: 40 });
  });

  it('builds an Expanse planet from its sector, either case, with no POIs', () => {
    const id = PLANETS[40].id;
    const s = planetSpecOf(id);
    expect(s.id).toBe(id);
    expect(s.biomes.length).toBeGreaterThan(0);
    expect(s.pois).toEqual([]);
    expect(planetSpecOf(id.toUpperCase())).toEqual(s);
    expect(planetSpecOf(PLANETS[40].id)).toEqual(planetSpecOf(PLANETS[40].id));
  });

  it('scatters a planet’s craters from its own seed', () => {
    const a = planetSpecOf('tatooine').biomes.find((x) => x.id === 'wastes').relief;
    expect(a.filter((l) => l.type === 'island').length).toBe(14);
    expect(planetSpecOf('tatooine').biomes).toEqual(planetSpecOf('tatooine').biomes);
  });

  it('knows the named worlds with no Expanse, and no Expanse planet without one', () => {
    expect(specWith('hoth')).toEqual(planetSpecOf('hoth'));
    expect(specWith(PLANETS[40].id)).toBeNull();
    expect(specWith(PLANETS[40].id, { expanse: (id) => EXPANSE.find((r) => r.id === id) })).toEqual(planetSpecOf(PLANETS[40].id));
  });

  it('refuses what it does not know', () => {
    for (const id of ['nowhere', 'alderaan', 'e:1,0:99:0', 'e:0,0:0:0', 'e:x', '', undefined]) expect(planetSpecOf(id)).toBeNull();
  });

  it('gives the cartoon worlds rounder hills or warped, ping-pong plateaus', () => {
    for (const id of ['squanch', 'gearworld']) expect(planetSpecOf(id).biomes.some((x) => x.relief.some((l) => l.type === 'fnl' && l.noise.fractal === 'pingpong' && l.noise.warp === 600)), id).toBe(true);
    expect(planetSpecOf('birdworld').biomes[0].relief[0]).toMatchObject({ type: 'hills', gain: 0.4, octaves: 3 });
  });
});

// Each planet's ground, as the field is given it, hashed (FNV-1a over the
// specs' JSON): what a built thing stands on. A change to the tables, a
// seed, a biome or a POI moves the hash, and this fails until
// TERRAIN_VERSION is bumped and the new hash written beside it, so a turret
// built on the old ground is put back on the new (the shared world's
// buildRules.js) rather than left floating. (GROUND gains a line a version.)
const GROUND = { 1: '3ae3a7e7', 2: 'af2cf901' };
function groundHash() {
  let h = 0x811c9dc5;
  const text = JSON.stringify(PLANETS.map(({ id }) => planetSpecOf(id)).map(({ id, seed, type, climate, biomes, pois, pits, step, soft }) => ({ id, seed, type, climate, biomes, pois, pits, step, soft })));
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

// lib knows no page (docs/health/RULES.md): the tables are given the Expanse,
// they never reach up for it
describe('the pure layer', () => {
  it('imports nothing from a component or a page', () => {
    const dir = fileURLToPath(new URL('.', import.meta.url));
    for (const f of [...readdirSync(dir).filter((f) => f.endsWith('.js') && !f.endsWith('.test.js')), ...readdirSync(join(dir, 'fixtures')).filter((f) => f.endsWith('.js')).map((f) => `fixtures/${f}`)]) {
      const imports = readFileSync(join(dir, f), 'utf8').match(/^\s*(?:import|export)\b[^'"]*?from\s*['"][^'"]+['"]/gm) ?? [];
      for (const line of imports) expect(line, f).not.toMatch(/components\/|pages\//);
    }
  });
});

describe('TERRAIN_VERSION', () => {
  it('is bumped whenever a planet’s ground changes', () => {
    expect(Number.isInteger(TERRAIN_VERSION) && TERRAIN_VERSION >= 1).toBe(true);
    expect(groundHash(), `the ground changed: bump TERRAIN_VERSION and add GROUND[${TERRAIN_VERSION + 1}]`).toBe(GROUND[TERRAIN_VERSION]);
  });
});

// The fifty as the endless universe found them (its spec, section E: “The 50
// roster planets keep their plane ground exactly as it is”): every field the
// flight read then, the ground under five points, their life and clutter kits.
const ROSTER_LOCK = '707fb49f';
const ROSTER_KEYS = ['id', 'name', 'seed', 'type', 'climate', 'biomes', 'pois', 'pits', 'palette', 'clutter', 'step', 'soft', 'ground', 'water', 'fog', 'landmarks', 'hero'];
const ROSTER_POINTS = [[0, 0], [1234.5, -987.25], [-15000, 8000], [30000, 30000], [-4321, -27000]];
function rosterHash() {
  const text = JSON.stringify(PLANETS.map(({ id }) => {
    const s = planetSpecOf(id);
    const f = planetField(s);
    return [ROSTER_KEYS.map((k) => s[k] ?? null), ROSTER_POINTS.map(([x, z]) => f.heightAt(x, z).toFixed(4)), lifeFor(s), clutterKitOf(s)];
  }));
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

describe('the roster', () => {
  it('is as it was: the fifty’s fields, ground, life and kits', () => {
    expect(rosterHash()).toBe(ROSTER_LOCK);
  });
});

describe('ids, moons and the build flag', () => {
  it('reads an Expanse id in either case and with its height written, to one canonical id', () => {
    const s = planetSpecOf('e:1,0:0:1');
    expect(planetSpecOf('E:1,0:0:1')).toEqual(s);
    expect(planetSpecOf('e:1,0,0:0:1')).toEqual(s);
    expect(s.id).toBe('e:1,0:0:1');
  });

  it('refuses what isn’t a planet or a moon, and never throws', () => {
    for (const id of ['e:1,0', 'e:1,0:0', 'e:1,0:w1', 'e:1,0:0:1:', 'e:1,0:0:1x', ' e:1,0:0:1', 'e:1,0:0:-1', 'e:1,0:0:1:9', null, 42]) expect(planetSpecOf(id), String(id)).toBeNull();
  });

  it('lists the thirteen seeded Expanse planets as the roster’s last thirteen', () => {
    expect(SEEDED_EXPANSE).toEqual(EXPANSE.map((r) => [r.id, r.type]));
  });

  it('lets the fifty be built on, and gives them nothing new', () => {
    for (const p of PLANETS) expect(Object.fromEntries(Object.keys(ROSTER_EXTRA).map((k) => [k, planetSpecOf(p.id)[k]])), p.id).toEqual(ROSTER_EXTRA);
  });

  it('lands a moon from its row: rocky as rock, icy as ice, its planet named, not to be built on', () => {
    const [rocky, icy] = MOONS;
    expect(specWith(rocky.id, { expanse: MOONS })).toMatchObject({ id: rocky.id, kind: 'moon', parent: rocky.parent, type: 'rock', buildable: false });
    expect(specWith(icy.id.toUpperCase(), { expanse: MOONS })).toMatchObject({ id: icy.id, type: 'ice' });
  });
});
