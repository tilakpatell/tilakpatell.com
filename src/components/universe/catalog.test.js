import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../Achievements';
import { SIDES as WAR_SIDES } from '../galaxy/sides';
import { RANKS } from '../galaxy/ranks';
import { SIDES } from './sides';
import { AXES, LEVELS } from './standing';
import { PARTS, STOCK } from './outfit';
import { PAINTS } from './paint';
import { BUILD_SLOTS, modulesFor } from './shipyard/parts';
import { STOCK_BUILD } from './shipyard/build';
import { BANDS, CATALOG, SKILL_NODES, itemFor, keyOf, needText, priceOf } from './catalog';

const ITEMS = Object.values(CATALOG);
const MODULES = BUILD_SLOTS.flatMap((slot) => modulesFor(slot));

describe('the catalogue', () => {
  it('every part, module and paint has an entry', () => {
    for (const p of PARTS) expect(itemFor('part', p.slot, p.id), `${p.slot} ${p.id}`).toMatchObject({ id: p.id, kind: 'part', slot: p.slot });
    for (const m of MODULES) expect(itemFor('module', m.slot, m.id), `${m.slot} ${m.id}`).toMatchObject({ id: m.id, kind: 'module', slot: m.slot });
    for (const p of PAINTS) expect(itemFor('paint', 'paint', p.id), p.id).toMatchObject({ id: p.id, kind: 'paint', slot: 'paint' });
    expect(ITEMS).toHaveLength(PARTS.length + MODULES.length + PAINTS.length);
    for (const item of ITEMS) expect(CATALOG[item.key]).toBe(item);
    expect(itemFor('part', 'booster', 'nonsense')).toBeNull();
    expect(itemFor('paint', 'paint', '__proto__')).toBeNull();
  });

  it('keeps an id that two slots share apart, by its key', () => {
    // (the Portal panic booster and the Portal paint are both 'portal')
    expect(keyOf('part', 'booster', 'portal')).not.toBe(keyOf('paint', 'paint', 'portal'));
    expect(itemFor('part', 'booster', 'portal').kind).toBe('part');
    expect(itemFor('paint', 'paint', 'portal').kind).toBe('paint');
  });

  it('stock is free and needs nothing', () => {
    for (const slot of BUILD_SLOTS) expect(itemFor('module', slot, STOCK_BUILD[slot]), slot).toMatchObject({ price: 0, needs: {}, stock: true });
    for (const p of [...PARTS, ...PAINTS].filter((q) => q.id === STOCK)) expect(itemFor(p.slot ? 'part' : 'paint', p.slot ?? 'paint', STOCK)).toMatchObject({ price: 0, needs: {}, stock: true });
    expect(itemFor('module', 'tail', 'none')).toMatchObject({ price: 0, stock: true }); // (taking a part off costs nothing)
    expect(itemFor('part', 'booster', 'srb').stock).toBe(false);
  });

  it('an achievement lock in outfit.js becomes a need', () => {
    for (const p of PARTS.filter((q) => q.achievement)) expect(itemFor('part', p.slot, p.id).needs.achievement, p.id).toBe(p.achievement);
    for (const m of MODULES.filter((q) => q.achievement)) expect(itemFor('module', m.slot, m.id).needs.achievement, m.id).toBe(m.achievement);
    for (const p of PAINTS.filter((q) => q.achievement)) expect(itemFor('paint', 'paint', p.id).needs.achievement, p.id).toBe(p.achievement);
    expect(itemFor('part', 'booster', 'portal').needs).toEqual({ achievement: 'showmewhatyougot' });
    expect(itemFor('part', 'booster', 'srb').needs).toEqual({});
  });

  it('every need names an id that exists', () => {
    for (const { key, needs, from } of ITEMS) {
      if (needs.achievement) expect(ACHIEVEMENTS[needs.achievement], key).toBeTruthy();
      if (needs.level) expect(Number.isInteger(needs.level) && needs.level >= 2 && needs.level <= 11, key).toBe(true);
      if (needs.standing) {
        expect(SIDES[needs.standing.side], key).toBeTruthy();
        expect(AXES, key).toContain(needs.standing.axis);
        expect(LEVELS[needs.standing.axis].map(([, name]) => name), key).toContain(needs.standing.level);
      }
      if (needs.rank) {
        expect(WAR_SIDES[needs.rank.side], key).toBeTruthy();
        expect(RANKS[needs.rank.side].map((r) => r.id), key).toContain(needs.rank.id);
      }
      if (needs.skill) expect(SKILL_NODES[needs.skill], key).toBeTruthy();
      expect([null, 'starwars', 'rickmorty', 'breakingbad', 'galaxy', 'universe'], key).toContain(from);
    }
  });

  it('sells the skill tree’s four only once their nodes are taken, and says so', () => {
    expect(itemFor('part', 'ordnance', 'seismic')).toMatchObject({ price: 1500, from: 'starwars', needs: { skill: 'u-seismic' } });
    expect(itemFor('part', 'secondary', 'darkmatter')).toMatchObject({ price: 1250, from: 'rickmorty', needs: { skill: 'u-darkmatter' } });
    expect(itemFor('part', 'ordnance', 'crystal')).toMatchObject({ price: 1250, from: 'breakingbad', needs: { skill: 'u-crystal' } });
    expect(itemFor('part', 'secondary', 'energon')).toMatchObject({ price: 1500, from: 'universe', needs: { skill: 'u-energon' } });
    expect(needText({ skill: 'u-seismic' })).toBe('Take “Seismic charge” in the skill tree');
    expect(needText({ level: 3, skill: 'u-energon' })).toBe('Reach level 3 and take “Energon arc” in the skill tree');
  });

  it('gives each universe something of its own to earn there', () => {
    expect(itemFor('paint', 'paint', 'rebel')).toMatchObject({ from: 'galaxy', needs: { rank: { side: 'rebel', id: 'flight-cadet' } } });
    expect(itemFor('paint', 'paint', 'imperial')).toMatchObject({ from: 'galaxy', needs: { rank: { side: 'empire', id: 'ensign' } } });
    expect(itemFor('paint', 'paint', 'redsquadron').needs).toEqual({ rank: { side: 'rebel', id: 'flight-leader' } });
    expect(itemFor('paint', 'paint', 'citadel')).toMatchObject({ from: 'rickmorty', needs: { standing: { side: 'rickmorty', axis: 'law', level: 'trusted' } } });
    expect(itemFor('paint', 'paint', 'pollos')).toMatchObject({ from: 'breakingbad', needs: { standing: { side: 'breakingbad', axis: 'civil', level: 'hero' } } });
    expect(itemFor('paint', 'paint', 'huttgold')).toMatchObject({ from: 'galaxy', needs: { level: 8 } });
    expect(itemFor('part', 'guns', 'incom')).toMatchObject({ from: 'starwars', needs: { achievement: 'rebels' } });
    expect(itemFor('part', 'fins', 'council')).toMatchObject({ from: 'rickmorty', needs: { level: 5 } });
    expect(itemFor('part', 'thrusters', 'vamonos')).toMatchObject({ from: 'breakingbad', needs: { level: 3 } });
  });

  it('prices are in band', () => {
    for (const item of ITEMS) {
      expect(Number.isInteger(item.price), item.key).toBe(true);
      if (item.stock) expect(item.price, item.key).toBe(0);
      else {
        expect(item.price, item.key).toBeGreaterThanOrEqual(100);
        expect(item.price, item.key).toBeLessThanOrEqual(1500);
      }
    }
    // a share of 0.25 is about 400; paints are 150; the bands rise with what an item does
    expect(itemFor('part', 'booster', 'srb').price).toBeGreaterThan(itemFor('part', 'thrusters', 'rcs').price);
    expect(itemFor('part', 'guns', 'twin').price).toBe(400);
    expect(itemFor('paint', 'paint', 'aws').price).toBe(150);
    expect(itemFor('module', 'hull', 'hauler').price).toBeGreaterThan(itemFor('module', 'hull', 'needle').price); // (its plant runs anything)
    for (let i = 1; i < BANDS.length; i++) {
      expect(BANDS[i].upTo).toBeGreaterThan(BANDS[i - 1].upTo);
      expect(BANDS[i].price).toBeGreaterThan(BANDS[i - 1].price);
    }
  });

  it('prices by key, or by an id only one slot has', () => {
    expect(priceOf('srb')).toBe(itemFor('part', 'booster', 'srb').price);
    expect(priceOf(keyOf('paint', 'paint', 'portal'))).toBe(150);
    expect(priceOf('portal')).toBeNull(); // (a booster and a paint: which?)
    expect(priceOf('nonsense')).toBeNull();
  });
});

