import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLACES, PLACE_KINDS, SPACE_LEVELS, createFinds, piecesFor, placesOf, readFound, spaceGoals } from './places';
import { SYSTEMS, hazardsOf, systemById } from './systems';
import { EDGE } from './space';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('placesOf', () => {
  it('gives every system three to six places, the same every time', () => {
    for (const sys of SYSTEMS) {
      const p = placesOf(sys);
      expect(p.length, sys.id).toBeGreaterThanOrEqual(3);
      expect(p.length, sys.id).toBeLessThanOrEqual(6);
      expect(placesOf(sys)).toEqual(p);
      expect(new Set(p.map((x) => x.id)).size).toBe(p.length);
    }
  });
  it('puts them out in the open: well past the moment round the planet, short of the edge, near its plane, apart', () => {
    for (const sys of SYSTEMS) {
      const p = placesOf(sys);
      for (const x of p) {
        const d = Math.hypot(x.at[0], x.at[2]);
        expect(d, `${sys.id} ${x.id}`).toBeGreaterThanOrEqual(PLACES.inner);
        expect(d, `${sys.id} ${x.id}`).toBeLessThanOrEqual(PLACES.outer);
        expect(PLACES.outer).toBeLessThan(EDGE - 200);
        expect(Math.abs(x.at[1])).toBeLessThanOrEqual(PLACES.height);
      }
      for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) expect(dist(p[i].at, p[j].at), `${sys.id} ${p[i].id} ${p[j].id}`).toBeGreaterThanOrEqual(PLACES.apart);
    }
  });
  it('keeps clear of the system’s hazards and the gas giant it orbits', () => {
    for (const sys of SYSTEMS) {
      const keep = [...hazardsOf(sys), ...(sys.parent ? [{ at: sys.parent.at, r: sys.parent.r * 1.6 }] : [])];
      for (const x of placesOf(sys)) for (const h of keep) expect(dist(x.at, h.at), `${sys.id} ${x.id}`).toBeGreaterThan(h.r + x.reach + 60);
    }
  });
  it('has no kind twice in a system, and each a name, a reach and a goal', () => {
    for (const sys of SYSTEMS) {
      const p = placesOf(sys);
      expect(new Set(p.map((x) => x.kind)).size).toBe(p.length);
      for (const x of p) {
        expect(PLACE_KINDS[x.kind], x.kind).toBeTruthy();
        expect(x.name.length).toBeGreaterThan(3);
        expect(x.goal).toBe(true);
        expect(x.place).toBe(true);
        expect(x.reach).toBeGreaterThan(0);
        if (x.kind === 'nebula') expect(x.r).toBe(0);
        else expect(x.r).toBeGreaterThan(0);
        expect(x.reach).toBeGreaterThanOrEqual(x.r);
      }
    }
  });
  it('spreads the kinds about: every kind turns up somewhere', () => {
    const seen = new Set(SYSTEMS.flatMap((s) => placesOf(s).map((x) => x.kind)));
    expect([...seen].sort()).toEqual(
      Object.keys(PLACE_KINDS)
        .filter((k) => !PLACE_KINDS[k].level)
        .sort(),
    );
  });
  it('names a derelict after a real ship of its era, never the sequels', () => {
    for (const sys of SYSTEMS) for (const x of placesOf(sys)) expect(x.name).not.toMatch(/Resistance|First Order|Starkiller|Supremacy|Raddus/);
    expect(placesOf(systemById('tatooine')).length).toBe(placesOf(systemById('tatooine')).length);
  });
});

