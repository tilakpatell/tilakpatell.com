import { describe, expect, it } from 'vitest';
import { SYSTEMS } from '../galaxy/systems';
import { WONDERS, reachOf } from './deep';
import { HOME_RADIUS, POSITIONS, RIM, sectorOf } from './layout';
import { FIGHTERS, HULLS, SUBSYSTEMS, TURRETS, WARS, warFor } from './wars';

const all = Object.values(WARS);

describe('the wars', () => {
  it('has a war for every side, each with two sides and seven sectors', () => {
    expect(Object.keys(WARS).sort()).toEqual(['breakingbad', 'rickmorty', 'starwars']);
    for (const w of all) {
      expect(w.sides).toHaveLength(2);
      expect(w.sectors).toHaveLength(7);
      expect(typeof w.battleName(w.sectors[3])).toBe('string');
      expect(w.battleName(w.sectors[3]).length).toBeGreaterThan(3);
    }
    expect(warFor('starwars')).toBe(WARS.starwars);
    expect(warFor('nope')).toBeNull();
    expect(warFor(null)).toBeNull();
  });

  it('knows how every fighter and capital on every side flies, fights and is put together', () => {
    for (const w of all)
      for (const s of w.sides) {
        expect(s.fighters.length).toBeGreaterThan(1);
        expect(s.fighters.some((f) => f.role === 'bomber'), `${s.id} has bombers`).toBe(true);
        for (const f of s.fighters) {
          expect(FIGHTERS[f.kind], `${s.id} ${f.kind}`).toBeTruthy();
          expect(['fighter', 'interceptor', 'bomber']).toContain(f.role);
        }
        expect(s.capitals.filter((c) => c.role === 'flagship')).toHaveLength(1);
        for (const c of s.capitals) {
          expect(HULLS[c.kind], `${s.id} ${c.kind} hull`).toBeTruthy();
          expect(TURRETS[c.kind]?.length, `${s.id} ${c.kind} turrets`).toBeGreaterThan(1);
          expect(c.size).toBeGreaterThan(2);
          expect(c.hull).toBeGreaterThan(0);
        }
        expect(s.laser).toHaveLength(3);
        expect(s.turbo).toHaveLength(3);
      }
  });

  it('keeps the Lucrehulk’s batteries off the open bow between its ring’s arms', () => {
    // (scripts/capital-parts.mjs: no hull over or under the keel there)
    for (const [x, , z] of TURRETS.lucrehulk) expect(z > 0.3 && Math.abs(x) < 0.05, `${x}, ${z}`).toBe(false);
  });

  it('gives every flagship two shield generators, then a bridge, then a reactor', () => {
    for (const w of all)
      for (const s of w.sides) {
        const flag = s.capitals.find((c) => c.role === 'flagship');
        const subs = SUBSYSTEMS[flag.kind];
        expect(subs, flag.kind).toBeTruthy();
        expect(subs.filter((o) => o.kind === 'shieldgen' && o.phase === 1)).toHaveLength(2);
        expect(subs.filter((o) => o.kind === 'bridge' && o.phase === 2)).toHaveLength(1);
        expect(subs.filter((o) => o.kind === 'reactor' && o.phase === 3)).toHaveLength(1);
        for (const o of subs) {
          expect(o.at).toHaveLength(3);
          for (const v of o.at) expect(Math.abs(v)).toBeLessThanOrEqual(0.5);
          expect(o.r).toBeGreaterThan(0);
          expect(o.hp).toBeGreaterThan(0);
        }
      }
  });

  it('fights each war well clear of the home system, the wonders, the planets and the rim', () => {
    for (const w of all)
      for (const s of w.sectors) {
        const [x, y, z] = s.at;
        expect(Math.hypot(x, z), `${w.id} ${s.id} home`).toBeGreaterThan(HOME_RADIUS + 300);
        expect(Math.hypot(x, z), `${w.id} ${s.id} rim`).toBeLessThan(RIM.inner - 800);
        for (const o of WONDERS) expect(Math.hypot(x - o.at[0], y - o.at[1], z - o.at[2]) - reachOf(o), `${w.id} ${s.id} by ${o.id}`).toBeGreaterThan(400);
        for (const [id, at] of Object.entries(POSITIONS)) expect(Math.hypot(x - at[0], y - at[1], z - at[2]), `${w.id} ${s.id} by ${id}`).toBeGreaterThan(600);
      }
  });

  it('names the Star Wars sectors after the galaxy’s own systems, from the films and shows the site keeps to', () => {
    const ids = new Set(SYSTEMS.map((s) => s.id));
    for (const s of WARS.starwars.sectors) expect(ids.has(s.id), s.id).toBe(true);
    const words = JSON.stringify(WARS.starwars).toLowerCase();
    for (const banned of ['first order', 'resistance', 'starkiller', 'kylo', 'snoke', 'rey ', 'exegol', 'jakku', 'crait', 'finalizer', 'supremacy']) expect(words.includes(banned), banned).toBe(false);
  });

  it('fights Rick and Morty’s war in the main map: out from the Council’s picket to the Federation’s Earth, C-137', () => {
    const w = WARS.rickmorty;
    expect(w.ready).toBe(true);
    const [first, last] = [w.sectors[0], w.sectors[w.sectors.length - 1]];
    expect(first.id).toBe('picket');
    // (the Citadel is through the portal, in the Rick and Morty sector: the war stays this side)
    for (const s of w.sectors) expect(sectorOf(...s.at), s.id).toBe('main');
    expect(last.id).toBe('c137');
    expect(Math.hypot(...last.at.map((v, i) => v - POSITIONS.rickmorty[i]))).toBeLessThan(900);
    // (the Council's end is the Citadel's, the Federation's the Earth it took)
    expect(w.sides.map((s) => s.id)).toEqual(['council', 'federation']);
  });

  it('fights Breaking Bad’s war at its real places: out from Albuquerque toward the border and Don Eladio’s', () => {
    const w = WARS.breakingbad;
    expect(w.ready).toBe(true);
    const [first, last] = [w.sectors[0], w.sectors[w.sectors.length - 1]];
    expect(first.id).toBe('pollos');
    expect(Math.hypot(...first.at.map((v, i) => v - POSITIONS.breakingbad[i]))).toBeLessThan(900);
    expect(last.id).toBe('hacienda');
    // (each sector farther from Albuquerque than the one before: the war runs away from home, to Mexico)
    const out = w.sectors.map((s) => Math.hypot(...s.at.map((v, i) => v - POSITIONS.breakingbad[i])));
    for (let i = 1; i < out.length; i++) expect(out[i], w.sectors[i].id).toBeGreaterThan(out[i - 1]);
    expect(w.sides.map((s) => s.id)).toEqual(['gus', 'cartel']);
  });
});
