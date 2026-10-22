import { describe, expect, it } from 'vitest';
import { CROSS, GUN, gunHit, gunOpen, gunSpot, gunTransit, worldSpot } from './gunPortal';
import { T } from '../hyperspace3d/timeline';
import { portalAt } from '../jumps/timing';
import { POSITIONS, inSector, sectorOf } from './layout';
import { SHIP, SOLIDS, noseOf } from './ship';
import { MOONS } from './universes';
import { WONDERS } from './deep';

const ship = (over = {}) => ({ x: 0, y: 0, z: 300, heading: 0, pitch: 0, bank: 0, speed: 3, vy: 0, ...over });
const apart = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('the portal gun', () => {
  it('opens its portal dead ahead of the nose, facing back at the ship', () => {
    const s = ship({ heading: 0.7, pitch: 0.2 });
    const g = gunSpot(s);
    const n = noseOf(s);
    const d = apart(g.at, [s.x, s.y, s.z]);
    expect(d).toBeGreaterThanOrEqual(GUN.near - 1e-9);
    // on the nose line
    for (let i = 0; i < 3; i++) expect(g.at[i]).toBeCloseTo([s.x, s.y, s.z][i] + n[i] * d, 5);
    expect(g.normal).toEqual(n);
  });

  it('opens further ahead the faster the ship goes, but not out of sight', () => {
    expect(apart(gunSpot(ship({ speed: 12 })).at, [0, 0, 300])).toBeGreaterThan(apart(gunSpot(ship({ speed: 1 })).at, [0, 0, 300]));
    expect(apart(gunSpot(ship({ speed: 300 })).at, [0, 0, 300])).toBeLessThanOrEqual(GUN.far);
  });

  it('splats open, holds, then shuts', () => {
    expect(gunOpen(0)).toBe(0);
    expect(gunOpen(GUN.bolt)).toBe(0); // (the bolt's still flying)
    expect(gunOpen(GUN.bolt + GUN.open)).toBeGreaterThan(0.95);
    expect(gunOpen(GUN.life / 2)).toBeCloseTo(1, 5);
    expect(gunOpen(GUN.life)).toBe(0);
    expect(gunOpen(GUN.life + 1)).toBe(0);
    // shut early (the ship's through): closing from then
    expect(gunOpen(3, 2.9)).toBeLessThan(1);
    expect(gunOpen(2.9 + GUN.close, 2.9)).toBe(0);
  });

  it('takes a ship that flies through its middle while it is open, not one that goes by', () => {
    const g = gunSpot(ship());
    const [x, y, z] = g.at;
    const open = GUN.bolt + GUN.open + 0.1;
    expect(gunHit({ x, y, z: z + 1 }, { x, y, z: z - 1 }, g, open)).toBe(true);
    expect(gunHit({ x: x + GUN.r * 2, y, z: z + 1 }, { x: x + GUN.r * 2, y, z: z - 1 }, g, open)).toBe(false);
    expect(gunHit({ x, y, z: z + 1 }, { x, y, z: z - 1 }, g, GUN.bolt * 0.5)).toBe(false); // (not open yet)
    expect(gunHit({ x, y, z: z + 1 }, { x, y, z: z - 1 }, null, open)).toBe(false);
  });

  it('from anywhere at home, goes to Rick’s dimension and comes out beside one of its worlds, nose on it', () => {
    const s = ship({ x: 2400, z: -900, heading: 2.2, speed: 40 });
    expect(sectorOf(s.x, s.y, s.z)).toBe('main');
    const seen = new Set();
    for (let i = 0; i < MOONS.length; i++) {
      const t = gunTransit(s, () => (i + 0.5) / MOONS.length);
      expect(t.via).toBe('rmportal');
      expect(t.out.sector).toBe('rickmorty');
      seen.add(t.out.world);
      const o = t.out.ship;
      expect(sectorOf(o.x, o.y, o.z)).toBe('rickmorty');
      const at = POSITIONS[t.out.world];
      const [fx, , fz] = noseOf(o);
      const to = [at[0] - o.x, at[2] - o.z];
      expect((fx * to[0] + fz * to[1]) / Math.hypot(...to)).toBeGreaterThan(0.99);
      // near enough to see it whole, clear of it and of everything solid, coming out slowly
      const u = MOONS.find((m) => m.id === t.out.world);
      expect(apart([o.x, o.y, o.z], at)).toBeLessThan(u.size * 6);
      for (const so of SOLIDS) expect(apart([o.x, o.y, o.z], so.at)).toBeGreaterThan(so.reach);
      expect(o.speed).toBeGreaterThan(0);
      expect(o.speed).toBeLessThanOrEqual(SHIP.cruise);
    }
    // every one of them, by the roll
    expect(seen.size).toBe(MOONS.length);
  });

  it('shows each world from its day side, the sun at your back', () => {
    const sun = WONDERS.find((w) => w.id === 'curvesun').at;
    for (const m of MOONS) {
      const o = worldSpot(m.id);
      const at = POSITIONS[m.id];
      const out = [o.x - at[0], o.z - at[2]];
      const lit = [sun[0] - at[0], sun[2] - at[2]];
      const cos = (out[0] * lit[0] + out[1] * lit[1]) / (Math.hypot(...out) * Math.hypot(...lit));
      expect(cos).toBeGreaterThan(0.5);
    }
  });

  it('from Rick’s dimension, goes home and comes out facing the C-137 planet', () => {
    const s = ship({ ...Object.fromEntries(['x', 'y', 'z'].map((k, i) => [k, inSector('rickmorty', [300, 0, 900])[i]])) });
    const t = gunTransit(s);
    expect(t.via).toBe('rmportal-back');
    expect(t.out.sector).toBe('main');
    const o = t.out.ship;
    const home = POSITIONS.rickmorty;
    const [fx, , fz] = noseOf(o);
    const to = [home[0] - o.x, home[2] - o.z];
    expect((fx * to[0] + fz * to[1]) / Math.hypot(...to)).toBeGreaterThan(0.95);
  });
});

describe('flying into a Rick portal', () => {
  it('starts its jump with the portal about the screen’s height and closing in, before the flash', () => {
    expect(CROSS.from).toBeGreaterThan(T.drift);
    expect(CROSS.from).toBeLessThan(T.jump);
    const { grow, open, inside } = portalAt(CROSS.from / 1000, { aspect: 16 / 9 });
    expect(grow).toBeGreaterThan(0.4);
    expect(grow).toBeLessThan(0.65);
    expect(open).toBe(1);
    expect(inside).toBe(0);
  });

  it('goes through on its own only well after the jump would have had it through', () => {
    expect(CROSS.most * 1000).toBeGreaterThan(T.jump + 20 - CROSS.from + 1000);
  });
});
