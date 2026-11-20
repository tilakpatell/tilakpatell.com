import { describe, expect, it } from 'vitest';
import { createEconomy } from '../economy';
import { CREWS } from '../crews';
import { LOADOUT_KEY, STOCK_LOADOUT, loadoutOf } from '../outfit';
import { diff, itemOfModule, itemOfPart, openDraft, setHull, setModule, setPart } from '../yardRules';
import { GARAGE_KEY, HULL_KEY, STOCK_BUILD, TUNE_KEY } from './build';
import { modulesFor } from './parts';
import { applyYardDraft, keepBuild, keepLoadouts, keepTune, readSaves, withBuild } from './yardPage';

// (the browser's storage: what `local` is, in a Map)
const store = (start = {}) => {
  const m = new Map(Object.entries(start).map(([k, v]) => [k, JSON.stringify(v)]));
  return { get: (k, fallback = null) => (m.has(k) ? JSON.parse(m.get(k)) : fallback), set: (k, v) => m.set(k, JSON.stringify(v)), keys: () => [...m.keys()] };
};
const wallet = (owned = []) => {
  const e = createEconomy({ achievements: () => [] });
  e.earn('found', 40);
  e.grant(owned);
  return e;
};
const SHIP = CREWS[0].id;
const live = { build: null, loadout: { ...STOCK_LOADOUT }, tune: {} };
const wing = modulesFor('wings')[1].id;

describe('the Shipyard page’s state', () => {
  it('reads nothing as nothing: no crew has a hull, a garage build or a part', () => {
    const s = readSaves(store());
    expect(s.hulls).toEqual({});
    expect(s.garage).toEqual({});
    expect(s.loadouts[SHIP]).toBeUndefined();
    expect(s.tune).toEqual({});
  });
  it('a build flown is the hull, and the last build to go back to; stock keeps the last', () => {
    const b = { ...STOCK_BUILD, wings: wing };
    const a = withBuild({ hulls: {}, garage: {} }, SHIP, b);
    expect(a.hulls[SHIP]).toEqual(b);
    expect(a.garage[SHIP]).toEqual(b);
    const stock = withBuild(a, SHIP, null);
    expect(stock.hulls[SHIP]).toBeNull();
    expect(stock.garage[SHIP]).toEqual(b);
  });
  it('a build and a loadout kept are what the other map reads when it opens', () => {
    const disk = store();
    const b = { ...STOCK_BUILD, wings: wing };
    keepBuild(disk, readSaves(disk), SHIP, b);
    keepLoadouts(disk, { [SHIP]: { ...STOCK_LOADOUT, booster: 'srb' } });
    expect(disk.keys().sort()).toEqual([GARAGE_KEY, HULL_KEY, LOADOUT_KEY].sort());
    const other = readSaves(disk); // (what the universe map's first render reads; the galaxy's are the same)
    expect(other.hulls[SHIP]).toEqual(b);
    expect(other.garage[SHIP]).toEqual(b);
    expect(loadoutOf(other.loadouts, SHIP, [], other.hulls[SHIP]).booster).toBe('srb');
    // (and back to stock: the hull goes, the garage keeps the build)
    keepBuild(disk, other, SHIP, null);
    expect(readSaves(disk).hulls[SHIP]).toBeNull();
    expect(readSaves(disk).garage[SHIP]).toEqual(b);
  });
});

