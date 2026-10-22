import { describe, expect, it } from 'vitest';
import { BODIES, MAP_RADIUS, ORDER, POSITIONS, REACH, SECTORS, SECTOR_OF, SECTOR_RADIUS, inSector, sectorOf, sectorOut } from './layout';
import { WONDERS, reachOf } from './deep';
import { SECTOR } from '../../lib/space/address';
import { OPEN_SPACE, SPACE, spawn, step } from './ship';

describe('the sectors', () => {
  it('tells which sector a point is in, by where it is', () => {
    expect(sectorOf(0, 0, 0)).toBe('main');
    expect(sectorOf(...inSector('rickmorty', [0, 0, 0]))).toBe('rickmorty');
    // (every point inside either edge is its own sector's)
    for (const sec of Object.values(SECTORS)) {
      for (let a = 0; a < 6.3; a += 0.4) {
        const p = inSector(sec.id, [Math.cos(a) * sec.edge, 0, Math.sin(a) * sec.edge]);
        expect(sectorOf(...p), `${sec.id} at ${a.toFixed(1)}`).toBe(sec.id);
        expect(sectorOut(p[0], p[2]).out).toBeCloseTo(sec.edge, 6);
      }
    }
  });

  it('keeps the main map where it was, and sizes it by its own bodies only', () => {
    for (const id of ORDER) expect(SECTOR_OF[id], id).toBe('main');
    expect(MAP_RADIUS).toBe(SECTOR_RADIUS.main);
    expect(MAP_RADIUS).toBeLessThan(SECTORS.main.edge);
    const rm = BODIES.filter((id) => SECTOR_OF[id] === 'rickmorty');
    expect(rm.length).toBeGreaterThanOrEqual(4);
    const o = SECTORS.rickmorty.origin;
    for (const id of rm) expect(Math.hypot(POSITIONS[id][0] - o[0], POSITIONS[id][2] - o[2]) + REACH[id], id).toBeLessThanOrEqual(SECTOR_RADIUS.rickmorty + 1e-9);
    expect(SECTOR_RADIUS.rickmorty).toBeLessThan(SECTORS.rickmorty.edge);
  });

  it('fits the main map inside the Expanse’s middle sector, and the Rick and Morty pocket in the one past it', () => {
    // (lib/space/address.js's SECTOR is written out from scale.js's SPREAD: the two grow together)
    expect(SECTORS.main.edge).toBeLessThan(SECTOR / 2);
    const rm = SECTORS.rickmorty;
    expect(-rm.origin[2] - rm.edge).toBeGreaterThanOrEqual(SECTOR / 2);
    expect(-rm.origin[2] + rm.edge).toBeLessThan(SECTOR * 1.5);
  });

  it('puts every wonder in the sector it says, inside that sector’s edge', () => {
    for (const w of WONDERS) {
      const sec = SECTORS[w.sector ?? 'main'];
      expect(sectorOf(...w.at), w.id).toBe(sec.id);
      expect(Math.hypot(w.at[0] - sec.origin[0], w.at[2] - sec.origin[2]) + reachOf(w), w.id).toBeLessThan(sec.edge);
    }
  });

  it('turns the ship back at the Rick and Morty sector’s own edge, toward its middle', () => {
    const sec = SECTORS.rickmorty;
    // (just inside the edge, flying straight out along +x)
    let s = { ...spawn(null), x: sec.origin[0] + sec.edge - 5, y: 0, z: sec.origin[2], heading: -Math.PI / 2, speed: 40 };
    let edge = false;
    for (let t = 0; t < 8; t += 1 / 60) {
      const r = step(s, { throttle: 0.5 }, 1 / 60, [], SPACE);
      if (r.events.some((e) => e.type === 'edge')) edge = true;
      s = r.ship;
      expect(sectorOut(s.x, s.z).out).toBeLessThanOrEqual(sec.edge + 1e-6);
      expect(sectorOf(s.x, s.y, s.z)).toBe('rickmorty');
    }
    expect(edge).toBe(true);
    // (and by now it's heading back in)
    expect(sectorOut(s.x, s.z).out).toBeLessThan(sec.edge);
  });

  it('flies on past the main edge into the Expanse when the space is open, and never turns back there', () => {
    let s = { ...spawn(null), x: SECTORS.main.edge - 5, y: 0, z: 0, heading: -Math.PI / 2, speed: 300 };
    for (let t = 0; t < 30; t += 1 / 60) {
      const r = step(s, { throttle: 1, boost: true }, 1 / 60, [], OPEN_SPACE);
      expect(r.events.some((e) => e.type === 'edge')).toBe(false);
      s = r.ship;
    }
    expect(s.x).toBeGreaterThan(SECTORS.main.edge + 100);
    expect(sectorOf(s.x, s.y, s.z)).toMatch(/^E:/);
    // (the same flight on the authored map alone is turned back, as ever)
    let t0 = { ...spawn(null), x: SECTORS.main.edge - 5, y: 0, z: 0, heading: -Math.PI / 2, speed: 300 };
    for (let t = 0; t < 4; t += 1 / 60) t0 = step(t0, { throttle: 1 }, 1 / 60, [], SPACE).ship;
    expect(Math.hypot(t0.x, t0.z)).toBeLessThanOrEqual(SECTORS.main.edge + 1e-6);
  });

  it('walls the Rick and Morty pocket off from the Expanse round it', () => {
    const o = SECTORS.rickmorty.origin;
    // (from out in the Expanse, flying straight at its middle)
    let s = { ...spawn(null), x: o[0], y: 0, z: o[2] - SECTORS.rickmorty.edge - 30, heading: Math.PI, speed: 60 };
    expect(sectorOf(s.x, s.y, s.z)).toMatch(/^E:/);
    let edge = false;
    for (let t = 0; t < 6; t += 1 / 60) {
      const r = step(s, { throttle: 1 }, 1 / 60, [], OPEN_SPACE);
      if (r.events.some((e) => e.type === 'edge')) edge = true;
      s = r.ship;
      expect(sectorOf(s.x, s.y, s.z)).not.toBe('rickmorty');
    }
    expect(edge).toBe(true);
  });
});

