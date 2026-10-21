import { describe, expect, it } from 'vitest';
import { HOME_RADIUS, MAP_RADIUS, ORDER, POSITIONS, REACH, RIM, SECTORS, SUN, keyStep, mapSectorOf, next, nextWorld, parseId, prev, sectorById, sectorOf, sectorOut } from './layout';
import { byId } from './universes';
import { DEEP, WONDERS } from './deep';

describe('the map layout', () => {
  it('keeps every universe clear of the others, moons and all', () => {
    for (const a of ORDER) {
      for (const b of ORDER) {
        if (a >= b) continue;
        const [ax, , az] = POSITIONS[a];
        const [bx, , bz] = POSITIONS[b];
        expect(Math.hypot(ax - bx, az - bz), `${a} and ${b}`).toBeGreaterThan(REACH[a] + REACH[b]);
      }
    }
  });

  it('keeps every universe inside the map radius', () => {
    for (const id of ORDER) expect(Math.hypot(POSITIONS[id][0], POSITIONS[id][2]) + REACH[id]).toBeLessThanOrEqual(MAP_RADIUS + 1e-9);
  });

  it('keeps the stations in the home system and sends the fandoms far out, well apart, with a journey between any two', () => {
    const fandoms = ORDER.filter((id) => byId(id).kind !== 'core');
    for (const id of ORDER) {
      const r = Math.hypot(POSITIONS[id][0], POSITIONS[id][2]);
      if (byId(id).kind === 'core') expect(r + REACH[id], id).toBeLessThan(HOME_RADIUS);
      else {
        expect(r - REACH[id], id).toBeGreaterThan(HOME_RADIUS + 750); // out past the home system: a real trip
        expect(Math.abs(POSITIONS[id][1]) + REACH[id], id).toBeLessThan(DEEP.ceiling); // under deep space's ceiling
      }
    }
    for (const a of fandoms) for (const b of fandoms) if (a < b) expect(Math.hypot(...POSITIONS[a].map((v, i) => v - POSITIONS[b][i])) - REACH[a] - REACH[b], `${a} and ${b}`).toBeGreaterThan(750);
  });

  it('rings the map with a rim of ice, out past everything and inside the edge', () => {
    expect(RIM.inner).toBeGreaterThan(MAP_RADIUS + 200);
    expect(RIM.outer).toBeLessThan(DEEP.edge - 300);
    expect(RIM.outer).toBeGreaterThan(RIM.inner + 300);
  });

  it('steps through the map in order and wraps', () => {
    expect(next('home')).toBe('experience');
    expect(next('terminal')).toBe('starwars');
    expect(next('starwars')).toBe('music');
    expect(next('travel')).toBe('caribbean');
    expect(next('caribbean')).toBe('invincible');
    expect(next('invincible')).toBe('potter');
    expect(next('potter')).toBe('home');
    expect(prev('home')).toBe('potter');
    expect(next(null)).toBe('home');
    expect(prev(null)).toBe('potter');
  });

  it('keeps the sun clear of everything', () => {
    for (const id of ORDER) expect(Math.hypot(POSITIONS[id][0], POSITIONS[id][2]), id).toBeGreaterThan(SUN.r + REACH[id] + 0.5);
  });

  it('reads only real ids from the URL', () => {
    expect(parseId('marvel')).toBe('marvel');
    for (const bad of ['MARVEL', '__proto__', 'constructor', 'toString', '', undefined, null, 42]) expect(parseId(bad)).toBeNull();
  });

  it('finds the next world page, skipping the ones that are not', () => {
    expect(nextWorld('office').id).toBe('rickmorty');
    expect(nextWorld('rickmorty').id).toBe('gaming');
    expect(nextWorld('gaming').id).toBe('travel');
    expect(nextWorld('travel').id).toBe('caribbean');
    expect(nextWorld('caribbean').id).toBe('invincible');
    expect(nextWorld('invincible').id).toBe('potter');
    expect(nextWorld('potter').id).toBe('starwars');
    expect(nextWorld('starwars').id).toBe('music');
    expect(nextWorld('albuquerque')?.id).toBe('starwars'); // not an id: starts from the top
    expect(nextWorld(null).id).toBe('starwars');
    expect(nextWorld('home').id).toBe('starwars'); // the stations aren't world pages
  });

  it('maps the focus group keys and leaves the rest alone', () => {
    expect(keyStep('ArrowRight', 'starwars')).toBe('music');
    expect(keyStep('ArrowDown', 'starwars')).toBe('music');
    expect(keyStep('ArrowLeft', 'starwars')).toBe('terminal');
    expect(keyStep('ArrowUp', null)).toBe('potter');
    expect(keyStep('Home', 'office')).toBe('home');
    expect(keyStep('End', 'office')).toBe('potter');
    expect(keyStep('Enter', 'office')).toBeUndefined();
    expect(keyStep('a', 'office')).toBeUndefined();
  });
});

