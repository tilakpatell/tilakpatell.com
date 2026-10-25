import { describe, expect, it } from 'vitest';
import { PALETTE, tint } from '../../universe/shared/space';
import { PLANET_TYPES } from './tables';
import { CATALOGUE, KINDS, PLANET_SIZE, discRadius, hexOf, lookOf, rowSolids, solidOf } from './catalogue';

const LANE2 = { rock: '#8a8178', ice: '#cfe3ee', derelict: '#6d727c', rogue: '#4a3f38' };

describe('the catalogue', () => {
  it('has the spec’s 23 entries in its order, at least 20, each drawn as its own kinds', () => {
    expect(CATALOGUE.map((c) => c.n)).toEqual(Array.from({ length: 23 }, (_, i) => i + 1));
    expect(CATALOGUE.length).toBeGreaterThanOrEqual(20);
    const kinds = CATALOGUE.flatMap((c) => c.kinds);
    expect(kinds).toHaveLength(32);
    expect(new Set(kinds).size).toBe(32);
    expect(Object.keys(KINDS).sort()).toEqual([...kinds].sort());
    for (const c of CATALOGUE) for (const k of c.kinds) expect(KINDS[k].n, k).toBe(c.n);
    expect(CATALOGUE[22].kinds).toEqual(['hole', 'arc', 'hulk', 'giant', 'dyson']);
  });
  it('tints every kind from the palette, and keeps lane 2’s four colours', () => {
    for (const [k, row] of Object.entries(KINDS)) {
      expect(row.color, k).toMatch(/^#[0-9a-f]{6}$/);
      expect(PALETTE[row.tint[0]], k).toBeDefined();
      if (!LANE2[k]) expect(row.color, k).toBe(hexOf(tint(...row.tint)));
    }
    for (const [k, hex] of Object.entries(LANE2)) expect(KINDS[k].color).toBe(hex);
    expect(hexOf(PALETTE.sun.linear)).toBe(PALETTE.sun.hex);
  });
  it('says what is solid, as a share of its size, at where it is now', () => {
    expect(solidOf({ id: 'E:1,0:w64', kind: 'rock', at: [1, 2, 3], size: 50 })).toEqual({ id: 'E:1,0:w64', at: [1, 2, 3], r: 50, reach: 60 });
    expect(solidOf({ id: 'p', kind: 'pulsar', at: [0, 0, 0], size: 80 })).toEqual({ id: 'p', at: [0, 0, 0], r: 20, reach: 24 });
    expect(solidOf({ id: 'c', kind: 'comet', at: [5, 5, 5], size: 10 }, [9, 9, 9]).at).toEqual([9, 9, 9]);
    // (passable on purpose: a storm, a herd, a swarm, debris, a field's drift and the clouds; a fleet is solid ship by ship, Task 7)
    for (const kind of ['field', 'icefield', 'pocket', 'remnant', 'storm', 'wormhole', 'debris', 'herd', 'swarm', 'fleet', 'nebula', 'hole', 'arc', 'hulk', 'giant', 'dyson']) {
      expect(solidOf({ id: 'x', kind, at: [0, 0, 0], size: 100 }), kind).toBeNull();
    }
    const rock = { id: 'E:1,0:w64', kind: 'rock', at: [1, 2, 3], size: 50 };
    expect(rowSolids(rock)).toEqual([solidOf(rock)]);
    expect(rowSolids({ id: 's', kind: 'storm', at: [0, 0, 0], size: 2000 })).toEqual([]);
  });
  it('draws a beacon’s disc three times its size, but its own size in the core', () => {
    expect(discRadius('beacon', 20)).toBe(60);
    expect(discRadius('beacon', 20, { core: true })).toBe(20);
    expect(discRadius('rock', 50, { core: true })).toBe(50);
    expect(discRadius('storm', 3000)).toBe(0);
  });
  it('knows which kinds others draw, and which may sit in the core', () => {
    expect(Object.values(KINDS).filter((k) => !k.near).map((k) => k.kind).sort()).toEqual(['arc', 'dyson', 'giant', 'hole', 'hulk', 'nebula', 'pocket', 'remnant', 'station', 'system']);
    expect(Object.values(KINDS).filter((k) => k.core).map((k) => k.kind).sort()).toEqual(['beacon', 'comet', 'derelict', 'field', 'ice', 'icefield', 'monolith', 'nebula', 'outpost', 'relay', 'rig', 'rock', 'rogue', 'station', 'system']);
  });
  it('reads an unknown kind as a plain grey thing', () => expect(lookOf('nonsense')).toEqual({ color: KINDS.rock.color, lit: true, disc: 1 }));
  it('measures a planet by the generator’s own radii', () => {
    const w = PLANET_TYPES.reduce((s, p) => s + p.weight, 0);
    expect(PLANET_SIZE).toBeCloseTo(PLANET_TYPES.reduce((s, p) => s + (p.weight * (p.radius[0] + p.radius[1])) / 2, 0) / w, 9);
    expect(PLANET_SIZE).toBeCloseTo(54.04, 1);
  });
});
