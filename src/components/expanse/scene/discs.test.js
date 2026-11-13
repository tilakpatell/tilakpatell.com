import { describe, expect, it } from 'vitest';
import { addBodies } from '../gen/systems';
import { fullSector } from '../gen/space';
import { UNIVERSE } from '../gen/seed';
import { THING_KINDS } from '../gen/things';
import { orbitAt } from '../gen/orbits';
import { createDiscs, pickDiscs } from './discs';

const planet = (id, type, at) => ({ id, name: id, type, radius: 30, color: '#888888', at, orbit: 400, moons: 0, rings: false, seed: 1n });
// two systems by hand, 35,000 apart, and a wonder of each kind
const HAND = addBodies({
  id: 'E:5,0',
  origin: [400000, 0, 0],
  systems: [
    { id: 'E:5,0:0', at: [390000, 0, 0], star: { class: 'G', color: '#fff4ea', size: 150 }, planets: [planet('E:5,0:0:0', 'rock', [390400, 0, 0])] },
    { id: 'E:5,0:1', at: [390000, 0, 50000], star: { class: 'M', color: '#ffb56c', size: 90 }, planets: [planet('E:5,0:1:0', 'ocean', [390000, 0, 50400])] },
  ],
  wonders: ['nebula', 'pulsar', 'derelict'].map((kind, k) => ({ id: `E:5,0:w${k}`, kind, at: [392000 + k * 1000, 0, -22000], size: 400 })),
});

// the far layer's writer, recording
const writer = () => {
  const got = [];
  return {
    got,
    begin: () => (got.length = 0),
    push: (x, y, z, r, cr, cg, cb, lx, ly, lz, alpha, key, rough) => got.push({ at: [x, y, z], r, c: [cr, cg, cb], l: [lx, ly, lz], alpha, key, rough }),
    end() {},
  };
};

describe('pickDiscs', () => {
  const xyzr = Float64Array.from([0, 0, -100, 1, 0, 0, -5000, 1, 0, 0, -60000, 100, 0, 0, -2000, 1, 0, 0, -2000, 1]);
  it('keeps what is within the far plane and its own size, the nearest, far to near, ties by index', () => {
    expect([...pickDiscs(xyzr, 5, [0, 0, 0], { far: 45000, max: 10 })]).toEqual([1, 3, 4, 0]);
    expect([...pickDiscs(xyzr, 5, [0, 0, 0], { far: 45000, max: 2 })]).toEqual([3, 0]);
    expect([...pickDiscs(xyzr, 5, [0, 0, 0], { far: 59950, max: 9 })]).toEqual([2, 1, 3, 4, 0]); // (60,000 off, 100 across: in reach of 59,950)
  });
});

