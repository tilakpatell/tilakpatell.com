import { describe, expect, it } from 'vitest';
import { PLANETS, lifeFor, planetSpecOf } from './fixtures/expanse.js';
import { DENSITY, KINDS, LIFE, expanseLife, isDead, kindAt, lifeFor as lifeWith, systemOf } from './lifeTables';
import { planetSpecOf as specWith } from './planetSpec';
import { MOONS, lookupOf, randomSystems } from './fixtures/generated';

const BODIES = ['beast', 'person', 'flyer', 'walker', 'speeder', 'drone', 'craft'];
// the roster's named worlds (docs/research/2026-10-09-planet-geographies.md, “The roster”)
const NAMED = 'tatooine hoth endor yavin bespin dagobah mustafar coruscant naboo kashyyyk kamino geonosis scarif nevarro mandalore lothal sorgan gazorpazorp squanch birdworld gearworld pluto snakeplanet nuptia resort cronenberg purge cybertron middle-earth caribbean albuquerque scranton avengers invincible c-137 earth dot-matrix'.split(' ');
// names from the sequel films the site never uses
const DENY = /\b(first order|kylo|rey|finn|poe dameron|bb-?8|starkiller|jakku|crait|exegol|snoke|porgs?|phasma|hux|ahch-to|canto bight|fathiers?|vulptex|silencer|tie whisper|t-70|resistance|knights of ren|sith eternal|xyston)\b/i;

const rowsOf = (life) => [...life.air, ...life.ground];

describe('lifeTables', () => {
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

  it('finds a moon’s system on its row', () => {
    const [rocky, icy] = MOONS;
    expect(systemOf(rocky.id, { expanse: MOONS })).toEqual(rocky.system);
    expect(systemOf(rocky.id.toUpperCase(), { expanse: MOONS })).toEqual(rocky.system);
    const life = lifeWith(specWith(rocky.id, { expanse: MOONS }), { expanse: MOONS });
    expect(Array.isArray(life.air) && Array.isArray(life.ground)).toBe(true);
    // (an icy moon walks its own fauna, not ice's herds: this one's a flock)
    const spec = specWith(icy.id, { expanse: MOONS });
    const wild = lifeWith(spec, { expanse: MOONS }).ground.filter((r) => r.kind === 'wild');
    expect(spec.fauna.density).toBeGreaterThan(0);
    expect(wild.map((r) => r.body)).toEqual(spec.fauna.plans.map((p) => p.body));
    expect(wild.some((r) => r.model === 'tauntaun')).toBe(false);
    expect(systemOf('e:3,-2:1:0', { expanse: MOONS })).toBeNull();
  });

  const QUIET = { faction: null, traffic: 0, hazard: null };
  const PLANS = [
    { body: 'beast', role: 'herd', tint: '#806040', group: [4, 8] },
    { body: 'flyer', role: 'flock', tint: '#c0c0c0', group: [4, 8] },
  ];

  it('lets a generated planet’s fauna walk it, scaled by its density', () => {
    const biomes = [{ id: 'a' }, { id: 'b' }];
    const life = expanseLife('forest', biomes, QUIET, { density: 1, plans: PLANS });
    expect(life.ground).toHaveLength(2);
    expect(life.ground.map((r) => r.model)).toEqual(['figure', 'figure']);
    expect(life.ground.map((r) => r.perKm2)).toEqual([0.3, 0.3]);
    expect(life.ground.map((r) => r.body)).toEqual(['beast', 'flyer']);
    expect(life.ground.map((r) => r.tint)).toEqual(['#806040', '#c0c0c0']);
    expect(life.ground[1].alt).toEqual([6, 50]);
    expect(life.ground[0].alt).toBeUndefined();
    // (its own, in place of the forest's nerfs)
    expect(life.ground.some((r) => r.model === 'nerf')).toBe(false);
    expect(kindAt(life, 'a')).toBe('wild');
    expect(expanseLife('forest', biomes, QUIET, { density: 0.5, plans: PLANS }).ground[0].perKm2).toBeCloseTo(0.15, 9);
  });

  it('has no wild rows with no fauna', () => {
    const biomes = [{ id: 'a' }, { id: 'b' }];
    const none = expanseLife('forest', biomes, QUIET, { density: 0, plans: PLANS });
    expect(none.ground.some((r) => r.kind === 'wild')).toBe(false);
    expect(isDead(none)).toBe(true);
    // (a faction's colonists and the pirates are as they were)
    const held = expanseLife('forest', biomes, { faction: { id: 'empire' }, traffic: 0.3, hazard: 'pirates' }, { density: 0, plans: PLANS });
    expect(held.ground.map((r) => r.name)).toEqual(['colonist', 'pirate']);
    expect(kindAt(held, 'a')).toBe('settled');
    expect(kindAt(held, 'b')).toBe('hostile');
  });

  it('walks a generated planet with its own fauna, a seeded one with its type’s', () => {
    const rows = randomSystems(60, 3).flat();
    const expanse = lookupOf(rows);
    const specs = rows.map((r) => specWith(r.id, { expanse })).filter((s) => s?.fauna?.density > 0);
    expect(specs.length).toBeGreaterThan(10);
    for (const spec of specs) {
      const wild = lifeWith(spec, { expanse }).ground.filter((r) => r.kind === 'wild');
      expect(wild.map((r) => r.body), spec.id).toEqual(spec.fauna.plans.map((p) => p.body));
      for (const r of wild) expect(r.perKm2, spec.id).toBeCloseTo(0.3 * spec.fauna.density, 9);
    }
    // (the thirteen keep FAUNA[type]'s: an ice world's tauntauns)
    const ice = PLANETS.map((p) => planetSpecOf(p.id)).find((s) => s.type === 'ice' && s.id.startsWith('e:'));
    expect(ice?.fauna).toBeNull();
    expect(lifeFor(ice).ground.some((r) => r.model === 'tauntaun')).toBe(true);
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
