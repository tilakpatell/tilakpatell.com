import { describe, expect, it } from 'vitest';
import { LOOKS, RUNNERS, SHIPS, allowed, battleKindIn, lookOf, rosterOf, runnerOf } from './roster';
import { SIDES, WARS, WAR_IDS } from './sides';

describe('the roster', () => {
  it('keeps each war to its own ships', () => {
    expect(allowed('venator', 'clone', 'republic')).toBe(true);
    expect(allowed('venator', 'gcw', 'empire')).toBe(false);
    expect(allowed('interdictor', 'clone', 'separatists')).toBe(false);
    expect(allowed('gozanti', 'clone', 'separatists')).toBe(false);
    expect(allowed('transport', 'clone', 'republic')).toBe(false);
    expect(allowed('shuttle', 'clone', 'republic')).toBe(false);
    expect(allowed('tieadvanced', 'remnant', 'remnant')).toBe(false);
    expect(allowed('tiedefender', 'remnant', 'remnant')).toBe(false);
    expect(allowed('executor', 'remnant', 'remnant')).toBe(false);
    expect(allowed('vulture', 'gcw', 'separatists')).toBe(false);
    expect(allowed('ywing', 'clone', 'republic')).toBe(true);
    expect(allowed('corvette', 'clone', 'republic')).toBe(true);
    expect(allowed('razorcrest', 'remnant', null)).toBe(true);
    expect(allowed('razorcrest', 'gcw', null)).toBe(false);
    expect(allowed('nope', 'gcw', 'empire')).toBe(false);
  });
  it('lets the Hutts fly their own in every war', () => {
    for (const war of WAR_IDS) for (const k of ['gozanti', 'skiff', 'corvette']) expect(allowed(k, war, 'hutt'), `${war} ${k}`).toBe(true);
  });
  it('has fighters and a capital for every side of every war', () => {
    for (const w of Object.values(WARS))
      for (const side of [w.liberator, w.raider]) {
        expect(rosterOf(w.id, side, 'fighter').length, `${w.id} ${side}`).toBeGreaterThan(0);
        expect(rosterOf(w.id, side, 'capital').length, `${w.id} ${side}`).toBeGreaterThan(0);
      }
  });
  it('names runners each side may fly', () => {
    for (const w of Object.values(WARS))
      for (const side of [w.liberator, w.raider, 'hutt'])
        for (const kind of Object.keys(RUNNERS)) expect(allowed(runnerOf(kind, side), w.id, side), `${kind} ${w.id} ${side}`).toBe(true);
  });
  it('colours every side, the Republic red fighters and blue batteries', () => {
    for (const id of Object.keys(SIDES)) expect(LOOKS[id], id).toBeDefined();
    const r = lookOf('republic');
    expect(r.laser[0]).toBeGreaterThan(r.laser[2]);
    expect(r.turbo[2]).toBeGreaterThan(r.turbo[0]);
    expect(lookOf('empire').laser[1]).toBeGreaterThan(lookOf('empire').laser[0]);
  });
  it('gives every fighter class a gun list', () => {
    for (const [k, s] of Object.entries(SHIPS)) if (['fighter', 'interceptor', 'bomber'].includes(s.class)) expect(s.guns?.length, k).toBeGreaterThan(0);
  });
});

describe('a battle of its kind in each war', () => {
  it('fights an interdiction as a siege where the raider has no Interdictor', () => {
    expect(battleKindIn('interdiction', 'clone')).toBe('siege');
    expect(battleKindIn('interdiction', 'gcw')).toBe('interdiction');
    expect(battleKindIn('interdiction', 'remnant')).toBe('interdiction');
    expect(battleKindIn('blockade', 'clone')).toBe('blockade');
  });
});
