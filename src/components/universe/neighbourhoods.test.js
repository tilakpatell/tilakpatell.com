import { describe, expect, it } from 'vitest';
import { NEIGHBOURHOODS, NEIGHBOURHOOD_OF, memberAt, neighbourhoodById } from './neighbourhoods';
import { HOME_RADIUS, MAP_RADIUS, POSITIONS, REACH, RIM, SECTORS, UNIVERSE_RADIUS, mapSectorOf, sectorOf } from './layout';
import { PLACES, WONDERS, reachOf } from './deep';
import { UNIVERSES } from './universes';
import { SECTOR } from '../../lib/space/address';
import { UNIVERSE, fullSector } from '../expanse/shared/gen';
import { sectorAt } from '../../lib/space/address';
import { STARTS, startAt } from './ship';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const level = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const place = (id) => PLACES.find((p) => p.id === id);

describe('neighbourhoods', () => {
  it('has every fandom in one, and the stations in none', () => {
    for (const u of UNIVERSES) {
      if (u.kind === 'core') expect(NEIGHBOURHOOD_OF[u.id]).toBeUndefined();
      else expect(NEIGHBOURHOOD_OF[u.id], u.id).toBeTruthy();
    }
    expect(NEIGHBOURHOOD_OF.music).toBe('stage'); // (music has one of its own)
    expect(neighbourhoodById('stage').members).toEqual({ music: expect.any(Array) });
  });

  it('puts every fandom at its neighbourhood, out in the Expanse', () => {
    for (const u of UNIVERSES.filter((v) => v.kind !== 'core')) {
      expect(POSITIONS[u.id]).toEqual(memberAt(u.id));
      expect(sectorOf(...POSITIONS[u.id])).toMatch(/^E:/);
      expect(mapSectorOf(...POSITIONS[u.id])).toBe('main');
    }
  });

  it('moves each landmark wonder to its neighbourhood, and keeps the rest round the Core', () => {
    for (const w of WONDERS) {
      if (NEIGHBOURHOOD_OF[w.id]) expect(w.at).toEqual(memberAt(w.id));
      else if (!w.sector && w.kind !== 'portal') expect(Math.hypot(w.at[0], w.at[2]) + reachOf(w)).toBeLessThan(RIM.inner); // (inside the rim)
    }
    // the portal into the Curve stays beside Rick and Morty's world
    expect(dist(WONDERS.find((w) => w.id === 'rmportal').at, POSITIONS.rickmorty)).toBeLessThan(REACH.rickmorty * 3);
  });

  it('keeps the Core to the home system and its wonders: one sector, the main edge round it', () => {
    for (const u of UNIVERSES.filter((v) => v.kind === 'core')) expect(sectorOf(...POSITIONS[u.id])).toBe('main');
    expect(MAP_RADIUS).toBeLessThan(SECTORS.main.edge);
    expect(UNIVERSE_RADIUS).toBeGreaterThan(SECTOR);
  });

  it('spreads them: each a sector and more from the Core, the pocket and every other', () => {
    for (const n of NEIGHBOURHOODS) {
      const out = level(n.centre, [0, 0, 0]) / SECTOR;
      expect(out, n.id).toBeGreaterThanOrEqual(1);
      expect(out, n.id).toBeLessThanOrEqual(3.6);
      expect(dist(n.centre, SECTORS.rickmorty.origin)).toBeGreaterThan(SECTOR);
      for (const m of NEIGHBOURHOODS) if (m !== n) expect(level(n.centre, m.centre), `${n.id} ${m.id}`).toBeGreaterThan(SECTOR);
      // (on the middle layer, at a height of its own)
      expect(Math.abs(n.centre[1])).toBeLessThan(SECTOR / 2 - 20000);
    }
    expect(new Set(NEIGHBOURHOODS.map((n) => n.centre[1])).size).toBe(NEIGHBOURHOODS.length);
  });

  it('keeps every member clear of the others in it, and a nebula’s cloud clear of them all', () => {
    for (const n of NEIGHBOURHOODS) {
      const ids = [...Object.keys(n.members), ...Object.keys(n.landmarks)];
      for (const a of ids)
        for (const b of ids) {
          if (a >= b) continue;
          const pa = place(a);
          const pb = place(b);
          const cloud = (id) => WONDERS.find((w) => w.id === id)?.cloud ?? 0;
          expect(dist(pa.at, pb.at), `${a} ${b}`).toBeGreaterThan(Math.max(cloud(a), pa.reach) + Math.max(cloud(b), pb.reach) + 2000);
        }
    }
  });

  it('keeps every member clear of the old generated systems and wonders round it', () => {
    const made = new Map();
    const near = (sx, sz) => {
      const k = `${sx},${sz}`;
      if (!made.has(k)) {
        // (the middle layer's old sector, with its bodies: fullSector's first `legacy` systems and wonders, before what it appends)
        const s = fullSector(UNIVERSE, sx, 0, sz, { things: false });
        made.set(k, [...s.systems.slice(0, s.legacy.systems).map((y) => ({ at: y.at, r: y.reach })), ...s.wonders.slice(0, s.legacy.wonders).map((w) => ({ at: w.at, r: w.size }))]);
      }
      return made.get(k);
    };
    for (const id of Object.keys(NEIGHBOURHOOD_OF)) {
      const p = place(id);
      const sx = Math.round(p.at[0] / SECTOR);
      const sz = Math.round(p.at[2] / SECTOR);
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++)
          for (const o of near(sx + dx, sz + dz)) expect(level(p.at, o.at), id).toBeGreaterThan(o.r + 3 * p.reach + 2000);
    }
  });

  it('leaves every member clear in the Expanse as it is made whole, its systems old and new', () => {
    for (const id of Object.keys(NEIGHBOURHOOD_OF)) {
      const p = place(id);
      const sector = fullSector(UNIVERSE, ...sectorAt(...p.at), { things: false });
      for (const y of sector.systems) expect(dist(p.at, y.at), `${id} by ${y.id}`).toBeGreaterThan(y.reach + p.reach);
    }
  });
});

describe('a new pilot', () => {
  it('starts in the Core, round the home system’s edge, facing its middle', () => {
    expect(STARTS.map((s) => s.id)).toEqual(['sun']);
    for (let i = 0; i < 16; i++) {
      const at = startAt(() => (i + 0.5) / 16);
      expect(Math.hypot(at.x, at.z)).toBeCloseTo(HOME_RADIUS + 1.5, 0);
      expect(sectorOf(at.x, at.y, at.z)).toBe('main');
    }
  });
});