describe('the game’s space levels', () => {
  it('leaves a system with no level as it was (Hoth’s places where they were, no pieces, no goal)', async () => {
    expect(await piecesFor('hoth')).toEqual([]);
    expect(spaceGoals('hoth')).toEqual([]);
    expect(placesOf(systemById('hoth')).map((x) => [x.kind, x.at])).toEqual([
      ['beacon', [259.1, -118, -666]],
      ['nebula', [1750.5, -136.9, 844.6]],
      ['wreck', [-914.6, -137, -1342.4]],
      ['comet', [1718.1, 19.7, 132.2]],
      ['outpost', [-1655, 171, 481.9]],
    ]);
  });
  it('sets each level clear of the system’s places, its moment and its planet', () => {
    for (const [id, level] of Object.entries(SPACE_LEVELS)) {
      const sys = systemById(id);
      if (!sys) continue; // (Fondor: a system lane E5 adds)
      for (const x of placesOf(sys)) expect(dist(x.at, level.at), `${id} ${x.id}`).toBeGreaterThan(level.r + x.reach + PLACES.clear);
      for (const p of sys.pieces ?? []) if (p.at) expect(dist(p.at, level.at), `${id} ${p.type}`).toBeGreaterThan(level.r + 300);
      expect(Math.hypot(...level.at)).toBeGreaterThan(PLACES.inner);
    }
  });
  it('places the pieces in the system, the hulls as backdrop of their own (never the war’s slots), each with its file', async () => {
    for (const id of ['endor', 'kamino', 'naboo']) {
      const pieces = await piecesFor(id);
      expect(pieces.length, id).toBeGreaterThan(3);
      const level = SPACE_LEVELS[id];
      for (const p of pieces) {
        expect(['capital', 'dock', 'station', 'backdrop', 'rock']).toContain(p.kind);
        expect(p.url).toMatch(/^\/models\/galaxy\/space\/[a-z0-9-]+\.glb$/);
        if (p.kind !== 'backdrop') expect(dist(p.at, level.at), `${id} ${p.model}`).toBeLessThan(level.r + 1);
      }
      expect(pieces.some((p) => p.kind === 'capital')).toBe(true);
      // (the level's reach as its pack measures it)
      const pack = JSON.parse(readFileSync(new URL(`../../data/galaxy/space/${id}.json`, import.meta.url), 'utf8'));
      expect(level.r, id).toBeGreaterThanOrEqual(pack.radius);
      expect(spaceGoals(id)[0]).toMatchObject({ id: 'space-level', goal: true, r: 0 });
    }
  });
});

describe('finds', () => {
  const memory = () => {
    let v = null;
    return { get: () => v, set: (s) => (v = s) };
  };
  it('counts a place found once', () => {
    const store = memory();
    const f = createFinds({ store });
    const [a, b] = placesOf(systemById('hoth'));
    expect(f.count('hoth')).toEqual({ found: 0, of: placesOf(systemById('hoth')).length });
    expect(f.mark('hoth', a.id)).toBe(true);
    expect(f.mark('hoth', a.id)).toBe(false);
    expect(f.mark('hoth', b.id)).toBe(true);
    expect(f.count('hoth').found).toBe(2);
    expect(f.found('hoth')).toEqual([a.id, b.id]);
    expect(f.found('endor')).toEqual([]);
    expect(f.has('hoth', a.id)).toBe(true);
    expect(f.has('endor', a.id)).toBe(false);
  });
  it('keeps them in the store, and believes only what’s in shape', () => {
    const store = memory();
    const f = createFinds({ store });
    f.mark('hoth', placesOf(systemById('hoth'))[0].id);
    expect(createFinds({ store }).count('hoth').found).toBe(1);
    expect(readFound('not json')).toEqual({});
    expect(readFound('[1,2]')).toEqual({});
    expect(readFound(JSON.stringify({ hoth: ['x', 3], endor: 'no', 7: [] }))).toEqual({ hoth: ['x'], 7: [] });
    expect(readFound(null)).toEqual({});
    expect(readFound(undefined)).toEqual({});
    expect(readFound(7)).toEqual({});
    // (or already parsed, as lib/hooks's local.get hands it over)
    expect(readFound({ hoth: ['x'], endor: 'no' })).toEqual({ hoth: ['x'] });
    // (an unknown place in the store is kept: a later version may know it, and it costs nothing)
    const total = f.total();
    expect(total).toEqual({ found: 1, of: SYSTEMS.reduce((n, s) => n + placesOf(s).length, 0) });
  });
  it('lives for the page with no store', () => {
    const f = createFinds({ store: { get: () => { throw new Error('no'); }, set: () => { throw new Error('no'); } } });
    expect(f.mark('hoth', 'x')).toBe(true);
    expect(f.has('hoth', 'x')).toBe(true);
  });
});
