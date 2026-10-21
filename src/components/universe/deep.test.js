import { describe, expect, it } from 'vitest';
import { DEEP, DEEP_SOLIDS, PLACES, STARS, WONDERS, beyondOf, binaryAt, moveBinaries, nearestPlace, nearestStar, openness, parseWonder, planetAt, reachOf, wonderById } from './deep';
import { GOALS } from './ship';
import { HOME_RADIUS, ORDER, POSITIONS, REACH, SECTORS, SECTOR_OF, inSector, sectorOf } from './layout';
import { MOONS, byId } from './universes';

describe('deep space', () => {
  it('puts every wonder well out past the home system and inside the edge, within the ceiling', () => {
    for (const w of WONDERS) {
      const sec = SECTORS[sectorOf(...w.at)];
      expect(sec.id, w.id).toBe(w.sector ?? 'main');
      const r = Math.hypot(w.at[0] - sec.origin[0], w.at[2] - sec.origin[2]);
      if (sec.id === 'main') expect(r - reachOf(w), w.id).toBeGreaterThan(DEEP.open + 40);
      expect(r + reachOf(w), w.id).toBeLessThan(sec.edge - 20);
      expect(Math.abs(w.at[1]) + (w.kind === 'nebula' ? 0 : w.r), w.id).toBeLessThan(DEEP.ceiling); // (a nebula's middle: it's thin at its edges)
    }
  });

  it('keeps the wonders clear of each other', () => {
    for (const a of WONDERS) {
      for (const b of WONDERS) {
        if (a.id >= b.id) continue;
        const gap = Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1], a.at[2] - b.at[2]);
        expect(gap, `${a.id} and ${b.id}`).toBeGreaterThan(reachOf(a) + reachOf(b) + 30);
      }
    }
  });

  it('makes the Citadel solid out to its domes and down its crystal, not in the space between', () => {
    const w = WONDERS.find((x) => x.id === 'citadel');
    const k = w.r / 18; // (deepspace.js draws it for a radius of 18)
    const at = (x, y, z) => [w.at[0] + x * k, w.at[1] + y * k, w.at[2] + z * k];
    const solidAt = (p) => DEEP_SOLIDS.some((o) => Math.hypot(p[0] - o.at[0], p[1] - o.at[1], p[2] - o.at[2]) < o.r);
    // the four saucers out on its arms, a quarter turn apart and level, as
    // its model has them, and the crystal's tip
    for (const [x, y, z] of [
      [20.25, -0.4, 5.17],
      [-5.17, -0.4, 20.25],
      [-20.25, -0.4, -5.17],
      [5.17, -0.4, -20.25],
      [0, -15, 0],
    ])
      expect(solidAt(at(x, y, z)), `${x},${y},${z}`).toBe(true);
    // the great dome itself, to its rim
    for (const [x, y, z] of [
      [0, 4, 0],
      [11, 0.5, 0],
      [0, 0.5, -11],
      [0, -6, 0],
    ])
      expect(solidAt(at(x, y, z)), `${x},${y},${z}`).toBe(true);
    // between its arms, out past the great dome, and just over and past the
    // dome as it's drawn: open space (no wall of thin air round it)
    for (const [x, y, z] of [
      [17, 0, -17],
      [-17, 0, 17],
      [12, -24, 12],
      [0, 8.5, 0],
      [14.5, 0, -3],
      [10, 4.5, 10],
    ])
      expect(solidAt(at(x, y, z)), `${x},${y},${z}`).toBe(false);
    // and crashing into any of it is crashing into the Citadel
    const parts = DEEP_SOLIDS.filter((o) => o.id.startsWith('citadel-'));
    expect(parts.length).toBeGreaterThan(4);
    for (const o of parts) {
      expect(o.id.split('-')[0]).toBe('citadel');
      expect(o.part).toBe(true);
      // and not somewhere to fly to: the autopilot takes you to the Citadel
      expect(GOALS[o.id]).toBeUndefined();
    }
    expect(GOALS.citadel).toBeTruthy();
  });
  it('makes everything but the nebulae solid, a sun with its planets', () => {
    const ids = DEEP_SOLIDS.map((s) => s.id);
    expect(ids).toContain('aurelia');
    expect(ids).toContain('citadel');
    expect(ids).toContain('ember-2');
    expect(ids).not.toContain('veil');
    const ember = WONDERS.find((w) => w.id === 'ember');
    expect(DEEP_SOLIDS.find((s) => s.id === 'ember-2').at).toEqual(planetAt(ember, ember.planets[1]));
  });

  it('keeps the wonders clear of the fandoms’ planets, and stays closed round each planet', () => {
    for (const w of WONDERS) {
      for (const id of ORDER) {
        const gap = Math.hypot(w.at[0] - POSITIONS[id][0], w.at[1] - POSITIONS[id][1], w.at[2] - POSITIONS[id][2]);
        expect(gap, `${w.id} and ${id}`).toBeGreaterThan(reachOf(w) + REACH[id] + 60);
      }
    }
    for (const id of ORDER) {
      const [x, y, z] = POSITIONS[id];
      expect(openness(x + REACH[id] + 10, y, z), id).toBe(0);
      if (byId(id).kind === 'core') continue; // (the stations share the home system's space)
      // and some way out from it (whichever way is clear of the others) it's open
      const open = [0, 1, 2, 3, 4, 5, 6, 7].some((i) => openness(x + Math.cos(i * 0.785) * (REACH[id] + DEEP.near + DEEP.ramp + 1), y, z + Math.sin(i * 0.785) * (REACH[id] + DEEP.near + DEEP.ramp + 1)) === 1);
      expect(open, id).toBe(true);
    }
  });

  it('has one black hole, which swallows, with a friend’s universe on its far side', () => {
    expect(DEEP_SOLIDS.filter((s) => s.swallow).map((s) => s.id)).toEqual(['maw']);
    expect(beyondOf('maw')).toMatchObject({ name: expect.any(String), what: expect.any(String), url: expect.stringMatching(/^https:\/\/\S+$/) });
    for (const w of WONDERS) if (w.kind !== 'black-hole') expect(beyondOf(w.id), w.id).toBeNull();
    expect(beyondOf('nope')).toBeNull();
  });

  it('opens up smoothly from the home system out to open space', () => {
    expect(openness(0, 0, 0)).toBe(0);
    expect(openness(HOME_RADIUS, 0, 0)).toBe(0);
    expect(openness(HOME_RADIUS + DEEP.near, 0, 0)).toBe(0);
    // leaving home the way none of the planets lie
    const clear = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => i * 0.785).find((a) => openness(Math.cos(a) * (DEEP.open + 1), 0, Math.sin(a) * (DEEP.open + 1)) === 1);
    expect(clear).toBeDefined();
    const half = HOME_RADIUS + DEEP.near + DEEP.ramp / 2;
    const mid = openness(Math.cos(clear) * half, 0, Math.sin(clear) * half);
    expect(mid).toBeGreaterThan(0.4);
    expect(mid).toBeLessThan(0.6);
  });

  it('measures the home system as a ball: far over it, it’s open space', () => {
    expect(openness(0, 50000, 0)).toBe(1);
    expect(Math.abs(nearestPlace(0, 50000, 0).gap - (50000 - HOME_RADIUS))).toBeLessThan(1);
  });

  it('turns a binary’s suns round the point their masses balance at, apart by the same all the way round', () => {
    const w = WONDERS.find((x) => x.kind === 'binary');
    const p = w.pair.period;
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    for (const t of [0, p / 8, p / 4, p / 2, p * 0.9]) {
      const { a, b } = binaryAt(w, t);
      expect(dist(a, b)).toBeCloseTo(w.pair.apart, 6);
      // the middle stays put, nearer the bigger sun (masses as r³)
      const ma = w.r ** 3;
      const mb = w.pair.r ** 3;
      [0, 1, 2].forEach((i) => expect((a[i] * ma + b[i] * mb) / (ma + mb)).toBeCloseTo(w.at[i], 6));
      expect(dist(a, w.at)).toBeLessThan(dist(b, w.at));
      // and both inside its reach
      expect(dist(b, w.at) + w.pair.r).toBeLessThanOrEqual(reachOf(w) + 1e-9);
    }
    // a quarter of the way round, the second sun is a quarter turn on
    const b0 = binaryAt(w, 0).b;
    const b1 = binaryAt(w, p / 4).b;
    const u0 = [b0[0] - w.at[0], b0[2] - w.at[2]];
    const u1 = [b1[0] - w.at[0], b1[2] - w.at[2]];
    expect(u0[0] * u1[0] + u0[1] * u1[1]).toBeCloseTo(0, 6);
    expect(binaryAt(w, p).b[0]).toBeCloseTo(b0[0], 6);
  });

  it('moves the solids with the suns, so what you see is what you hit', () => {
    const w = WONDERS.find((x) => x.kind === 'binary');
    const one = DEEP_SOLIDS.find((s) => s.id === w.id);
    const two = DEEP_SOLIDS.find((s) => s.id === `${w.id}-2`);
    moveBinaries(w.pair.period / 3);
    const { a, b } = binaryAt(w, w.pair.period / 3);
    [0, 1, 2].forEach((i) => {
      expect(one.at[i]).toBeCloseTo(a[i], 6);
      expect(two.at[i]).toBeCloseTo(b[i], 6);
    });
    moveBinaries(0); // (back where the other tests expect them)
    expect(two.at[0]).toBeCloseTo(binaryAt(w, 0).b[0], 6);
  });

  it('has a pulsar, a binary star, a rogue planet and a wreck field among its wonders, each solid its own way', () => {
    const ids = WONDERS.map((w) => w.id);
    for (const id of ['lantern', 'twins', 'wanderer', 'graveyard']) expect(ids).toContain(id);
    const solids = Object.fromEntries(DEEP_SOLIDS.map((s) => [s.id, s]));
    // nobody flies anywhere near a pulsar: solid out to ten radii
    expect(solids.lantern.r).toBe(wonderById('lantern').r * 10);
    // two suns: two solids, the first the place itself, the second a part of it (hitting either is hitting the Twins)
    expect(solids.twins).toBeTruthy();
    expect(solids['twins-2']).toBeTruthy();
    expect(solids['twins-2'].part).toBe(true);
    expect(Math.hypot(...[0, 1, 2].map((i) => solids['twins-2'].at[i] - solids.twins.at[i]))).toBeCloseTo(wonderById('twins').pair.apart, 6);
    // (its reach from the point they go round: the further sun's swing and its radius, at any point in the orbit)
    const w = wonderById('twins');
    const swing = (w.pair.apart * w.r ** 3) / (w.r ** 3 + w.pair.r ** 3);
    expect(reachOf(w)).toBeCloseTo(Math.max(swing + w.pair.r, w.pair.apart - swing + w.r), 6);
    // a rogue planet with a ring reaches like any ringed world; the wreck field's hulls are a sight, not solid
    expect(reachOf(wonderById('wanderer'))).toBe(wonderById('wanderer').r * 2.3);
    expect(reachOf(wonderById('graveyard'))).toBe(wonderById('graveyard').field);
    expect(DEEP_SOLIDS.filter((s) => s.id.startsWith('graveyard'))).toHaveLength(1);
    // and none of them is a star a flare comes from
    expect(STARS.map((s) => s.id)).toEqual(['sun', 'ember', 'halcyon', 'curvesun']);
  });

  it('reads a wonder from a link, and nothing else', () => {
    expect(parseWonder('aurelia')).toBe('aurelia');
    expect(parseWonder('lantern')).toBe('lantern');
    for (const bad of ['marvel', 'home', 'AURELIA', '__proto__', 'constructor', '', null, undefined, 3]) expect(parseWonder(bad)).toBeNull();
  });

  it('knows its stars, and which is nearest', () => {
    expect(STARS.map((s) => s.id)).toEqual(['sun', 'ember', 'halcyon', 'curvesun']);
    expect(nearestStar(10, 0, 0).star.id).toBe('sun');
    const ember = WONDERS.find((w) => w.id === 'ember');
    expect(nearestStar(ember.at[0] + 200, ember.at[1], ember.at[2]).star.id).toBe('ember');
    expect(nearestStar(ember.at[0] + 200, ember.at[1], ember.at[2]).dist).toBeCloseTo(200, 3);
  });

  it('has the Rick and Morty sector: the Citadel at its middle, its worlds far apart round it, clear of its parts and each other', () => {
    const citadel = WONDERS.find((w) => w.id === 'citadel');
    expect(citadel.at).toEqual(inSector('rickmorty', [0, 0, 0]));
    const parts = DEEP_SOLIDS.filter((s) => s.id.startsWith('citadel'));
    for (const p of parts) expect(sectorOf(...p.at), p.id).toBe('rickmorty');
    expect(MOONS.length).toBe(10);
    for (const m of MOONS) {
      const at = POSITIONS[m.id];
      expect(SECTOR_OF[m.id], m.id).toBe('rickmorty');
      expect(sectorOf(...at), m.id).toBe('rickmorty');
      const d = Math.hypot(at[0] - citadel.at[0], at[1] - citadel.at[1], at[2] - citadel.at[2]);
      // (beacons on the horizon from the Citadel, never neighbours; well inside the sector's edge)
      expect(d, m.id).toBeGreaterThan(800);
      expect(d + REACH[m.id], m.id).toBeLessThan(SECTORS.rickmorty.edge - 200);
      expect(Math.abs(at[1]) + REACH[m.id], m.id).toBeLessThan(DEEP.ceiling);
      for (const p of parts) expect(Math.hypot(at[0] - p.at[0], at[1] - p.at[1], at[2] - p.at[2]), `${m.id} and ${p.id}`).toBeGreaterThan(p.r + REACH[m.id] + 40);
      for (const o of MOONS) if (o !== m) expect(Math.hypot(...[0, 1, 2].map((i) => at[i] - POSITIONS[o.id][i])), `${m.id} and ${o.id}`).toBeGreaterThan(1000);
      for (const w of WONDERS) if (w.id !== 'citadel') expect(Math.hypot(...[0, 1, 2].map((i) => at[i] - w.at[i])), `${m.id} and ${w.id}`).toBeGreaterThan(reachOf(w) + REACH[m.id] + 400);
      expect(byId(m.id).kind).toBe('moon');
      // (a place: the drive is shut right at it)
      expect(openness(at[0] + REACH[m.id] + 10, at[1], at[2]), m.id).toBe(0);
    }
    // and nothing of the main map's is in it
    for (const id of ORDER) expect(SECTOR_OF[id], id).toBe('main');
  });

  it('lights the sector from a sun of its own', () => {
    const o = SECTORS.rickmorty.origin;
    expect(nearestStar(o[0], o[1], o[2]).star.id).toBe('curvesun');
    expect(nearestStar(o[0], o[1], o[2]).dist).toBeLessThan(SECTORS.rickmorty.edge);
  });
});

describe('deep space, spread (scale.js’s SPREAD)', () => {
  const main = WONDERS.filter((w) => !w.sector);
  it('puts every main-sector wonder between 12,000 and 45,000 out', () => {
    for (const w of main) {
      const r = Math.hypot(w.at[0], w.at[2]);
      expect(r, w.id).toBeGreaterThan(12000);
      expect(r, w.id).toBeLessThan(45000);
    }
  });

  it('keeps every wonder further than 1.5 of its reach from any other place', () => {
    // (a portal sits beside its own planet: its door, not a neighbour)
    for (const w of main.filter((x) => x.kind !== 'portal')) {
      for (const p of PLACES) {
        if (p.id === w.id || p.kind === 'station' || p.kind === 'portal' || SECTOR_OF[p.id] === 'rickmorty' || p.at[2] < -60000) continue;
        const d = Math.hypot(...w.at.map((v, i) => v - p.at[i]));
        expect(d, `${w.id} and ${p.id}`).toBeGreaterThan(1.5 * reachOf(w));
      }
    }
  });
});
