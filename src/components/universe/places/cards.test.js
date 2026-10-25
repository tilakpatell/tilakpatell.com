import { describe, expect, it } from 'vitest';
import { PLACE } from '../words';
import { PARK_GAP, clearOf } from '../ship';
import { THING_KINDS, WONDER_KINDS, fullSector, placeIn, thingRow, UNIVERSE } from '../../expanse/shared/gen';
import { parseSpaceId } from '../../../lib/space/address';
import { FAR } from '../../expanse/shared/levels';
import { THING_CARDS, placeCard, placeLook, placeReach } from './cards';

const s = fullSector(UNIVERSE, 1, 0, 0);
const found = (id) => {
  const f = placeIn(s, parseSpaceId(id));
  const p = parseSpaceId(id);
  const system = f.kind === 'station' ? s.systems[f.row.i] : s.systems[p.system];
  return { ...f, system, planet: p.moon !== undefined ? system.planets[p.planet] : undefined };
};

describe('a generated place’s card', () => {
  it('parks by ship.js’s own numbers', () => {
    expect(PARK_GAP).toEqual({ near: 4, deep: 16, in: 8, out: 14 });
    expect(clearOf(10)).toBeCloseTo(14.15, 12);
    expect(clearOf(2)).toBeCloseTo(4.15, 12);
  });
  it('has a card for every kind the generator makes, so a new kind needs one', () => {
    for (const k of [...THING_KINDS.map((t) => t.kind), ...WONDER_KINDS]) expect(THING_CARDS[k], k).toBeDefined();
    expect(THING_CARDS.nebula.solid).toBe(false);
    for (const [k, c] of Object.entries(THING_CARDS)) {
      expect(c.move === undefined || typeof c.move === 'function', k).toBe(true);
      expect(c.at, k).toBeUndefined(); // (a mover is `move`: a Destination's `at` is a position)
      expect(c.far, k).toBe(FAR); // (lane 2's far plane, the one around.js lists by)
    }
    expect(placeCard({ kind: 'thing', row: thingRow(s, 0), sector: s }).move).toBeNull();
  });
  it('says a system’s star, its planets, who holds it and how busy it is', () => {
    const sys = s.systems[0];
    const c = placeCard(found(sys.id));
    expect(c).toMatchObject({ kind: 'star', sub: sys.star.class, name: sys.name, type: PLACE.system(PLACE.star[sys.star.class]), r: sys.star.size, reach: sys.star.size * 2, deep: true, span: sys.reach, dock: false, land: false });
    expect(c.about).toMatch(/^An? .+, held by .+\.$/);
    expect(c.facts.map(([k]) => k)).toEqual([PLACE.facts.planets, PLACE.facts.held, PLACE.facts.traffic, ...(sys.hazard ? [PLACE.facts.hazard] : [])]);
  });
  it('sizes a planet by its rings, lands on a rocky one, never on a giant', () => {
    const planets = s.systems.flatMap((x) => x.planets);
    for (const p of planets.slice(0, 200)) {
      const c = placeCard(found(p.id));
      expect(c.reach).toBe(Math.max(1.9 * p.radius, p.ringBand?.outer ?? 0));
      expect(c.land).toBe(!['gas', 'ringed'].includes(p.type));
      expect(c.type).toBe(PLACE.planet[p.type]);
    }
  });
  it('docks at a station, and parks things further off than bodies', () => {
    const st = placeCard(found(s.stations[0].id));
    expect(st).toMatchObject({ kind: 'station', dock: true, reach: s.stations[0].size * 1.5, deep: false, type: PLACE.station });
    const row = thingRow(s, 0);
    expect(placeCard({ kind: 'thing', row, sector: s })).toMatchObject({ kind: 'wonder', sub: row.kind, r: row.size, reach: row.size * 1.2, deep: true, type: PLACE.thing[row.kind] });
  });
  it('writes in the house style', () => {
    const texts = [...s.systems.slice(0, 20).map((x) => placeCard(found(x.id)).about), placeCard(found(s.stations[0].id)).about];
    for (const t of texts) {
      expect(t).not.toMatch(/'|"|\bcolor|\bcenter/);
      expect(t).not.toMatch(/held by The /);
    }
  });
});

describe('the rest of a generated place’s card', () => {
  it('says which planet and system a moon is round, and lands on it', () => {
    const planet = s.systems.flatMap((x) => x.planets).find((q) => q.moonList.length);
    const m = planet.moonList[0];
    const sys = s.systems[parseSpaceId(m.id).system];
    const c = placeCard(found(m.id));
    expect(c).toMatchObject({ kind: 'world', sub: m.type, name: m.name, type: PLACE.moon[m.type], r: m.radius, reach: 1.9 * m.radius, deep: false, solid: true, dock: false, land: true, system: sys.id, faction: sys.faction, span: null, move: null });
    expect(c.about).toBe(`${PLACE.moon[m.type]} of ${planet.name}, round ${sys.name}.`);
    expect(c.facts).toEqual([[PLACE.facts.planet, planet.name], [PLACE.facts.system, sys.name]]);
  });
  it('gives a planet its system’s id and faction, and its moons and rings as facts', () => {
    const planets = s.systems.flatMap((x) => x.planets);
    const ringed = planets.find((p) => p.ringBand);
    const c = placeCard(found(ringed.id));
    const sys = s.systems[parseSpaceId(ringed.id).system];
    expect(c).toMatchObject({ kind: 'world', sub: ringed.type, name: ringed.name, color: ringed.color, r: ringed.radius, system: sys.id, faction: sys.faction, span: null });
    expect(c.facts).toEqual([[PLACE.facts.system, sys.name], [PLACE.facts.moons, String(ringed.moonList.length)], [PLACE.facts.rings, PLACE.yes]]);
    expect(c.about.endsWith(' and rings.')).toBe(true);
    const bare = planets.find((p) => !p.ringBand && !p.moonList.length);
    expect(placeCard(found(bare.id)).about).toMatch(/, with no moons\.$/);
    const one = planets.find((p) => !p.ringBand && p.moonList.length === 1);
    expect(placeCard(found(one.id)).about).toMatch(/, with 1 moon\.$/);
  });
  it('says who holds a station and how busy its system is', () => {
    const row = s.stations[0];
    const sys = s.systems[row.i];
    const c = placeCard(found(row.id));
    expect(c).toMatchObject({ sub: 'station', name: row.name, r: row.size, solid: true, land: false, system: sys.id, faction: sys.faction, color: '#9fd8ff' });
    expect(c.facts).toEqual([[PLACE.facts.system, sys.name], [PLACE.facts.held, sys.faction.name], [PLACE.facts.traffic, PLACE.traffic(sys.traffic)]]);
    expect(c.about.startsWith(`A station over ${sys.name}’s star, held by `)).toBe(true);
    const withOne = placeCard(found(sys.id)).about;
    expect(withOne).toContain(' and a station, held by ');
  });
  it('flies right through a nebula, and gives a kind it doesn’t know the default card', () => {
    const cloud = { id: 'E:2,0:w0', kind: 'nebula', name: 'Veil', at: [1, 2, 3], size: 2000, seed: 1n };
    expect(placeCard({ kind: 'wonder', row: cloud, sector: s })).toMatchObject({ kind: 'wonder', sub: 'nebula', name: 'Veil', type: PLACE.thing.nebula, about: PLACE.about.nebula, r: 0, reach: 0, solid: false, deep: true, color: THING_CARDS.nebula.color, facts: [], system: null, faction: null, dock: false, land: false });
    const odd = placeCard({ kind: 'extra', row: { id: 'E:2,0:w3', kind: 'something new', at: [0, 0, 0], size: 10 }, sector: s });
    expect(odd).toMatchObject({ sub: 'something new', name: PLACE.thing.default, type: PLACE.thing.default, about: PLACE.about.default, r: 10, reach: 12, solid: true });
  });
  it('finds a body’s system and planet from its sector when they aren’t given, and is nothing without', () => {
    const planet = s.systems.flatMap((x) => x.planets).find((q) => q.moonList.length);
    const m = planet.moonList[0];
    for (const id of [planet.id, m.id, s.stations[0].id]) {
      const f = placeIn(s, parseSpaceId(id));
      expect(placeCard({ ...f }), id).toEqual(placeCard(found(id)));
      expect(placeCard({ ...f, sector: { ...s, systems: [] } }), id).toBeNull();
    }
    expect(placeCard(null)).toBeNull();
    expect(placeCard({ kind: 'system' })).toBeNull();
  });
  it('has words for every star, planet and moon it is asked about', () => {
    for (const x of [s, fullSector(UNIVERSE, 2, 1, -3, { things: false })]) {
      const ids = x.systems.flatMap((sys) => [sys.id, ...sys.planets.flatMap((p) => [p.id, ...p.moonList.map((mo) => mo.id)])]);
      for (const id of [...ids, ...x.stations.map((st) => st.id)]) {
        const c = placeCard(placeIn(x, parseSpaceId(id)));
        const words = [c.name, c.type, c.about, ...c.facts.flat()];
        expect(words.every((w) => typeof w === 'string' && w && !w.includes('undefined')), id).toBe(true);
      }
    }
  });
  it('counts in words, and names a faction mid-sentence', () => {
    expect(PLACE.about.system({ star: 'Orange star', planets: 0, station: false, held: 'Independent' })).toBe('An orange star with no planets, held by Independent.');
    expect(PLACE.about.system({ star: 'Red dwarf', planets: 1, station: true, held: PLACE.held('The DEA') })).toBe('A red dwarf with 1 planet and a station, held by the DEA.');
    expect(PLACE.traffic(0.9)).toBe('Busy');
    expect(PLACE.traffic(0.4)).toBe('Some');
    expect(PLACE.traffic(0.1)).toBe('Quiet');
  });
});

describe('a generated place’s look, without its card', () => {
  it('is the card’s own, from the row alone, for every kind', () => {
    const planets = s.systems.flatMap((x) => x.planets);
    const mooned = planets.find((q) => q.moonList.length);
    const ids = [s.systems[0].id, mooned.id, mooned.moonList[0].id, planets.find((q) => q.ringBand).id, s.stations[0].id];
    const rows = [...ids.map((id) => found(id)), { kind: 'thing', row: thingRow(s, 0), sector: s }, { kind: 'wonder', row: { id: 'E:2,0:w0', kind: 'nebula', name: 'Veil', at: [1, 2, 3], size: 2000 }, sector: s }];
    for (const f of rows) {
      const card = placeCard(f);
      const look = placeLook(f.kind, f.row);
      expect(Object.keys(look).sort(), f.row.id).toEqual(['color', 'deep', 'kind', 'move', 'name', 'r', 'reach', 'solid', 'sub']);
      expect(card, f.row.id).toMatchObject(look);
      expect(placeReach(f.kind, f.row), f.row.id).toBe(card.reach);
    }
  });
});