describe('the discs fed', () => {
  it('pushes a near system’s star and planets whole, a far one fading, and the wonders but the nebula', () => {
    const w = writer();
    const discs = createDiscs(w, { budget: { discs: 100 } });
    const cam = [390000, 0, -10000]; // (10,000 from A, 60,000 from B: past the far plane)
    discs.feed([HAND], cam, 1000);
    const byAt = (at) => w.got.find((d) => d.at.every((v, i) => Math.abs(v - at[i]) < 1e-6));
    const starA = byAt([390000, 0, 0]);
    expect(starA).toMatchObject({ r: 150, l: [0, 0, 0], alpha: 1, rough: 0 });
    const pA = byAt(orbitAt(HAND.systems[0].planets[0], 1000));
    expect(pA.alpha).toBe(1);
    expect(pA.r).toBe(30);
    // (lit from its star)
    const toStar = [390000 - pA.at[0], 0 - pA.at[1], 0 - pA.at[2]];
    pA.l.forEach((v, i) => expect(v).toBeCloseTo(toStar[i], 6));
    expect(byAt([390000, 0, 50000])).toBeUndefined();
    expect(w.got.filter((d) => d.r === 400 * 0.15 || d.r === 400 * 0.12)).toHaveLength(2); // (the pulsar and the derelict; no nebula)
    expect(discs.count()).toBe(w.got.length);
  });

  it('fades a system out over the far plane’s last fifth', () => {
    const w = writer();
    const discs = createDiscs(w, { budget: { discs: 100 } });
    discs.feed([HAND], [390000, 0, 50000 - 40000], 0); // (B 40,000 off: in the fade)
    const starB = w.got.find((d) => d.r === 90);
    expect(starB.alpha).toBeGreaterThan(0);
    expect(starB.alpha).toBeLessThan(1);
  });

  it('leaves out a system drawn whole, and keeps no more than the budget', () => {
    const w = writer();
    const discs = createDiscs(w, { budget: { discs: 1 } });
    discs.feed([HAND], [390000, 0, -10000], 0, new Set(['E:5,0:0']));
    expect(w.got).toHaveLength(1);
    expect(w.got[0].r).not.toBe(150);
  });

  it('leaves a wonder near enough to be a mesh to nearThings.js', () => {
    const w = writer();
    createDiscs(w, { budget: { discs: 100 } }).feed([HAND], [391800, 0, -22000], 0);
    expect(w.got.filter((d) => d.r === 400 * 0.15)).toHaveLength(0); // (the pulsar, 60 across, 1,200 off: a mesh within 1,800)
    expect(w.got.filter((d) => d.r === 400 * 0.12)).toHaveLength(1); // (the derelict, 48 across, 2,200 off: past its 1,440, a disc)
  });

  it('draws the lattice’s things past where they are meshes, to THING_DISC, fading', () => {
    const sector = fullSector(UNIVERSE, 3, 0, 0);
    const sectorAt = (sx, sy, sz) => (sx === 3 && sy === 0 && sz === 0 ? sector : null);
    const t = sector.things;
    const i = [...t.size].findIndex((s) => s < 140);
    const at = [sector.origin[0] + t.at[i * 3], sector.origin[1] + t.at[i * 3 + 1], sector.origin[2] + t.at[i * 3 + 2]];
    const discAt = (w) => w.got.find((d) => d.at.every((v, k) => Math.abs(v - at[k]) < 0.5));
    const look = (dy) => {
      const w = writer();
      createDiscs(w, { budget: { discs: 4000 } }).feed([], [at[0], at[1] + dy, at[2]], 0, null, sectorAt);
      return discAt(w);
    };
    expect(look(15000)).toMatchObject({ r: t.size[i], alpha: 1 });
    // (a rock, ice or a derelict lumpy; a rogue world smooth)
    expect(look(15000).rough > 0).toBe(['rock', 'ice', 'derelict'].includes(THING_KINDS[t.kind[i]].kind));
    const fading = look(18000);
    expect(fading.alpha).toBeGreaterThan(0);
    expect(fading.alpha).toBeLessThan(1);
    expect(look(21000)).toBeUndefined(); // (past THING_DISC)
    expect(look(t.size[i] * 20)).toBeUndefined(); // (a mesh there)
  });

  it('fades a sector’s discs with its specks, and draws none of one not shown', () => {
    const half = writer();
    createDiscs(half, { budget: { discs: 100 } }).feed([HAND], [390000, 0, -10000], 0, null, null, () => 0.5);
    const starA = half.got.find((d) => d.r === 150);
    expect(starA.alpha).toBe(0.5);
    const none = writer();
    createDiscs(none, { budget: { discs: 100 } }).feed([HAND], [390000, 0, -10000], 0, null, null, () => 0);
    expect(none.got).toHaveLength(0);
  });

  it('eases every disc in again after a jump, over ten frames at least', () => {
    const w = writer();
    const discs = createDiscs(w, { budget: { discs: 100 } });
    const starA = () => w.got.find((d) => d.r === 150)?.alpha ?? 0;
    discs.feed([HAND], [390000, 0, -10000], 0);
    expect(starA()).toBe(1);
    discs.feed([HAND], [390000, 0, -5000], 0, null, null, null, 1 / 60); // (a jump of 5,000)
    expect(starA()).toBe(0);
    const seen = [];
    for (let i = 0; i < 12; i++) {
      discs.feed([HAND], [390000, 0, -5000], 0, null, null, null, 2); // (slow frames, two seconds each)
      seen.push(starA());
    }
    for (let i = 1; i < seen.length; i++) expect(seen[i] - seen[i - 1]).toBeLessThanOrEqual(0.1 + 1e-9);
    expect(seen.at(-1)).toBe(1);
  });

  it('keys each disc by its id when asked, the same every frame', () => {
    const w = writer();
    const discs = createDiscs(w, { budget: { discs: 100 }, keyed: true });
    discs.feed([HAND], [390000, 0, -10000], 0);
    const keys = w.got.map((d) => d.key);
    discs.feed([HAND], [390000, 0, -10000], 5);
    expect(w.got.map((d) => d.key)).toEqual(keys);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((k) => k >= 0)).toBe(true);
  });
});
