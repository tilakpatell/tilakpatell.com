import { beforeAll, describe, expect, it } from 'vitest';
import { SECTOR } from '../../../lib/space/address.js';
import { PLACES } from '../../universe/shared/space';
import { KEEP_OUTS, clearOfKeepOuts, keepOutsNear } from './keepOuts';
import { orbitAt } from './orbits';
import { UNIVERSE, rngOf } from './seed';
import { fullSector } from './space';
import { THING_NEAR } from './things';

const CELL = 9000;
const key = (x, y, z) => `${x},${y},${z}`;
const sectors = [];
const grid = new Map();

beforeAll(() => {
  for (let sx = -1; sx <= 1; sx++)
    for (let sy = -1; sy <= 1; sy++)
      for (let sz = -1; sz <= 1; sz++) sectors.push(fullSector(UNIVERSE, sx, sy, sz));
  const everything = [];
  for (const s of sectors) {
    for (const sys of s.systems) {
      everything.push(sys.at);
      for (const p of sys.planets) everything.push(orbitAt(p, 0));
    }
    for (let i = 0; i < s.things.count; i++)
      everything.push([0, 1, 2].map((a) => s.origin[a] + s.things.at[i * 3 + a]));
    for (const list of Object.values(s.extras)) for (const r of list) everything.push(r.at);
    for (const w of s.wonders) everything.push(w.at);
  }
  for (const p of PLACES) everything.push(p.at);
  for (const a of everything) {
    const k = key(...a.map((v) => Math.floor(v / CELL)));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(a);
  }
}, 60000);

function near(p) {
  const c = p.map((v) => Math.floor(v / CELL));
  let within9 = 0;
  let nearest = Infinity;
  for (let x = c[0] - 1; x <= c[0] + 1; x++)
    for (let y = c[1] - 1; y <= c[1] + 1; y++)
      for (let z = c[2] - 1; z <= c[2] + 1; z++)
        for (const a of grid.get(key(x, y, z)) ?? []) {
          const d = Math.hypot(a[0] - p[0], a[1] - p[1], a[2] - p[2]);
          if (d <= CELL) within9++;
          if (d < nearest) nearest = d;
        }
  return { within9, nearest };
}

describe('the 27 sectors round home', () => {
  it('has three things within 9,000 and one within 6,000 of 1,000 points', () => {
    const rng = rngOf(2026n);
    for (let n = 0; n < 1000; n++) {
      const p = [0, 1, 2].map(() => (rng() * 3 - 1.5) * SECTOR);
      const { within9, nearest } = near(p);
      expect(within9, `${p}`).toBeGreaterThanOrEqual(3);
      expect(nearest, `${p}`).toBeLessThanOrEqual(6000);
    }
  });
  it('keeps every generated system, planet, moon and thing out of every keep-out', () => {
    expect(KEEP_OUTS.length).toBeGreaterThan(0);
    for (const s of sectors) {
      const outs = keepOutsNear(s.sx, s.sy, s.sz);
      for (const sys of s.systems.slice(s.legacy.systems)) {
        expect(clearOfKeepOuts(sys.at, sys.reach, outs), sys.id).toBe(true);
        for (const p of sys.planets) {
          expect(clearOfKeepOuts(orbitAt(p, 0), p.radius, outs), p.id).toBe(true);
        }
      }
      const t = s.things;
      for (let i = 0; i < t.count; i++) {
        const at = [0, 1, 2].map((a) => s.origin[a] + t.at[i * 3 + a]);
        expect(clearOfKeepOuts(at, (THING_NEAR + 1) * t.size[i], outs), `${s.id} slot ${t.slot[i]}`).toBe(true);
      }
    }
  });
});
