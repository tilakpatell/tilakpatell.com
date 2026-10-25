import { describe, expect, it } from 'vitest';
import { POI_NAMES, chartedAt, clutterOf, generatedSpecOf, groundRadius } from './generated';
import { sphereField } from './sphereField';
import { angleBetween, chartOf, dirOfUv } from './sphere';
import { planetSpecOf as specWith } from './planetSpec';
import { PLANE_CLIMATE, TYPE_LOOK } from './planetTables';
import { varietyOf } from './variety';
import { fold } from './fnl';
import { MOONS, lookupOf, randomSystems } from './fixtures/generated';
import { PLANETS, planetSpecOf } from './fixtures/expanse.js';

// every key a roster spec has (its 17 and ROSTER_EXTRA's)
const KEYS = Object.keys(planetSpecOf('hoth'));
const rows = randomSystems(60, 4).flat();
const lookup = lookupOf(rows);
const landable = rows.filter((r) => !['gas', 'ringed'].includes(r.type)).slice(0, 40);
const expanse = (id) => lookup(id) ?? MOONS.find((m) => m.id === id) ?? null;

// each landable spec once, for the tests that only read it (each test stays under a second)
const built = new Map();
const specOf = (r) => {
  if (!built.has(r.id)) built.set(r.id, specWith(r.id, { expanse }));
  return built.get(r.id);
};

