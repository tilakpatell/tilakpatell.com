import { describe, expect, it } from 'vitest';
import { HOME_SCALE, HOME_SPREAD, LENGTH, SPREAD, WORLD_SCALE } from './scale';
import { LENGTH as SHIP_MODEL_LENGTH } from './shipModels';
import { POSITIONS, SUN } from './layout';
import { PLANETS, SHIP } from './ship';
import { TYPES } from './traffic';
import { STAR_DESTROYER } from './setpieces';
import { poseFor } from './poses';
import { SPREAD as SPREAD_WRITTEN, UNIVERSES, byId } from './universes';
import { WONDERS, reachOf } from './deep';
import { PHONE } from './phone';

const stations = PLANETS.filter((p) => byId(p.id).kind === 'core');
const worlds = PLANETS.filter((p) => {
  const u = byId(p.id);
  return u.kind === 'fandom' && !u.portal;
});
const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

describe('the home system against the ships (scale.js)', () => {
  it('has one ship length, and one ratio for the home system', () => {
    expect(SHIP_MODEL_LENGTH).toBe(LENGTH);
    expect(HOME_SPREAD).toBeCloseTo(Math.cbrt(HOME_SCALE), 9);
    // (universes.js writes HOME_SCALE out, having no imports: Home's base size is 0.6)
    expect(UNIVERSES.find((u) => u.id === 'home').size).toBeCloseTo(0.6 * 7 * HOME_SCALE, 9);
    // (and WORLD_SCALE: Middle-earth's base size is 0.66; the gate keeps its own, 5.36 × 28)
    expect(UNIVERSES.find((u) => u.id === 'middleearth').size).toBeCloseTo(0.66 * 28 * WORLD_SCALE, 9);
    expect(UNIVERSES.find((u) => u.id === 'starwars').size).toBeCloseTo(5.36 * 28, 9);
  });

  it('keeps the sizes in order: ship, station, world, star', () => {
    const smallestWorld = Math.min(...worlds.map((w) => w.r));
    const biggestWorld = Math.max(...worlds.map((w) => w.r));
    const biggestStation = Math.max(...stations.map((s) => s.r));
    // a world about four times a station across (it was 3.7 before the stations grew; 1.25 between)
    expect(smallestWorld / biggestStation).toBeGreaterThan(3.5);
    expect((2 * smallestWorld) / LENGTH).toBeGreaterThan(350);
    // and every deep-space star bigger than every world
    const stars = WONDERS.filter((w) => w.kind === 'star');
    expect(stars.length).toBeGreaterThan(0);
    for (const s of stars) expect(s.r, s.id).toBeGreaterThan(biggestWorld);
  });

  it('draws the great things of deep space bigger than any world', () => {
    const biggestWorld = Math.max(...worlds.map((w) => w.r));
    const big = (id, r) => expect(r, id).toBeGreaterThan(biggestWorld * 1.2);
    for (const w of WONDERS) {
      if (w.kind === 'star' || w.kind === 'gas-giant' || w.kind === 'ice-giant' || w.kind === 'nebula') big(w.id, w.r);
      if (w.kind === 'binary') {
        big(w.id, w.r);
        big(`${w.id}'s second sun`, w.pair.r);
        expect(w.pair.apart, w.id).toBeGreaterThan(w.r + w.pair.r); // (two suns, not one inside the other)
      }
      // a black hole's shadow, the black sphere you see, and its disk round it
      if (w.kind === 'black-hole') {
        big(w.id, w.r);
        expect(w.disk, w.id).toBeGreaterThan(4 * w.r);
      }
      // a pulsar and a white dwarf are small stars, as they are: their glare
      // and their field of wrecks still reach further than any world
      if (w.kind === 'pulsar' || w.kind === 'graveyard') big(w.id, reachOf(w));
    }
    big('the Star Wars gate', UNIVERSES.find((u) => u.portal).size);
  });

  it('keeps a star bigger than its own planets, and the Citadel bigger than any station', () => {
    for (const w of WONDERS.filter((x) => x.kind === 'star')) for (const p of w.planets) expect(p.r, w.id).toBeLessThan(w.r / 2);
    const citadel = WONDERS.find((w) => w.kind === 'citadel');
    for (const s of stations) expect(citadel.r).toBeGreaterThan(3 * s.r);
  });

  it('keeps the phone out past the belt (the way to Dickansh’s world) bigger than a station', () => {
    const home = stations.find((s) => s.id === 'home');
    // (its height as phone.js measures it, 1.15 of its scale each way; phone.test.js keeps it under the ceiling)
    expect(2 * PHONE.scale * 1.15).toBeGreaterThan(2 * home.r);
  });

  it('draws every station far bigger than the ship, and the sun bigger again', () => {
    for (const s of stations) expect((2 * s.r) / LENGTH).toBeGreaterThan(80);
    const home = stations.find((s) => s.id === 'home');
    expect((2 * home.r) / LENGTH).toBeGreaterThan(90);
    const biggest = Math.max(...stations.map((s) => s.r));
    expect(SUN.r).toBeGreaterThan(3.5 * biggest);
  });

  // (0.16 when the map was first drawn, 0.09 by 2026-10-05, 0.16 to 0.18 now
  // the ring's out past the bigger sun's glow)
  it('gives the stations room, but not so much they shrink to specks across it', () => {
    // each station against the gap to the next one round the ring
    const ring = stations.map((s) => ({ ...s, a: Math.atan2(s.at[2], s.at[0]) })).sort((a, b) => a.a - b.a);
    ring.forEach((s, i) => {
      const next = ring[(i + 1) % ring.length];
      expect((2 * s.r) / flat(s.at, next.at)).toBeGreaterThan(0.15);
    });
  });

  it('keeps every station smaller than any world, and the sun under the ceiling', () => {
    const smallest = Math.min(...worlds.map((w) => w.r));
    for (const s of stations) expect(s.r).toBeLessThan(smallest);
    expect(SUN.r).toBeLessThan(SHIP.ceiling - 20);
  });

  it('keeps the stations out of the brightest of the sun’s glow, and the sun bigger than any world', () => {
    const ring = flat(POSITIONS.home, SUN.at);
    expect(ring / SUN.r).toBeGreaterThan(1.8); // (sun.js's corona: 0.10 of its brightest out there)
    expect(SUN.r).toBeGreaterThan(1.2 * Math.max(...worlds.map((w) => w.r)));
  });

  // (parking backs off with a station's size, so the parked view gains least:
  // the next station along was 0.55 of the ship on screen at the old scale,
  // 0.97 with the stations grown, 0.87 with the ring out past the bigger sun)
  it('from parked at a station, the next one along looks about as big as the ship', () => {
    const p = poseFor('station');
    const ship = LENGTH / Math.hypot(...p.at.map((v, i) => v - p.eye[i]));
    const others = stations.filter((s) => s.id !== 'home');
    const nearest = others.reduce((a, b) => (flat(a.at, p.eye) < flat(b.at, p.eye) ? a : b));
    const station = 2 * Math.atan(nearest.r / Math.hypot(...nearest.at.map((v, i) => v - p.eye[i])));
    expect(station / ship).toBeGreaterThan(0.85);
  });

  it('no ship out-sizes a station: not the traffic’s Star Destroyer, nor the set piece’s', () => {
    const smallest = Math.min(...stations.map((s) => 2 * s.r));
    for (const [kind, t] of Object.entries(TYPES)) expect(t.size, kind).toBeLessThan(smallest);
    expect(STAR_DESTROYER).toBeLessThan(smallest);
  });
});

describe('the gaps between the places (scale.js’s SPREAD)', () => {
  it('spreads the map eight times, and universes.js writes the same number out', () => {
    expect(SPREAD).toBe(8);
    expect(SPREAD_WRITTEN).toBe(SPREAD);
  });
});
