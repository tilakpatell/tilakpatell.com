import { describe, expect, it } from 'vitest';
import FIXTURE from '../../../lib/land/flight/fixtures/expanse.json';
import { hash64 as libHash } from '../../../lib/land/flight/hash.js';
import { LIFE, expanseLife } from '../../../lib/land/flight/lifeTables';
import { SITE_GROUND, SITE_LAYERS } from '../../../lib/land/flight/planetTables';
import { makeSector } from '../gen/sector.js';
import { UNIVERSE, hash64 } from '../gen/seed.js';
import { FIGURES, GALAXY_KINDS, SURFACE_MODELS } from '../../galaxy/shared/models';
import { SITES } from '../../galaxy/shared/ground';
import { BUILT_KINDS } from '../../universe/shared/flying';
import { EXPANSE, PLANETS, expanseRow, lifeOf, planetSpecOf } from './planets';

const GALAXY = 'tatooine hoth endor yavin bespin dagobah mustafar coruscant naboo kashyyyk kamino geonosis scarif nevarro mandalore lothal sorgan'.split(' ');
const SECTOR = 'gazorpazorp squanch birdworld gearworld pluto snakeplanet nuptia resort cronenberg purge'.split(' ');
const FANDOM = 'cybertron middle-earth caribbean albuquerque scranton avengers invincible c-137 earth dot-matrix'.split(' ');
const KNOWN = new Set([...GALAXY_KINDS, ...BUILT_KINDS, ...FIGURES, ...Object.keys(SURFACE_MODELS), 'figure', 'wedge']);

describe('the flight’s planets, composed', () => {
  it('lists the fifty in the roster’s order, the Expanse’s thirteen last', () => {
    expect(PLANETS.map((p) => p.id).slice(0, 37)).toEqual([...GALAXY, ...SECTOR, ...FANDOM]);
    expect(EXPANSE).toHaveLength(13);
    expect(EXPANSE.every((r) => r.id.startsWith('e:'))).toBe(true);
    expect(PLANETS.slice(37).map((p) => p.id)).toEqual(EXPANSE.map((r) => r.id));
  });

  // the pure tables' tests read the fixture: it has to be what the generator makes
  it('makes the rows the fixture holds (re-run scripts/flight-expanse-fixture.mjs when the Expanse changes)', () => {
    expect(EXPANSE).toEqual(FIXTURE);
  });

  it('takes the Expanse planets from sector (1, 0) on', () => {
    const first = makeSector(UNIVERSE, 1, 0).systems[0].planets[0];
    expect(PLANETS[37]).toMatchObject({ id: first.id.toLowerCase(), name: first.name, type: first.type });
  });

  it('flies to any Expanse planet by id, not only the thirteen, either case', () => {
    const far = makeSector(UNIVERSE, 3, -2).systems.flatMap((s) => s.planets).find((p) => p.type === 'ice' || p.type === 'desert' || p.type === 'forest');
    expect(far).toBeTruthy();
    expect(expanseRow(far.id)).toMatchObject({ id: far.id.toLowerCase(), name: far.name, type: far.type });
    expect(planetSpecOf(far.id)?.id).toBe(far.id.toLowerCase());
    expect(planetSpecOf('e:1,0:99:0')).toBeNull();
    expect(expanseRow('hoth')).toBeNull();
  });

  it('reads an Expanse planet’s life from its system', () => {
    for (const p of PLANETS.slice(37)) {
      const spec = planetSpecOf(p.id);
      const [sx, sz, i] = p.id.slice(2).split(/[,:]/).map(Number);
      expect(lifeOf(spec)).toEqual(expanseLife(spec.type, spec.biomes, makeSector(UNIVERSE, sx, sz).systems[i]));
    }
  });

  it('seeds the named worlds with the generator’s own hash', () => {
    for (const parts of [['fly', 'hoth'], ['fly', 'c-137'], ['planet', 'x', 3]]) expect(libHash(...parts)).toBe(hash64(...parts));
  });

  it('draws every life row as a kind the site has, or a code-built one', () => {
    const lives = [...Object.values(LIFE), ...PLANETS.map((p) => lifeOf(planetSpecOf(p.id)))];
    for (const life of lives) for (const row of [...life.air, ...life.ground]) expect(KNOWN.has(row.model), `${row.name} → ${row.model}`).toBe(true);
  });

  // the ground round each walkable site is the site's own ground
  it.each(GALAXY.filter((id) => SITES[id]?.ground?.layers?.length))('%s: the landing biome begins with the site’s own layers', (id) => {
    // (a site on the game's level keeps its own land for the flight: ground.flight)
    const site = SITES[id].ground.flight ?? SITES[id].ground.layers;
    const relief = planetSpecOf(id).biomes[0].relief;
    expect(relief.slice(0, site.length).map((l) => l.type)).toEqual(site.map((l) => l.type));
    expect(relief.slice(0, site.length)).toEqual(site.map((l) => ({ ...l })).map((l) => expect.objectContaining(l)));
    expect(SITE_LAYERS[id]).toHaveLength(site.length);
  });

  // and wears the site's own ground look: Mos Eisley's sand from the air is the sand you walk on
  it.each(GALAXY)('%s: the ground look is the site’s own', (id) => {
    const look = { ...SITES[id].ground };
    for (const k of ['layers', 'flight', 'flats', 'pits', 'seed', 'base']) delete look[k];
    expect(SITE_GROUND[id]).toEqual(look);
    if (id !== 'coruscant') expect(planetSpecOf(id).ground).toEqual(look);
    // (Bespin's is clouds; Kamino's is the game's ocean, 296 m under the city
    // it walks, and the flight keeps its own sea at 0 under its own land, ground.flight)
    if (SITES[id].water && id !== 'bespin' && id !== 'kamino') expect(planetSpecOf(id).water).toEqual({ kind: SITES[id].water.kind, level: SITES[id].water.level });
  });
});
