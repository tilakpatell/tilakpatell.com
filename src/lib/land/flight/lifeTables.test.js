import { describe, expect, it } from 'vitest';
import { PLANETS, lifeFor, planetSpecOf } from './fixtures/expanse.js';
import { MOONS } from './fixtures/generated';
import { planetSpecOf as specWith } from './planetSpec';
import { DENSITY, KINDS, LIFE, expanseLife, isDead, kindAt, systemOf } from './lifeTables';

const BODIES = ['beast', 'person', 'flyer', 'walker', 'speeder', 'drone', 'craft'];
// the roster's named worlds (docs/research/2026-10-09-planet-geographies.md, “The roster”)
const NAMED = 'tatooine hoth endor yavin bespin dagobah mustafar coruscant naboo kashyyyk kamino geonosis scarif nevarro mandalore lothal sorgan gazorpazorp squanch birdworld gearworld pluto snakeplanet nuptia resort cronenberg purge cybertron middle-earth caribbean albuquerque scranton avengers invincible c-137 earth dot-matrix'.split(' ');
// names from the sequel films the site never uses
const DENY = /\b(first order|kylo|rey|finn|poe dameron|bb-?8|starkiller|jakku|crait|exegol|snoke|porgs?|phasma|hux|ahch-to|canto bight|fathiers?|vulptex|silencer|tie whisper|t-70|resistance|knights of ren|sith eternal|xyston)\b/i;

const rowsOf = (life) => [...life.air, ...life.ground];

describe('lifeTables', () => {
  it('finds a moon’s system on its row', () => {
    expect(systemOf(MOONS[0].id, { expanse: MOONS })).toEqual(MOONS[0].system);
    const life = lifeFor(specWith(MOONS[0].id, { expanse: MOONS }), { expanse: MOONS });
    expect(Array.isArray(life.air) && Array.isArray(life.ground)).toBe(true);
  });

  it('has a row or the rule for every flown planet, and a row for every named world', () => {
    expect(PLANETS.length).toBe(50);
    for (const p of PLANETS) {
      const spec = planetSpecOf(p.id);
      const life = lifeFor(spec);
      expect(life.kinds, p.id).toBeTruthy();
      expect(Array.isArray(life.air) && Array.isArray(life.ground), p.id).toBe(true);
    }
    for (const id of NAMED) expect(LIFE[id], id).toBeTruthy();
  });

  // (that each model is a kind the site has: expanse/flight/planets.test.js,
  // which may read the galaxy's face)
  it('draws every row on a body it knows, a code-built one tinted', () => {
    const lives = [...Object.values(LIFE), ...PLANETS.map((p) => lifeFor(planetSpecOf(p.id)))];
    for (const life of lives)
      for (const row of rowsOf(life)) {
        if (row.body) expect(BODIES).toContain(row.body);
        if (row.model === 'figure' || row.model === 'wedge') expect(row.tint, row.name).toMatch(/^#[0-9a-f]{6}$/);
      }
  });

  it('keeps every row to its own shape', () => {
    for (const [id, life] of Object.entries(LIFE)) {
      for (const k of Object.values(life.kinds)) expect(KINDS, id).toContain(k);
      for (const r of life.air) {
        expect(['patrol', 'lane', 'shuttle'], `${id} ${r.name}`).toContain(r.route);
        expect(r.alt[0] > 0 && r.alt[1] >= r.alt[0] && r.speed > 0 && r.perKm2 > 0, `${id} ${r.name}`).toBe(true);
      }
      for (const r of life.ground) {
        expect(['herd', 'predator', 'patrol', 'settler', 'hostile', 'wander', 'flock'], `${id} ${r.name}`).toContain(r.role);
        expect(r.group[0] >= 1 && r.group[1] >= r.group[0] && r.perKm2 > 0, `${id} ${r.name}`).toBe(true);
        if (r.role === 'hostile') expect(r.hostile?.range, `${id} ${r.name}`).toBeGreaterThan(0);
      }
    }
  });

  it('lets no ground row onto a dead biome', () => {
    for (const [id, life] of Object.entries(LIFE))
      for (const r of life.ground) {
        for (const b of r.biome ?? []) expect(kindAt(life, b), `${id} ${r.name} on ${b}`).not.toBe('dead');
        if (r.kind) expect(r.kind, `${id} ${r.name}`).not.toBe('dead');
      }
  });

  it('gives Dagobah only its bogwings, Coruscant three lanes, and a scramble over Hoth’s base', () => {
    const dagobah = LIFE.dagobah;
    expect(dagobah.air).toEqual([]);
    expect(dagobah.ground.map((r) => r.name)).toEqual(['bogwing']);
    expect(LIFE.coruscant.air.find((r) => r.route === 'lane').lanes).toBe(3);
    expect(LIFE.coruscant.ground.every((r) => r.role !== 'herd' && r.role !== 'predator')).toBe(true);
    expect(LIFE.hoth.air.some((r) => r.scramble && r.near === 'poi')).toBe(true);
    expect(LIFE.hoth.ground.find((r) => r.name === 'tauntaun').role).toBe('herd');
  });

  it('keeps Mandalore’s glass and the Expanse’s giants dead', () => {
    expect(kindAt(LIFE.mandalore, 'glass')).toBe('dead');
    const giant = PLANETS.map((p) => planetSpecOf(p.id)).find((s) => s.type === 'gas' && s.id.startsWith('e:'));
    expect(giant).toBeTruthy();
    expect(isDead(lifeFor(giant))).toBe(true);
    expect(isDead(expanseLife('ringed', [], { faction: { id: 'empire' }, traffic: 1, hazard: 'pirates' }))).toBe(true);
    expect(isDead(lifeFor({ id: 'nowhere' }))).toBe(true);
    expect(isDead(lifeFor(null))).toBe(true);
  });

  it('reads the Expanse by faction, traffic and hazard', () => {
    const biomes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const pirates = expanseLife('rock', biomes, { faction: { id: 'independent' }, traffic: 0.2, hazard: 'pirates' });
    expect(pirates.air.some((r) => r.scramble && r.kind === 'hostile' && r.hostile)).toBe(true);
    expect(kindAt(pirates, 'c')).toBe('hostile');
    const busy = expanseLife('ice', biomes, { faction: { id: 'empire' }, traffic: 0.8, hazard: null });
    expect(kindAt(busy, 'a')).toBe('settled');
    expect(busy.air.some((r) => r.route === 'lane')).toBe(true);
    expect(busy.ground.some((r) => r.model === 'tauntaun' && r.role === 'herd')).toBe(true);
    const quiet = expanseLife('ice', biomes, { faction: { id: 'empire' }, traffic: 0.3, hazard: null });
    expect(quiet.air.some((r) => r.route === 'lane')).toBe(false);
    expect(isDead(expanseLife('lava', biomes, { faction: { id: 'independent' }, traffic: 0.2, hazard: null }))).toBe(true);
    expect(isDead(expanseLife('lava', biomes, { faction: { id: 'empire' }, traffic: 0.2, hazard: null }))).toBe(false);
  });

  it('names nothing from the sequel films', () => {
    expect(DENY.test('First Order')).toBe(true);
    expect(DENY.test('grey')).toBe(false);
    const words = JSON.stringify(LIFE);
    expect(words).not.toMatch(DENY);
    for (const p of PLANETS) expect(JSON.stringify(lifeFor(planetSpecOf(p.id)))).not.toMatch(DENY);
  });

  it('halves on low', () => {
    expect(DENSITY.low).toBe(0.5);
    expect(DENSITY.mid).toBe(1);
  });
});