describe('what the hangar says a lock needs', () => {
  it('needText reads as a sentence', () => {
    expect(needText({ level: 5 })).toBe('Reach level 5');
    expect(needText({ standing: { side: 'rickmorty', axis: 'law', level: 'trusted' } })).toBe('Be trusted by the Federation');
    expect(needText({ standing: { side: 'breakingbad', axis: 'civil', level: 'hero' } })).toBe('Be a hero to the people of Albuquerque');
    expect(needText({ rank: { side: 'rebel', id: 'flight-leader' } })).toBe('Fly as a Flight Leader for the Rebellion');
    expect(needText({ rank: { side: 'empire', id: 'admiral' } })).toBe('Fly as an Admiral for the Empire');
    expect(needText({ rank: { side: 'rebel', id: 'flight-cadet' } })).toBe('Swear to the Rebellion in the galaxy');
    expect(needText({ achievement: 'rebels' })).toBe('Earn “Medal of Yavin”');
    expect(needText({ level: 3, standing: { side: 'starwars', axis: 'law', level: 'trusted' } })).toBe('Reach level 3 and be trusted by the Empire');
    expect(needText({})).toBe('');
    expect(needText(undefined)).toBe('');
  });

  it('has a sentence for every lock in the catalogue, naming no id', () => {
    for (const { key, needs } of ITEMS) {
      if (!Object.keys(needs).length) continue;
      const s = needText(needs);
      expect(s, key).toMatch(/^[A-Z]/);
      expect(s, key).not.toMatch(/undefined|null|[a-z]+-[a-z]+|'/);
    }
  });
});

describe('the weapon lines', () => {
  it('the new weapons are priced between 400 and 1000', () => {
    for (const [slot, id] of [
      ['secondary', 'ion'],
      ['secondary', 'flak'],
      ['ordnance', 'missiles'],
      ['ordnance', 'mk2'],
    ]) {
      const item = itemFor('part', slot, id);
      expect(item.stock, id).toBe(false);
      expect(item.price, id).toBeGreaterThanOrEqual(400);
      expect(item.price, id).toBeLessThanOrEqual(1000);
    }
  });

  it('stock weapons are free and owned', () => {
    for (const slot of ['secondary', 'ordnance']) {
      expect(itemFor('part', slot, 'stock').stock).toBe(true);
      expect(itemFor('part', slot, 'stock').price).toBe(0);
    }
  });

  it('flak needs level 4 and missiles level 3, and the earned ones their achievement', () => {
    expect(itemFor('part', 'secondary', 'flak').needs).toEqual({ level: 4 });
    expect(itemFor('part', 'ordnance', 'missiles').needs).toEqual({ level: 3 });
    expect(itemFor('part', 'secondary', 'ion').needs).toEqual({ achievement: 'rebels' });
    expect(itemFor('part', 'ordnance', 'mk2').needs).toEqual({ achievement: 'trench' });
  });
});
