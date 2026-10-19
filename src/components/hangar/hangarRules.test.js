import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TABS, TAB_LABEL, readTab, tabForKey, wantsKey } from './hangarRules';
import { headOf } from './hangarHead';

describe('the rules the pages load before the Hangar', () => {
  it('import nothing, so the Hangar’s own chunk stays its own', () => {
    const src = readFileSync(new URL('./hangarRules.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/^import /m);
  });
});

const key = (k, mods = {}) => ({ key: k, metaKey: false, ctrlKey: false, altKey: false, ...mods });
const calm = { open: false, typing: false, otherDialog: false, door: true };

describe('the Hangar', () => {
  it('has the five tabs, the skills between the powers and the shipyard, each with its name', () => {
    expect(TABS).toEqual(['crew', 'arms', 'powers', 'skills', 'shipyard']);
    for (const t of TABS) expect(typeof TAB_LABEL[t]).toBe('string');
  });
  it('opens on the tab last used, or the shipyard', () => {
    expect(readTab('arms')).toBe('arms');
    expect(readTab('skills')).toBe('skills');
    expect(readTab('nope')).toBe('shipyard');
    expect(readTab(null)).toBe('shipyard');
  });
  it('opens on the last tab with H, and on the crew with C', () => {
    expect(tabForKey('h', 'powers')).toBe('powers');
    expect(tabForKey('H', 'powers')).toBe('powers');
    expect(tabForKey('c', 'powers')).toBe('crew');
    expect(tabForKey('q', 'powers')).toBe(null);
  });
  it('hears H and C only where the shipyard’s door would', () => {
    expect(wantsKey(key('h'), calm)).toBe(true);
    expect(wantsKey(key('c'), { ...calm, open: true })).toBe(true);
    expect(wantsKey(key('h'), { ...calm, typing: true })).toBe(false);
    expect(wantsKey(key('h'), { ...calm, otherDialog: true })).toBe(false);
    expect(wantsKey(key('h'), { ...calm, door: false })).toBe(false); // (on foot, or no 3D map: no corner button)
    expect(wantsKey(key('h'), { ...calm, door: false, open: true })).toBe(true); // (shut again from inside)
    expect(wantsKey(key('h', { ctrlKey: true }), calm)).toBe(false);
    expect(wantsKey(key('x'), calm)).toBe(false);
  });
  it('heads it with the level, the way to the next and the credits', () => {
    expect(headOf({ xp: 200, credits: 1234, level: 3, title: 'Pilot' })).toEqual({ level: 3, title: 'Pilot', xp: 200, toNext: (200 - 150) / (350 - 150), credits: 1234, legend: null, points: null });
    expect(headOf({ xp: 99999, credits: 0, level: 11, title: 'Legend' }).toNext).toBe(1);
    expect(headOf(null)).toEqual({ level: 1, title: 'Rookie', xp: 0, toNext: 0, credits: 0, legend: null, points: null });
  });
  it('heads it with the points free, and a Legend rank past the last level', () => {
    const head = headOf({ xp: 17500, credits: 0, level: 11, title: 'Legend' }, { earned: 22, spent: 19, free: 3, max: 70, legend: 2 });
    expect(head.legend).toBe(2);
    expect(head.points).toEqual({ free: 3, earned: 22, max: 70 });
    expect(headOf({ xp: 200, level: 3 }, { earned: 2, spent: 0, free: 2, max: 70, legend: 0 }).legend).toBe(null);
  });
});