describe('a tune kept', () => {
  it('is kept under its own key for the crew, and what the other map reads when it opens', () => {
    const disk = store();
    const next = keepTune(disk, readSaves(disk).tune, SHIP, { engines: 'quad', cockpit: 'canopy' });
    expect(next[SHIP]).toEqual({ cockpit: 'canopy', engines: 'quad' });
    expect(disk.keys()).toEqual([TUNE_KEY]);
    const other = readSaves(disk); // (what the universe map's first render reads; the galaxy's are the same)
    expect(other.tune[SHIP]).toEqual({ cockpit: 'canopy', engines: 'quad' });
    expect(other.hulls[SHIP]).toBeUndefined(); // (the hull's its own: the stock ship, tuned)
    // (the tune is on the loadout the ship flies: its power is spent)
    const heavy = { ...STOCK_LOADOUT, booster: 'portal', thrusters: 'rcs' }; // (4 MW: the RV's 5 runs it, until a quad draws 2)
    expect(loadoutOf({ rv: heavy }, 'rv', ['showmewhatyougot'], null, {}).booster).toBe('portal');
    expect(loadoutOf({ rv: heavy }, 'rv', ['showmewhatyougot'], null, { engines: 'quad' }).booster).toBe('stock');
  });
  it('clearing the last slot takes the crew out, and another crew’s is left', () => {
    const disk = store();
    let t = keepTune(disk, {}, 'rv', { engines: 'quad' });
    t = keepTune(disk, t, 'xwing', { tail: 'twinfin' });
    t = keepTune(disk, t, 'rv', {});
    expect(t).toEqual({ xwing: { tail: 'twinfin' } });
    expect(readSaves(disk).tune).toEqual({ xwing: { tail: 'twinfin' } });
  });
  it('drops a junk tune: unknown slots and modules, and the hull', () => {
    const disk = store({ [TUNE_KEY]: { [SHIP]: { hull: 'needle', engines: 'nonsense', wings: 'delta' }, zzz: { wings: 'delta' } } });
    expect(readSaves(disk).tune).toEqual({ [SHIP]: { wings: 'delta' } });
    expect(readSaves(store({ [TUNE_KEY]: 'x' })).tune).toEqual({});
  });
});