describe('generatedSpecOf', () => {
  it('makes a round planet of every landable type, and a moon, with every field a spec has', () => {
    expect(new Set(landable.map((r) => r.type)).size).toBeGreaterThanOrEqual(5);
    for (const r of [...landable, ...MOONS]) {
      const s = specOf(r);
      for (const k of KEYS) expect(k in s, `${r.id} ${k}`).toBe(true);
      expect(s.round.radius).toBeGreaterThanOrEqual(15000);
      expect(s.round.radius).toBeLessThanOrEqual(60000);
      expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    }
  });

  it('sizes the ground from the universe radius', () => {
    expect(groundRadius({ radius: 18 })).toBe(15000);
    expect(groundRadius({ radius: 70 })).toBe(60000);
    expect(groundRadius({ radius: 140 })).toBe(60000);
    expect(groundRadius({ radius: 44 })).toBe(37500);
    expect(groundRadius({})).toBe(15000);
    // a moon's ground is the smallest, whatever its row says
    expect(groundRadius({ ...MOONS[0], radius: 44 })).toBe(15000);
    expect(groundRadius({ radius: 3 })).toBe(15000);
  });

  it('puts its places on dry, gentle land, apart, and starts the chart at the first', () => {
    let placed = 0;
    for (const r of landable) {
      const s = specOf(r);
      const f = sphereField(s);
      s.pois.forEach((p, i) => {
        expect(POI_NAMES[p.kind]).toBe(p.name);
        expect(f.sample(p.dir).h).toBeGreaterThan((s.water?.level ?? -Infinity) + 3);
        for (const q of s.pois.slice(0, i)) expect(angleBetween(p.dir, q.dir)).toBeGreaterThanOrEqual(0.3);
        placed++;
      });
      if (s.pois.length) expect(Math.hypot(...s.pois[0].at)).toBe(0);
    }
    expect(placed).toBeGreaterThan(landable.length);
  });

  it('places each kind its variety names, in turn, sized and named as a POI is', () => {
    for (const r of landable) {
      const s = specOf(r);
      const kinds = varietyOf(r).poiKinds;
      expect(s.pois.map((p) => p.kind)).toEqual(kinds.filter((k) => s.pois.some((p) => p.kind === k)));
      s.pois.forEach((p, i) => {
        expect(p.id).toBe(`poi-${i}`);
        expect(p.r).toBeGreaterThanOrEqual(60);
        expect(p.r).toBeLessThanOrEqual(140);
        expect(p.edge).toBeGreaterThanOrEqual(80);
        expect(p.edge).toBeLessThanOrEqual(120);
        // its chart spot is where its direction is, to the centimetre
        const [x, z] = chartOf(s.round.at, s.round.radius).toChart(p.dir);
        expect(Math.abs(p.at[0] - x)).toBeLessThanOrEqual(0.005 + 1e-9);
        expect(Math.abs(p.at[1] - z)).toBeLessThanOrEqual(0.005 + 1e-9);
        expect(p.at.every((v) => !Object.is(v, -0))).toBe(true);
      });
    }
  });

  it('starts the chart on dry, gentle land where it has no places', () => {
    const bare = randomSystems(400, 5).flat().filter((r) => !['gas', 'ringed'].includes(r.type) && varietyOf(r).poiKinds.length === 0).slice(0, 3);
    expect(bare.length).toBeGreaterThan(0);
    for (const r of bare) {
      const s = generatedSpecOf(r, r.type);
      expect(s.pois).toEqual([]);
      const { h, slope } = sphereField(s).sample(s.round.at);
      expect(h, r.id).toBeGreaterThan((s.water?.level ?? -Infinity) + 4);
      expect(slope, r.id).toBeLessThan(0.12);
    }
  });

  it('gives the seeded thirteen no new places', () => {
    for (const p of PLANETS.slice(37)) expect(planetSpecOf(p.id).pois).toEqual([]);
  });

  it('charts again at any spot: the origin and the POIs move, nothing else', () => {
    const s = specOf(landable[0]);
    const t = chartedAt(s, dirOfUv(0.1, 0.3));
    expect(angleBetween(t.round.at, dirOfUv(0.1, 0.3))).toBeLessThan(1e-12);
    expect({ ...t, round: null, pois: null }).toEqual({ ...s, round: null, pois: null });
    expect(t.pois.map((p) => p.dir)).toEqual(s.pois.map((p) => p.dir));
    expect(t.round.radius).toBe(s.round.radius);
    // back at its own spot, it's the spec it was
    expect(chartedAt(t, s.round.at)).toEqual(s);
  });

  it('leaves a plane spec, and a spot that is no direction, as they were', () => {
    const gas = specWith(rows.find((r) => r.type === 'gas').id, { expanse });
    expect(chartedAt(gas, [0, 1, 0])).toBe(gas);
    const s = specOf(landable[0]);
    for (const bad of [[0, 0, 0], [NaN, 1, 0], null]) expect(chartedAt(s, bad), String(bad)).toBe(s);
  });

  it('is the same spec from any lookup that knows the row (the universe’s or the flight’s)', () => {
    for (const r of landable.slice(0, 10)) expect(specWith(r.id, { expanse: [r] })).toEqual(specOf(r));
    expect(specWith(landable[0].id.toUpperCase(), { expanse: [landable[0]] })).toEqual(specOf(landable[0]));
  });

  it('wears its variety in the flight: the sky in its palette, the haze in its fog', () => {
    const s = specOf(landable[1]);
    expect(s.palette.skyLow).toBe(s.sky.low);
    expect(s.fog.far).toBe(Math.round(21000 - 9000 * s.sky.haze));
    expect(s.fog.near).toBe(Math.round(1500 - 900 * s.sky.haze));
    const v = varietyOf(landable[1]);
    expect(s).toMatchObject({ palette: v.palette, sky: v.sky, weather: v.weather, flora: v.flora, fauna: v.fauna, character: v.character, exotic: v.exotic });
  });

  it('is its row’s: its name, its family as its type, its seed folded as the seeded planets’ are, never to be built on', () => {
    const r = landable[2];
    expect(specOf(r)).toMatchObject({ id: r.id, name: r.name, type: r.type, seed: fold(BigInt(r.seed)), kind: 'planet', parent: null, buildable: false, soft: false, step: 0, pits: [], landmarks: [], hero: null });
    const moon = specOf(MOONS[1]);
    expect(moon).toMatchObject({ kind: 'moon', parent: MOONS[1].parent, type: 'ice' });
  });

  it('recolours its template’s ground and keeps its own heights and water in it', () => {
    for (const r of landable) {
      const s = specOf(r);
      const g = TYPE_LOOK[s.type].ground;
      const p = s.ground.palette;
      for (const k of ['low', 'high', 'rock', 'deep']) expect(p[k], `${r.id} ${k}`).toBe(varietyOf(r).palette[k]);
      // (a lava planet's accent is its glow and an ocean's its sea, neither a
      // colour for patches of ground: theirs keep the template's)
      expect(p.accent, r.id).toBe(['lava', 'ocean'].includes(s.type) ? g.palette.accent : varietyOf(r).palette.accent);
      expect(p.hLow).toBe((s.water?.level ?? 0) + 2);
      expect(p.hHigh).toBe(Math.min(500, Math.max(60, s.character.peaks * 0.5)));
      expect(s.ground.detail).toBe(g.detail);
      if (g.palette.wet) expect(p.wet).toEqual({ ...g.palette.wet, level: s.water.level });
      if (s.water) expect(s.water).toEqual({ kind: varietyOf(r).water.kind, level: 0, ...(varietyOf(r).water.colour ? { colour: varietyOf(r).water.colour } : {}) });
    }
  });

  it('thins or thickens its trees by its flora, and sets out an exotic’s own', () => {
    const forest = landable.find((r) => r.type === 'forest') ?? { ...landable[0], type: 'forest' };
    const s = generatedSpecOf(forest, 'forest');
    expect(s.clutter).toEqual(clutterOf('forest', s.flora, s.exotic));
    const trunk = TYPE_LOOK.forest.clutter.find((c) => c.kind === 'trunk');
    expect(s.clutter.find((c) => c.kind === 'trunk').perKm2).toBeCloseTo(trunk.perKm2 * s.flora.density, 9);
    expect(s.clutter.find((c) => c.kind === 'rock')).toEqual(TYPE_LOOK.forest.clutter.find((c) => c.kind === 'rock'));
    // the ice template's spires are thinned as its trees are
    const ice = clutterOf('ice', { family: 'ice', density: 0.25, pick: 0 }, null);
    expect(ice.find((c) => c.kind === 'spire').perKm2).toBeCloseTo(TYPE_LOOK.ice.clutter.find((c) => c.kind === 'spire').perKm2 * 0.25, 9);
    // an exotic's own rows, after the template's
    const flora = { family: 'desert', density: 0.1, pick: 0.5 };
    const plain = clutterOf('rock', flora, null);
    expect(plain).toEqual(TYPE_LOOK.rock.clutter);
    expect(clutterOf('rock', flora, 'crystal')).toEqual([...plain, { kind: 'crystal', perKm2: 25, depth: 5 }]);
    expect(clutterOf('rock', flora, 'spires')).toEqual([...plain, { kind: 'spire', perKm2: 30, depth: 5, size: 1.4 }]);
    for (const e of ['glowing', 'floating']) expect(clutterOf('rock', flora, e), e).toEqual([...plain, { kind: 'trunk', perKm2: 14, depth: 5 }]);
    // two rows of a kind at one depth would be seeded alike and stand on each
    // other (leafMesh.js), so an exotic's row takes the place of the template's
    const spiky = clutterOf('ice', { family: 'ice', density: 0.25, pick: 0 }, 'spires');
    expect(spiky.filter((c) => c.kind === 'spire')).toEqual([{ kind: 'spire', perKm2: 30, depth: 5, size: 1.4 }]);
    expect(spiky.map((c) => c.kind)).toEqual(TYPE_LOOK.ice.clutter.map((c) => c.kind));
    // (a forest has its trunks already)
    expect(clutterOf('forest', s.flora, 'glowing')).toEqual(clutterOf('forest', s.flora, null));
    // and the template's own rows are never the spec's to change
    expect(clutterOf('forest', s.flora, null)[0]).not.toBe(trunk);
  });

  it('keeps a gas giant a plane cloud deck, recoloured', () => {
    const g = rows.find((r) => r.type === 'gas');
    const s = specWith(g.id, { expanse });
    expect(s).toMatchObject({ round: null, soft: true, pois: [], water: null, buildable: false, climate: PLANE_CLIMATE, character: null });
    expect(s.ground.palette).toEqual({ low: s.palette.low, high: s.palette.high, rock: s.palette.rock });
    expect(s.biomes.map((b) => b.id)).toEqual(planetSpecOf('bespin').biomes.map((b) => b.id));
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    // nothing grows on a cloud deck, a glowing one's either
    expect(s.clutter).toEqual(TYPE_LOOK.gas.clutter);
    expect(clutterOf('gas', null, 'glowing')).toEqual(TYPE_LOOK.gas.clutter);
  });

  it('has no spec for a row with no whole seed, and never throws', () => {
    const r = landable[0];
    for (const seed of [undefined, '', '1.5', 'x']) expect(specWith(r.id, { expanse: [{ ...r, seed }] }), String(seed)).toBeNull();
  });

  it('shows several biomes on its sphere', () => {
    let many = 0;
    for (const r of landable) {
      const f = sphereField(specOf(r));
      const count = new Map();
      for (let j = 0; j < 32; j++) for (let i = 0; i < 64; i++) { const b = f.biomeAt(dirOfUv((i + 0.5) / 64, (j + 0.5) / 32)); count.set(b, (count.get(b) ?? 0) + 1); }
      const big = [...count.values()].filter((n) => n >= 0.03 * 2048).length;
      expect(big, r.id).toBeGreaterThanOrEqual(2);
      if (big >= 3) many++;
    }
    expect(many / landable.length).toBeGreaterThanOrEqual(0.9);
  });
});
