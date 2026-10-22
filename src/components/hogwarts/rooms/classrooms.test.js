import { describe, expect, it } from 'vitest';
import library, { PAGES } from './library';
import potions, { CAULDRONS } from './potions';
import charms, { TIERS } from './charms';
import defence from './defence';
import owlery, { perches } from './owlery';
import { AT, scopes } from './astronomy';
import { heaps, surface } from './parts/needs';
import { placeBooks, placeJars } from './parts/shelves';
import { solidsOf } from './host';
import { TELESCOPES } from '../rules/stars';
import { CASTLE } from '../rules/shore';

const ROOMS = { library, potions, charms, defence, owlery };
const inside = (b, [x, z]) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
const blocked = (solids, [x, z], r = 0.35) => solids.some((c) => Math.hypot(x - c.at[0], z - c.at[1]) < c.r + r);

describe('the library, the dungeon, the classrooms and the Owlery', () => {
  it('each a room for the host, standing you inside its walls and clear of its furniture', () => {
    for (const [id, room] of Object.entries(ROOMS)) {
      expect(room.id).toBe(id);
      expect(room.name).toMatch(/^The /);
      const { spec } = room;
      const at = [spec.spawn.at[0], spec.spawn.at[2]];
      expect(inside(spec.bounds, at), id).toBe(true);
      expect(blocked(solidsOf(spec.colliders), at), id).toBe(false);
      for (const c of solidsOf(spec.colliders)) expect(Number.isFinite(c.r) && c.r > 0, id).toBe(true);
    }
  });

  it('leaves the Potions lesson its bare place at the front bench, and a cauldron at every other', () => {
    expect(CAULDRONS).toHaveLength(11);
    expect(CAULDRONS.some((c) => c.x === 2.6 && c.z === -4)).toBe(false);
  });

  it('raises the Charms desks in tiers from the front, each a step up', () => {
    for (let i = 1; i < TIERS.length; i++) {
      expect(TIERS[i][0]).toBe(TIERS[i - 1][1]);
      expect(TIERS[i][2] - TIERS[i - 1][2]).toBeCloseTo(0.36, 5);
    }
    const floor = charms.spec.floorAt;
    expect(floor(0, -5)).toBe(0);
    expect(floor(0, 8)).toBeCloseTo(1.44, 5);
  });

  it('raises the duelling platform with a step at each end', () => {
    const floor = defence.spec.floorAt;
    expect(floor(0, 0)).toBe(0.6);
    expect(floor(0, 6.8)).toBe(0.3);
    expect(floor(0, 8)).toBe(0);
    expect(floor(5, 0)).toBe(0);
  });

  it('has a page for every house in the library, in the site’s own words', () => {
    for (const h of ['gryffindor', 'slytherin', 'ravenclaw', 'hufflepuff', 'none']) {
      expect(PAGES[h].text).not.toMatch(/['"]/);
      expect(PAGES[h].title).toMatch(/^Hogwarts: A History/);
    }
  });

  it('fills a shelf end to end with books that fit it, and a shelf of jars with jars that don’t overlap', () => {
    const shelf = { at: [0, 1, 0], ry: 0, w: 2, h: 0.4 };
    const books = placeBooks([shelf], { seed: 3 });
    expect(books.length).toBeGreaterThan(20);
    for (const b of books) {
      expect(b.at[0]).toBeGreaterThan(-1.1);
      expect(b.at[0]).toBeLessThan(1.4);
      expect(b.s[1]).toBeLessThanOrEqual(0.4);
    }
    const jars = placeJars([shelf], { seed: 4 });
    for (let i = 1; i < jars.length; i++) expect(jars[i].at[0] - jars[i - 1].at[0]).toBeGreaterThanOrEqual(jars[i].r + jars[i - 1].r);
    expect(placeBooks([shelf], { seed: 3 })).toEqual(books);
  });

  it('puts an owl on every stretch of ledge but over the open windows, Hedwig’s perch apart', () => {
    const owls = perches('high');
    expect(owls.length).toBeGreaterThan(40);
    expect(perches('low').length).toBeLessThan(owls.length);
    for (const o of owls) expect(Math.hypot(o.at[0], o.at[2])).toBeLessThan(5.6);
  });

  it('heaps the hidden things into hills that rest on their own slopes', () => {
    const hills = [[0, 0, 6, 9]];
    const junk = heaps(hills, { seed: 2, each: 200 });
    expect(junk).toHaveLength(200);
    for (const j of junk) {
      const r = Math.hypot(j.at[0], j.at[2]);
      expect(r).toBeLessThanOrEqual(6 + 1e-9);
      expect(j.at[1]).toBeLessThanOrEqual(surface(9, r / 6) + 1e-9);
      expect(j.at[1]).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('the top of the Astronomy Tower', () => {
  it('stands on the far castle’s Astronomy Tower, high over the crag', () => {
    expect(AT[1]).toBeGreaterThan(100);
    expect(Math.hypot(AT[0] - CASTLE.at[0], AT[2] - CASTLE.at[1])).toBeLessThan(60);
  });

  it('stands every telescope between the tower and the parapet, on the side it looks out of', () => {
    expect(scopes).toHaveLength(TELESCOPES.length);
    for (const s of scopes) {
      const r = Math.hypot(s.at[0], s.at[2]);
      expect(r).toBeGreaterThan(8);
      expect(r).toBeLessThan(12.4);
    }
    // (the low ones, the ones a parapet could get in the way of, look out over their own side)
    for (const s of scopes.filter((x) => x.el < 40)) {
      const a = (s.az * Math.PI) / 180;
      const out = [Math.sin(a), -Math.cos(a)];
      const at = [s.at[0], s.at[2]];
      expect((out[0] * at[0] + out[1] * at[1]) / Math.hypot(...at), s.id).toBeGreaterThan(0.9);
    }
  });
});
