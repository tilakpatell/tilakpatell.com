import { describe, expect, it } from 'vitest';
import { CHAPTERS, stopOf } from './chapters';
import { ACHIEVEMENTS } from '../Achievements';
import { LEVELS, levelOf } from './rush/levels';
import { HIDDEN_SEALS, SIDE_SEALS, chapterRecord, hiddenHints, kitchenStars, offRoad, roadInked, roadRecord, roadRidden } from './record';
import { HIDDEN } from './hidden';

describe('the road so far', () => {
  it('knows every chapter’s side game, and each is a real achievement that is not one of the seals', () => {
    for (const c of CHAPTERS) {
      const side = SIDE_SEALS[c.id];
      expect(side, c.id).toBeTruthy();
      expect(ACHIEVEMENTS[side.seal], side.seal).toBeTruthy();
      expect(c.seals).not.toContain(side.seal);
    }
  });
  it('finds a kitchen for every chapter, and every kitchen a chapter', () => {
    for (const c of CHAPTERS) expect(levelOf(c.id), c.id).toBeTruthy();
    for (const l of Object.values(LEVELS)) expect(CHAPTERS.some((c) => c.id === l.town), l.id).toBe(true);
  });
  it('counts stars by the level’s own marks, played alone', () => {
    const pony = LEVELS.pony;
    expect(kitchenStars(pony, 0)).toBe(0);
    expect(kitchenStars(pony, pony.stars[0])).toBe(1);
    expect(kitchenStars(pony, pony.stars[2] + 10)).toBe(3);
    expect(kitchenStars(pony, NaN)).toBe(0);
    expect(kitchenStars(null, 100)).toBe(0);
  });
  it('tells a chapter’s seals, side and kitchen apart', () => {
    const bree = CHAPTERS.find((c) => c.id === 'bree');
    const r = chapterRecord(bree, { unlocked: ['breegate', 'pints', 'maninthemoon', 'mellon'], best: (id) => (id === 'pony' ? 135 : null) });
    expect(r.seals).toEqual({ won: 2, total: 5 });
    expect(r.won).toBe(false);
    expect(r.side.won).toBe(true);
    expect(r.kitchen.id).toBe('pony');
    expect(r.kitchen.best).toBe(135);
    expect(r.kitchen.stars).toBe(2);
    const all = chapterRecord(bree, { unlocked: bree.seals });
    expect(all.won).toBe(true);
    expect(all.kitchen.stars).toBe(0);
    expect(all.side.won).toBe(false);
  });
  it('adds the road up', () => {
    const empty = roadRecord();
    expect(empty.totals.seals.won).toBe(0);
    expect(empty.totals.seals.total).toBe(CHAPTERS.reduce((a, c) => a + c.seals.length, 0));
    expect(empty.totals.sides).toEqual({ won: 0, total: CHAPTERS.length });
    expect(empty.totals.stars).toEqual({ won: 0, total: CHAPTERS.length * 3 });
    const everything = roadRecord({ unlocked: Object.keys(ACHIEVEMENTS), best: () => 9999 });
    expect(everything.totals.seals.won).toBe(everything.totals.seals.total);
    expect(everything.totals.sides.won).toBe(CHAPTERS.length);
    expect(everything.totals.stars.won).toBe(CHAPTERS.length * 3);
    expect(everything.chapters.every((c) => c.won)).toBe(true);
  });
});

describe('the places off the road', () => {
  it('counts each hidden place, naming it only once found', () => {
    const none = offRoad([]);
    expect(none.length).toBe(HIDDEN.length);
    expect(none.every((h) => h.name === null && !h.found)).toBe(true);
    const some = offRoad(['edoras']);
    expect(some.find((h) => h.id === 'edoras')).toMatchObject({ found: true, name: 'Edoras', done: false });
    expect(some.find((h) => h.id === 'orthanc').name).toBe(null);
    expect(offRoad(['orthanc', 'windlord']).find((h) => h.id === 'orthanc').done).toBe(true);
  });
  it('knows a real achievement for finding and finishing each', () => {
    for (const h of HIDDEN) {
      expect(ACHIEVEMENTS[HIDDEN_SEALS[h.id].found], h.id).toBeTruthy();
      expect(ACHIEVEMENTS[HIDDEN_SEALS[h.id].end], h.id).toBeTruthy();
    }
  });
  it('totals them with the rest', () => {
    expect(roadRecord({ unlocked: ['orthanc'] }).totals.hidden).toEqual({ found: 1, total: HIDDEN.length });
  });
});

describe('how far the road is inked', () => {
  it('starts at Hobbiton with nothing won', () => {
    expect(roadInked([])).toBe(0);
    expect(roadInked()).toBe(0);
  });
  it('reaches the furthest chapter with a seal, whatever lies between', () => {
    expect(roadInked(['breegate'])).toBe(stopOf('bree'));
    expect(roadInked(['breegate', 'eagles'])).toBe(stopOf('mordor'));
  });
});

describe('when the hidden places hint', () => {
  const oneOfEach = CHAPTERS.map((c) => c.seals[0]);
  it('keeps quiet until every chapter has a seal', () => {
    expect(hiddenHints(['breegate'])).toEqual([]);
    expect(hiddenHints(oneOfEach.slice(1))).toEqual([]);
  });
  it('hints at every place not yet found, in order, once the road is walked', () => {
    expect(oneOfEach.some((s) => Object.values(HIDDEN_SEALS).some((h) => h.found === s))).toBe(false);
    expect(hiddenHints(oneOfEach)).toEqual(HIDDEN.map((h) => h.id));
  });
  it('stops hinting at a place once it’s found', () => {
    expect(hiddenHints([...oneOfEach, 'orthanc'])).toEqual(HIDDEN.map((h) => h.id).filter((id) => id !== 'orthanc'));
  });
});

describe('the Road in the journal', () => {
  it('reads the browser’s save, wrapped by the runtime or not, and the day it was first ridden', () => {
    expect(roadRidden(null)).toEqual({ ridden: false, on: null });
    expect(roadRidden({ v: 1, data: { s: 0.4, walked: 0.3, on: null } })).toEqual({ ridden: false, on: null });
    expect(roadRidden({ v: 1, data: { s: 1, ridden: true, walked: 0.9, on: 1760000000000 } })).toEqual({ ridden: true, on: 1760000000000 });
    // (two thirds walked is ridden; a save from before the day was kept has none)
    expect(roadRidden({ s: 1, walked: 0.7 })).toEqual({ ridden: true, on: null });
  });
  it('has the Road’s own achievement', () => {
    expect(ACHIEVEMENTS.lotrRoad?.name).toBe('The Road, ridden');
  });
});
