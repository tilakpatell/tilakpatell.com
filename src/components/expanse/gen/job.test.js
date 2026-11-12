import { describe, expect, it } from 'vitest';
import { fullSector } from './space';
import { UNIVERSE, universeOf } from './seed';
import { beyondJob, beyondKeys, sectorJob, starsOf, withMoons } from './job';

describe('a sector made in a worker', () => {
  it('is fullSector, once its moons are put back', () => {
    const { answer } = sectorJob({ type: 'sector', key: 'E:1,0', universe: UNIVERSE, sx: 1, sy: 0, sz: 0 });
    expect(answer.key).toBe('E:1,0');
    expect(answer.sector.systems.some((s) => s.planets.some((p) => 'moonList' in p))).toBe(false); // (left behind)
    expect(withMoons(answer.sector)).toEqual(fullSector(UNIVERSE, 1, 0, 0));
  });

  it('hands every typed array over, and a speck for every star and wonder', () => {
    const { answer, transfer } = sectorJob({ type: 'sector', key: 'k', universe: UNIVERSE, sx: 3, sy: -1, sz: 2 });
    const { sector, stars } = answer;
    expect(stars.count).toBe(sector.systems.length + sector.wonders.length);
    for (const a of [stars.at, stars.color, stars.r, sector.things.slot, sector.things.kind, sector.things.at, sector.things.size]) expect(transfer).toContain(a.buffer);
    // (from the sector's middle)
    const s0 = sector.systems[0];
    expect(stars.at[0]).toBeCloseTo(s0.at[0] - sector.origin[0], 2);
    expect(stars.r[0]).toBe(s0.star.size);
  });

  it('makes a pocket universe its own way, the same each time', () => {
    const word = universeOf('word');
    const { answer } = sectorJob({ type: 'sector', key: 'k', universe: word, sx: 0, sy: 0, sz: 1 });
    expect(withMoons(answer.sector)).toEqual(fullSector(word, 0, 0, 1));
    expect(withMoons(answer.sector).systems.map((s) => s.at)).not.toEqual(fullSector(UNIVERSE, 0, 0, 1).systems.map((s) => s.at));
  });

  it('makes a planet’s moons only when they are read', () => {
    const { answer } = sectorJob({ type: 'sector', key: 'k', universe: UNIVERSE, sx: 1, sy: 0, sz: 0 });
    const p = withMoons(answer.sector).systems.find((s) => s.planets.length).planets[0];
    const first = p.moonList;
    expect(p.moonList).toBe(first);
  });
});

describe('the sectors beyond', () => {
  it('rings the 3 × 3 × 3 at its next Chebyshev distance, the core included', () => {
    const one = beyondKeys([0, 0, 0], 1);
    expect(one).toHaveLength(98);
    expect(beyondKeys([5, 0, -2], 2)).toHaveLength(218);
    expect(one.every((k) => Math.max(...k.map(Math.abs)) === 2)).toBe(true);
    expect(beyondKeys([2, 0, 0], 1).some((k) => k.join() === '0,0,0')).toBe(true);
  });

  it('makes each sector once, and only the new face when the ring moves a sector over', () => {
    let made = 0;
    const make = (u, sx, sy, sz) => {
      made++;
      return { systems: [{ at: [sx * 120000, sy * 120000, sz * 120000], star: { size: 100, color: '#ffffff' } }] };
    };
    const cache = new Map();
    const a = beyondJob({ type: 'beyond', key: 'b', universe: UNIVERSE, centre: [0, 0, 0], ring: 1 }, cache, make);
    expect(made).toBe(98);
    expect(a.answer.stars.count).toBe(98);
    made = 0;
    beyondJob({ type: 'beyond', key: 'b', universe: UNIVERSE, centre: [1, 0, 0], ring: 1 }, cache, make);
    expect(made).toBeLessThanOrEqual(49);
    expect(made).toBeGreaterThan(0);
  });

  it('puts its specks from the centre’s middle, and hands them over', () => {
    const make = () => ({ systems: [{ at: [240000 + 5, 7, -3], star: { size: 90, color: '#ff8000' } }] });
    const { answer, transfer } = beyondJob({ type: 'beyond', key: 'b', universe: UNIVERSE, centre: [2, 0, 0], ring: 1 }, new Map(), make);
    expect([answer.stars.at[0], answer.stars.at[1], answer.stars.at[2]]).toEqual([5, 7, -3]);
    expect([...answer.stars.color.slice(0, 3)]).toEqual([255, 128, 0]);
    expect(transfer).toContain(answer.stars.at.buffer);
  });

  it('lists a sector’s stars from wherever it is asked', () => {
    const s = fullSector(UNIVERSE, 1, 0, 0, { things: false });
    const st = starsOf(s, [0, 0, 0]);
    expect(st.at[0]).toBeCloseTo(s.systems[0].at[0], -1);
  });
});