describe('applying a draft', () => {
  const request = (draft) => ({ diff: diff(draft, live), toBuy: [], draft });
  it('says the shop is still opening with no wallet, and a refusal changes nothing', () => {
    const r = applyYardDraft({ ship: SHIP, economy: null, loadouts: {}, unlocked: [] }, request(openDraft(live)));
    expect(r.result).toMatchObject({ ok: false, why: 'shop' });
    expect(r.loadouts).toBeUndefined();
    expect(applyYardDraft({ ship: null, economy: wallet(), loadouts: {}, unlocked: [] }, request(openDraft(live))).result.ok).toBe(false);
  });
  it('fits a part owned: the loadout to keep, the hull untouched, a note that says so', () => {
    const e = wallet([itemOfPart('booster', 'srb')]);
    const draft = setPart(openDraft(live), 'booster', 'srb');
    const r = applyYardDraft({ ship: SHIP, economy: e, loadouts: {}, unlocked: [] }, request(draft));
    expect(r.result).toMatchObject({ ok: true, text: 'Fitted.' });
    expect(r.result.live.loadout.booster).toBe('srb');
    expect(r.loadouts[SHIP].booster).toBe('srb');
    expect('build' in r).toBe(false);
  });
  it('buys an achievement’s part at its level and fits it, all in one Apply', () => {
    const e = createEconomy({ achievements: () => [] });
    e.earn('warWin', 6); // (1,500 credits and level 4: the afterburner's)
    const item = itemOfPart('booster', 'afterburner');
    const draft = setPart(openDraft(live), 'booster', 'afterburner');
    const r = applyYardDraft({ ship: SHIP, economy: e, loadouts: {}, unlocked: [] }, { diff: diff(draft, live), toBuy: [item], draft });
    expect(r.result.ok).toBe(true);
    expect(e.owns(item.key)).toBe(true);
    expect(r.result.live.loadout.booster).toBe('afterburner');
    expect(loadoutOf(r.loadouts, SHIP, [], null, null, null, (k) => e.owns(k)).booster).toBe('afterburner');
  });
  it('a module on a garage build changes the hull: the build to fly comes with it', () => {
    const e = wallet([itemOfModule('wings', wing)]);
    const draft = setModule(setHull(openDraft(live), true, null), 'wings', wing);
    const r = applyYardDraft({ ship: SHIP, economy: e, loadouts: {}, unlocked: [] }, request(draft));
    expect(r.result.ok).toBe(true);
    expect(r.build).toEqual(draft.build);
    expect(r.build.wings).toBe(wing);
  });
  it('a module on the stock hull is a tune: kept for the crew, the hull untouched', () => {
    const e = wallet({ owned: [itemOfModule('wings', wing)] });
    const draft = setModule(openDraft(live), 'wings', wing);
    const r = applyYardDraft({ ship: SHIP, economy: e, loadouts: {}, unlocked: [] }, request(draft));
    expect(r.result.ok).toBe(true);
    expect(r.tune).toEqual({ wings: wing });
    expect('build' in r).toBe(false);
    expect(r.result.live).toMatchObject({ build: null, tune: { wings: wing } });
  });
  it('buys an unowned module of a tune at checkout, like a part', () => {
    const e = wallet();
    const quad = itemOfModule('engines', 'quad');
    const draft = setModule(openDraft(live), 'engines', 'quad');
    const before = e.credits;
    const r = applyYardDraft({ ship: SHIP, economy: e, loadouts: {}, unlocked: [] }, { diff: diff(draft, live), toBuy: [quad], draft });
    expect(r.result.ok).toBe(true);
    expect(r.result.text).toMatch(/^Bought 1 part for /);
    expect(e.owns(quad.key)).toBe(true);
    expect(e.credits).toBe(before - quad.price);
  });
  it('a tune the plant can’t run with the parts fitted is refused whole', () => {
    const e = wallet({ owned: ['part:booster:portal', 'part:thrusters:rcs', itemOfModule('engines', 'quad').key] });
    const draft = setModule(setPart(setPart(openDraft(live), 'booster', 'portal'), 'thrusters', 'rcs'), 'engines', 'quad');
    const r = applyYardDraft({ ship: 'rv', economy: e, loadouts: {}, unlocked: ['showmewhatyougot'] }, request(draft));
    expect(r.result).toMatchObject({ ok: false, why: 'power' });
    expect(r.tune).toBeUndefined();
  });
  it('a switch of hull keeps the tune saved and flies it on again from stock', () => {
    const tuned = { build: null, loadout: { ...STOCK_LOADOUT }, tune: { engines: 'quad' } };
    const e = wallet({ owned: [itemOfModule('engines', 'quad').key] });
    const toGarage = setHull(openDraft(tuned), true, null);
    const g = applyYardDraft({ ship: SHIP, economy: e, loadouts: {}, tunes: { [SHIP]: { engines: 'quad' } }, unlocked: [] }, { diff: diff(toGarage, tuned), toBuy: [], draft: toGarage });
    expect(g.result.ok).toBe(true);
    expect(g.build).toEqual(toGarage.build);
    expect(g.tune).toBeUndefined(); // (not touched: it's saved as it was)
    expect(g.result.live.tune).toEqual({ engines: 'quad' });
    const flying = { build: toGarage.build, loadout: { ...STOCK_LOADOUT }, tune: { engines: 'quad' } };
    const back = applyYardDraft({ ship: SHIP, economy: e, loadouts: {}, tunes: { [SHIP]: { engines: 'quad' } }, unlocked: [] }, { diff: diff(setHull(openDraft(flying), false), flying), toBuy: [], draft: setHull(openDraft(flying), false) });
    expect(back.build).toBeNull();
    expect(back.result.live).toMatchObject({ build: null, tune: { engines: 'quad' } });
  });
  it('a part that isn’t paid for is refused, and nothing is kept', () => {
    const e = wallet();
    const srb = itemOfPart('booster', 'srb');
    const draft = setPart(openDraft(live), 'booster', 'srb');
    const credits = e.credits;
    const r = applyYardDraft({ ship: SHIP, economy: e, loadouts: {}, unlocked: [] }, { diff: diff(draft, live), toBuy: [{ ...srb, price: credits + 500 }], draft });
    expect(r.result.ok).toBe(false);
    expect(r.loadouts).toBeUndefined();
    expect(e.credits).toBe(credits);
  });
});