describe('the asteroid belt', () => {
  it('sits in the gap between the stations and the planets, touching neither', async () => {
    const { BELT } = await import('./layout');
    for (const id of ORDER) {
      const r = Math.hypot(POSITIONS[id][0], POSITIONS[id][2]);
      expect(r + REACH[id] < BELT.inner || r - REACH[id] > BELT.outer, id).toBe(true);
    }
    expect(BELT.inner).toBeGreaterThan(SUN.r);
  });
});

// (scale.js's SPREAD: the places six times as far apart as they were on 2026-10-07)
describe('the spread', () => {
  const fandoms = ORDER.filter((id) => byId(id).kind !== 'core');
  const far = (id) => Math.hypot(POSITIONS[id][0], POSITIONS[id][2]);
  it('puts the nearest fandom 12,000 out and the main edge at 54,000', () => {
    expect(Math.min(...fandoms.map(far))).toBeCloseTo(12000, 0);
    expect(SECTORS.main.edge).toBe(54000);
    expect(RIM.inner).toBe(48000);
    expect(RIM.outer).toBe(51600);
  });

  it('keeps every fandom at least 3,900 from every other place, planets and wonders', () => {
    // (a portal is its planet's own door, beside it: not a place of its own)
    const others = [...ORDER.filter((id) => byId(id).kind !== 'core').map((id) => ({ id, at: POSITIONS[id] })), ...WONDERS.filter((w) => !w.sector && w.kind !== 'portal')];
    for (const id of fandoms) {
      for (const o of others) {
        if (o.id === id) continue;
        const d = Math.hypot(...POSITIONS[id].map((v, i) => v - o.at[i]));
        expect(d, `${id} and ${o.id}`).toBeGreaterThanOrEqual(3900);
      }
    }
  });

  it('moves the Rick and Morty sector out past the main edge, and the split with it', () => {
    expect(SECTORS.rickmorty.origin).toEqual([0, 0, -66000]);
    expect(sectorOf(0, 0, -66000)).toBe('rickmorty');
    expect(sectorOf(0, 0, -54000)).toBe('main');
    // (6,000 of open space between the two edges, as before the spread to six)
    expect(-SECTORS.rickmorty.origin[2] - SECTORS.rickmorty.edge - SECTORS.main.edge).toBe(6000);
  });

  it('puts the Expanse past both edges: E:sx,sz by the 120,000 grid, the authored sectors as they were', () => {
    expect(sectorOf(54000, 0, 0)).toBe('main');
    expect(sectorOf(54002, 0, 0)).toBe('E:0,0');
    expect(sectorOf(60001, 0, 0)).toBe('E:1,0');
    expect(sectorOf(-180001, 0, 300000)).toBe('E:-2,3');
    expect(sectorOf(0, 0, -66000 - 6000)).toBe('rickmorty');
    // (round the pocket, outside its edge, is the Expanse)
    expect(sectorOf(0, 0, -66000 - 6003)).toBe('E:0,-1');
    expect(sectorOf(45000, 0, -59500)).toBe('E:0,0');
    expect(mapSectorOf(135000, 0, 0)).toBe('main');
    expect(mapSectorOf(0, 0, -66000)).toBe('rickmorty');
    // (a point saved before the spread is still somewhere: the old pocket's middle is open main space now)
    expect(sectorOf(0, 0, -48000)).toBe('main');
    const sec = sectorById('E:1,-2');
    expect(sec.origin).toEqual([120000, 0, -240000]);
    expect(sec.edge).toBe(Infinity);
    expect(sectorById('main')).toBe(SECTORS.main);
    expect(sectorById('nowhere')).toBeNull();
  });

  it('keys sectors in 3D: layers above and below, and the pocket a ball', () => {
    expect(sectorOf(0, 70000, 0)).toBe('E:0,0,1');
    expect(sectorOf(0, 50000, 0)).toBe('main');
    expect(sectorOf(0, 5000, -66000)).toBe('rickmorty');
    expect(sectorOf(0, 6500, -66000)).toBe('E:0,-1');
    expect(sectorOf(4500, 4500, -66000)).toBe('E:0,-1');
    expect(sectorById('E:1,-2,3').origin).toEqual([120000, 360000, -240000]);
  });

  it('reads a junk sector key as no sector, not the origin’s', () => {
    for (const junk of ['E:1,0,x', 'E:', 'E:NaN,0', 'E:1', 'E:1,0,1,2']) expect(sectorById(junk), junk).toBeNull();
    // (a position that isn't a number reads as the main map's, never throws)
    expect(sectorOut(NaN, NaN).sec).toBe(SECTORS.main);
  });
});

