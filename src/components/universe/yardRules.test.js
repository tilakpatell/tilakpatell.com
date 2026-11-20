import { describe, expect, it } from 'vitest';
import { createEconomy, refundOf } from './economy';
import { itemFor } from './catalog';
import { STOCK, STOCK_LOADOUT, partById } from './outfit';
import { STOCK_BUILD, buildCode, statsOfBuild } from './shipyard/build';
import { modulesFor } from './shipyard/parts';
import { check, diff, draftKeys, fitDraft, hullLine, hullName, itemOfModule, itemOfPart, lockHint, lockOf, openDraft, pasteDraft, rollDraft, setHull, setModule, setPart, sellable } from './yardRules';

const wallet = ({ credits = 0, owned = [], unlocked = [] } = {}) => {
  const e = createEconomy({ achievements: () => unlocked });
  if (credits) e.earn('found', Math.ceil(credits / 30)); // (30 a find; xp too, a level or so)
  e.grant(owned);
  return e;
};
const live = { build: null, loadout: { ...STOCK_LOADOUT }, tune: {} };
const srb = itemOfPart('booster', 'srb');
const rcs = itemOfPart('thrusters', 'rcs');

describe('the draft', () => {
  it('a draft from live is equal and not the same object', () => {
    const l = { build: { ...STOCK_BUILD }, loadout: { ...STOCK_LOADOUT, booster: 'srb' }, tune: { engines: 'quad' } };
    const d = openDraft(l);
    expect(d).toEqual(l);
    expect(d).not.toBe(l);
    expect(d.loadout).not.toBe(l.loadout);
    expect(d.build).not.toBe(l.build);
    expect(d.tune).not.toBe(l.tune);
    expect(openDraft(live).build).toBeNull();
    expect(openDraft({ build: null, loadout: {} }).tune).toEqual({}); // (a live from before tunes: none)
  });

  it('setPart and setModule return new drafts and leave the old', () => {
    const d = openDraft(live);
    const a = setPart(d, 'booster', 'srb');
    expect(a.loadout.booster).toBe('srb');
    expect(d.loadout.booster).toBe(STOCK);
    expect(setPart(d, 'booster', 'nonsense')).toBe(d); // (an unknown part changes nothing)
    const wing = modulesFor('wings')[1].id;
    const b = setModule(d, 'wings', wing);
    expect(b.tune).toEqual({ wings: wing }); // (on the crew's own ship: a tune)
    expect(d.tune).toEqual({});
    expect(setModule(d, 'wings', 'nonsense')).toBe(d);
    expect(setModule(d, 'nonsense', wing)).toBe(d);
  });

  it('a module on the stock hull is tuning: the ship stays, and the tune holds the module', () => {
    const d = openDraft(live);
    const t = setModule(setModule(d, 'engines', 'quad'), 'cockpit', 'canopy');
    expect(t.build).toBeNull();
    expect(t.tune).toEqual({ cockpit: 'canopy', engines: 'quad' }); // (in the rail's order, whatever the order staged)
    expect(setModule(t, 'engines', 'ring').tune).toEqual({ cockpit: 'canopy', engines: 'ring' });
    expect(t.tune).toEqual({ cockpit: 'canopy', engines: 'quad' }); // (the old draft is left)
  });

  it('the slot’s stock module, or a None, clears that slot’s tune', () => {
    const t = setModule(setModule(setModule(openDraft(live), 'engines', 'quad'), 'tail', 'twinfin'), 'extras', 'antenna');
    expect(setModule(t, 'engines', STOCK_BUILD.engines).tune).toEqual({ tail: 'twinfin', extras: 'antenna' });
    expect(setModule(t, 'tail', 'none').tune).toEqual({ engines: 'quad', extras: 'antenna' });
    expect(setModule(t, 'extras', 'none').tune).toEqual({ engines: 'quad', tail: 'twinfin' });
    expect(setModule(openDraft(live), 'wings', STOCK_BUILD.wings).tune).toEqual({});
  });

  it('on a garage build a module edits the build, and the tune is left alone', () => {
    const t = setModule(openDraft(live), 'engines', 'quad');
    const g = setHull(t, true, null);
    expect(g.tune).toEqual({ engines: 'quad' }); // (kept for when you switch back)
    const edited = setModule(g, 'wings', 'delta');
    expect(edited.build).toEqual({ ...STOCK_BUILD, wings: 'delta' });
    expect(edited.tune).toEqual({ engines: 'quad' });
    expect(setHull(edited, false).tune).toEqual({ engines: 'quad' });
    expect(setHull(edited, false).build).toBeNull();
  });

  it('a hull module isn’t a tune: on the stock ship it opens a garage build as before', () => {
    const d = setModule(openDraft(live), 'hull', 'needle');
    expect(d.build).toEqual({ ...STOCK_BUILD, hull: 'needle' });
    expect(d.tune).toEqual({});
  });

  it('setHull on opens the last build or stock, and off flies the stock ship', () => {
    const d = openDraft(live);
    const last = { ...STOCK_BUILD, wings: modulesFor('wings')[1].id, seed: 9 };
    expect(setHull(d, true, last).build).toEqual(last);
    expect(setHull(d, true, last).build).not.toBe(last);
    expect(setHull(d, true, null).build).toEqual({ ...STOCK_BUILD });
    expect(setHull(setHull(d, true, last), false).build).toBeNull();
  });

  it('a roll is the same build for the same seed, and only from what’s owned', () => {
    const d = openDraft(live);
    expect(rollDraft(d, 7, [], []).build).toEqual(rollDraft(d, 7, [], []).build);
    expect(rollDraft(d, 7, [], []).loadout).toEqual(d.loadout);
  });

  it('pasteDraft refuses a bad code and a code with an unowned module', () => {
    const d = openDraft(live);
    expect(pasteDraft(d, 'hello', {})).toEqual({ error: 'Not a build code. They look like GB-021301.k3.' });
    expect(pasteDraft(d, buildCode(STOCK_BUILD), { economy: wallet() }).draft.build).toEqual({ ...STOCK_BUILD });
    const bought = modulesFor('wings').find((m) => !m.achievement && m.id !== STOCK_BUILD.wings && m.id !== 'none');
    const code = buildCode({ ...STOCK_BUILD, wings: bought.id });
    expect(pasteDraft(d, code, { economy: wallet() }).error).toMatch(/haven’t bought/);
    expect(pasteDraft(d, code, { economy: wallet({ owned: [itemOfModule('wings', bought.id).key] }) }).draft.build.wings).toBe(bought.id);
    const shut = modulesFor('wings').find((m) => m.achievement);
    if (shut) expect(pasteDraft(d, buildCode({ ...STOCK_BUILD, wings: shut.id }), { economy: wallet() }).error).toMatch(/isn’t yours yet/);
  });
});

describe('check on a tuned ship', () => {
  const ring = itemOfModule('engines', 'ring');
  const quad = itemOfModule('engines', 'quad');
  it('lists an unowned tune module to buy, like a part, and owned ones cost nothing', () => {
    const d = setModule(openDraft(live), 'engines', 'quad');
    const r = check(d, { kind: 'xwing', unlocked: [], economy: wallet({ credits: 5000 }) });
    expect(r.toBuy.map((i) => i.key)).toEqual([quad.key]);
    expect(r.total).toBe(quad.price);
    expect(r.ok).toBe(true);
    const owned = check(d, { kind: 'xwing', unlocked: [], economy: wallet({ owned: [quad.key] }) });
    expect(owned.toBuy).toEqual([]);
    expect(owned.ok).toBe(true);
  });

  it('counts what the tune draws and weighs, against the crew’s own plant', () => {
    const r = check(setModule(openDraft(live), 'engines', 'quad'), { kind: 'xwing', unlocked: [], economy: wallet({ owned: [quad.key] }) });
    expect(r.power).toBe(2);
    expect(r.capacity).toBe(7);
    expect(r.mass).toBe(2);
  });

  it('a module whose achievement isn’t earned is locked, whatever the wallet says', () => {
    const d = setModule(openDraft(live), 'engines', 'ring');
    const r = check(d, { kind: 'xwing', unlocked: [], economy: wallet({ credits: 99999, owned: [ring.key] }) });
    expect(r.issues).toEqual([{ slot: 'engines', id: 'ring', why: 'locked', text: 'Locked. Beat the Cromulon in Portal panic.' }]);
    expect(check(d, { kind: 'xwing', unlocked: ['showmewhatyougot'], economy: wallet({ owned: [ring.key] }) }).ok).toBe(true);
  });

  it('refuses a tune for power, as a part is refused', () => {
    // the RV's 5 MW: portal (3) and vector (2) fill it, and a quad (2) is the 2 MW over
    const d = setModule(setPart(setPart(openDraft(live), 'booster', 'portal'), 'thrusters', 'vector'), 'engines', 'quad');
    const r = check(d, { kind: 'rv', unlocked: ['showmewhatyougot', 'grounded'], economy: wallet({ owned: ['part:booster:portal', 'part:thrusters:vector', quad.key] }) });
    expect(r.issues).toEqual([{ slot: null, id: null, why: 'power', text: 'Not enough power: 2 MW short.' }]);
    expect(check(setModule(d, 'engines', 'twincans'), { kind: 'rv', unlocked: ['showmewhatyougot', 'grounded'], economy: wallet({ owned: ['part:booster:portal', 'part:thrusters:vector'] }) }).ok).toBe(true);
  });

  it('a tune isn’t flown on a garage build: not bought, not counted', () => {
    const d = setHull(setModule(openDraft(live), 'engines', 'quad'), true, null);
    const r = check(d, { kind: 'xwing', unlocked: [], economy: wallet() });
    expect(r.toBuy).toEqual([]);
    expect(r.power).toBe(statsOfBuild(STOCK_BUILD).power);
    expect(r.capacity).toBe(statsOfBuild(STOCK_BUILD).plant);
  });
});

describe('check', () => {
  it('is ok on a draft of owned, open, fitting parts', () => {
    const d = setPart(openDraft(live), 'booster', 'srb');
    const r = check(d, { kind: 'falcon', unlocked: [], economy: wallet({ owned: [srb.key] }) });
    expect(r.ok).toBe(true);
    expect(r.issues).toEqual([]);
    expect(r.toBuy).toEqual([]);
    expect(r.total).toBe(0);
    expect(r.short).toBe(0);
    expect(r.power).toBe(partById('booster', 'srb').power);
    expect(r.capacity).toBe(9);
    expect(r.mass).toBeGreaterThan(0);
  });

  it('lists what’s to buy, its total, and what’s short', () => {
    const d = setPart(setPart(openDraft(live), 'booster', 'srb'), 'thrusters', 'rcs');
    const e = wallet({ credits: 100 });
    const r = check(d, { kind: 'falcon', unlocked: [], economy: e });
    expect(r.toBuy.map((i) => i.key)).toEqual([srb.key, rcs.key]);
    expect(r.total).toBe(srb.price + rcs.price);
    expect(r.short).toBe(srb.price + rcs.price - e.credits);
    expect(r.ok).toBe(false);
    expect(r.issues).toEqual([{ slot: null, id: null, why: 'short', text: `Short ${r.short} ¢.` }]);
  });

  it('lists a locked part and a part the plant can’t run', () => {
    // (the trench run's: sold at level 4 since the parts lane, so a rookie's wallet is locked out of it, and one that owns it isn't)
    let d = setPart(openDraft(live), 'booster', 'afterburner');
    const rookie = createEconomy();
    rookie.credit(100000, 'test'); // (credits, no xp: level 1)
    let r = check(d, { kind: 'falcon', unlocked: [], economy: rookie });
    expect(r.issues.map((i) => i.why)).toEqual(['locked']);
    expect(r.issues[0].text).toBe('Locked. Reach level 4, or hit the exhaust port in the trench run for it free.');
    r = check(d, { kind: 'falcon', unlocked: [], economy: wallet({ credits: 100000, owned: ['part:booster:afterburner'] }) });
    expect(r.issues).toEqual([]);
    // the RV's 5 MW against portal (3), vector (2) and fastcharge (2)
    d = setPart(setPart(setPart(openDraft(live), 'booster', 'portal'), 'thrusters', 'vector'), 'shields', 'fastcharge');
    r = check(d, { kind: 'rv', unlocked: ['showmewhatyougot', 'grounded', 'captain'], economy: wallet({ owned: ['part:booster:portal', 'part:thrusters:vector', 'part:shields:fastcharge'] }) });
    expect(r.issues).toEqual([{ slot: null, id: null, why: 'power', text: 'Not enough power: 2 MW short.' }]);
  });

  it('a lock past an achievement (a level) is an issue whatever the wallet says', () => {
    const d = setPart(openDraft(live), 'thrusters', 'vamonos'); // (level 3)
    const r = check(d, { kind: 'falcon', unlocked: [], economy: wallet() });
    expect(r.issues[0]).toMatchObject({ slot: 'thrusters', id: 'vamonos', why: 'locked' });
    expect(r.issues[0].text).toMatch(/^Locked\. Reach level 3\.$/);
  });

  it('says a lock as a bare sentence for the shipyard’s card, and in full for the bill', () => {
    const p = partById('booster', 'afterburner');
    const item = itemOfPart('booster', 'afterburner');
    expect(lockHint(p, item)).toBe('Reach level 4, or hit the exhaust port in the trench run for it free');
    expect(lockOf(p, item)).toBe(`Locked. ${lockHint(p, item)}.`);
    expect(lockHint(partById('thrusters', 'vamonos'), itemOfPart('thrusters', 'vamonos'))).toBe('Reach level 3');
  });

  it('says the shop’s still opening with no wallet', () => {
    const r = check(setPart(openDraft(live), 'booster', 'srb'), { kind: 'falcon', unlocked: [], economy: null });
    expect(r.ok).toBe(false);
    expect(r.issues).toEqual([{ slot: null, id: null, why: 'unowned', text: 'The shop’s still opening.' }]);
  });
});

describe('diff', () => {
  it('puts the build first and leaves out what hasn’t changed', () => {
    expect(diff(openDraft(live), live)).toEqual([]);
    const wing = modulesFor('wings')[1].id;
    const d = setPart(setModule(setHull(openDraft(live), true, null), 'wings', wing), 'booster', 'srb');
    const out = diff(d, live);
    expect(out.map((c) => c.slot)).toEqual(['build', 'wings', 'booster']);
    expect(out[0]).toEqual({ slot: 'build', from: 'stock', to: 'garage', module: true });
    expect(out[1]).toEqual({ slot: 'wings', from: STOCK_BUILD.wings, to: wing, module: true });
    expect(out[2]).toEqual({ slot: 'booster', from: STOCK, to: 'srb', module: false });
  });

  it('lists a tune change as a module change flagged tune, null for the ship as it came', () => {
    const d = setModule(setModule(openDraft(live), 'engines', 'quad'), 'cockpit', 'canopy');
    expect(diff(d, live)).toEqual([
      { slot: 'cockpit', from: null, to: 'canopy', module: true, tune: true },
      { slot: 'engines', from: null, to: 'quad', module: true, tune: true },
    ]);
    const flown = { build: null, loadout: { ...STOCK_LOADOUT }, tune: { engines: 'quad', tail: 'twinfin' } };
    const back = setModule(setModule(openDraft(flown), 'engines', STOCK_BUILD.engines), 'tail', 'fin');
    expect(back.tune).toEqual({});
    expect(diff(back, flown)).toEqual([
      { slot: 'engines', from: 'quad', to: null, module: true, tune: true },
      { slot: 'tail', from: 'twinfin', to: null, module: true, tune: true },
    ]);
    expect(diff(openDraft(flown), flown)).toEqual([]);
  });

  it('puts the tune after the hull switch and before the parts', () => {
    const flown = { build: { ...STOCK_BUILD }, loadout: { ...STOCK_LOADOUT }, tune: { engines: 'quad' } };
    const d = setPart(setModule(setHull(openDraft(flown), false), 'cockpit', 'canopy'), 'booster', 'srb');
    expect(diff(d, flown).map((c) => c.slot)).toEqual(['build', 'cockpit', 'booster']);
    expect(diff(d, flown)[0]).toEqual({ slot: 'build', from: 'garage', to: 'stock', module: true });
  });

  it('a tune staged while a garage build is flown isn’t a change: it isn’t flown', () => {
    const d = setHull(setModule(openDraft(live), 'engines', 'quad'), true, null);
    expect(diff(d, live).map((c) => c.slot)).toEqual(['build']);
  });

  it('takes a part off before putting a hungrier one on', () => {
    const from = { build: null, loadout: { ...STOCK_LOADOUT, booster: 'portal' } };
    const d = setPart(setPart(openDraft(from), 'booster', STOCK), 'shields', 'fastcharge');
    expect(diff(d, from).map((c) => c.slot)).toEqual(['booster', 'shields']);
    const d2 = setPart(setPart(openDraft(from), 'shields', 'fastcharge'), 'booster', STOCK);
    expect(diff(d2, from).map((c) => c.slot)).toEqual(['booster', 'shields']);
  });
});

describe('sellable', () => {
  it('leaves out what any crew flies', () => {
    const e = wallet({ owned: [srb.key, rcs.key] });
    const out = sellable({ loadouts: { falcon: { booster: 'srb' } }, hulls: {}, garage: {} }, e);
    expect(out).toEqual([{ item: rcs, refund: refundOf(rcs) }]);
    expect(out[0].refund).toBe(Math.floor(rcs.price * 0.6));
    expect(sellable({ loadouts: {}, hulls: {}, garage: {} }, null)).toEqual([]);
  });

  it('leaves out a module in a hull or the garage, and whatever the draft keeps', () => {
    const wing = modulesFor('wings').find((m) => m.id !== STOCK_BUILD.wings && m.id !== 'none');
    const key = itemOfModule('wings', wing.id).key;
    const e = wallet({ owned: [key, rcs.key] });
    expect(sellable({ loadouts: {}, hulls: {}, garage: { xwing: { ...STOCK_BUILD, wings: wing.id } } }, e).map((s) => s.item.key)).toEqual([rcs.key]);
    expect(sellable({ loadouts: {}, hulls: {}, garage: {}, keep: [rcs.key] }, e).map((s) => s.item.key)).toEqual([key]);
  });

  it('leaves out a module in any crew’s tune', () => {
    const quad = itemOfModule('engines', 'quad');
    const e = wallet({ owned: [quad.key, rcs.key] });
    expect(sellable({ loadouts: {}, hulls: {}, garage: {}, tune: { rv: { engines: 'quad' } } }, e).map((s) => s.item.key)).toEqual([rcs.key]);
    expect(sellable({ loadouts: {}, hulls: {}, garage: {}, tune: { rv: { hull: 'needle', engines: 'nonsense' } } }, e).map((s) => s.item.key).sort()).toEqual([quad.key, rcs.key].sort());
  });

  it('names catalogue items by part and module', () => {
    expect(itemOfPart('booster', 'srb')).toBe(itemFor('part', 'booster', 'srb'));
    expect(itemOfPart('paint', 'portal')).toBe(itemFor('paint', 'paint', 'portal'));
    expect(itemOfModule('wings', STOCK_BUILD.wings).stock).toBe(true);
  });
});

describe('fitDraft', () => {
  it('fits every part change in diff’s order, and keeps the saved loadout’s others', () => {
    const from = { build: null, loadout: { ...STOCK_LOADOUT, booster: 'portal' } };
    const d = setPart(setPart(openDraft(from), 'booster', STOCK), 'shields', 'fastcharge');
    const saved = { ...STOCK_LOADOUT, booster: 'portal', fins: 'fins' };
    const r = fitDraft('rv', d, diff(d, from), { saved, unlocked: ['showmewhatyougot', 'captain'] });
    expect(r.ok).toBe(true);
    expect(r.loadout.booster).toBe(STOCK);
    expect(r.loadout.shields).toBe('fastcharge');
    expect(r.saved).toEqual({ ...saved, booster: STOCK, shields: 'fastcharge' });
  });

  it('refuses the lot when a fit won’t go on (another tab took the plant)', () => {
    const d = setPart(setPart(openDraft(live), 'booster', 'portal'), 'thrusters', 'vector');
    const r = fitDraft('rv', { ...d, loadout: { ...d.loadout, shields: 'fastcharge' } }, diff({ ...d, loadout: { ...d.loadout, shields: 'fastcharge' } }, live), { saved: {}, unlocked: ['showmewhatyougot', 'grounded', 'captain'] });
    expect(r).toMatchObject({ ok: false, why: 'power' });
  });
});

describe('fitDraft with a tune', () => {
  it('fits parts on the plant the tune leaves, and refuses a part it can’t run', () => {
    const d = setPart(setModule(openDraft(live), 'engines', 'quad'), 'booster', 'portal'); // (2 + 3 on the RV’s 5)
    const ok = fitDraft('rv', d, diff(d, live), { saved: {}, unlocked: ['showmewhatyougot'] });
    expect(ok.ok).toBe(true);
    expect(ok.loadout.booster).toBe('portal');
    const over = setPart(d, 'thrusters', 'rcs'); // (and 1 more)
    expect(fitDraft('rv', over, diff(over, live), { saved: {}, unlocked: ['showmewhatyougot'] })).toMatchObject({ ok: false, why: 'power' });
    expect(fitDraft('xwing', over, diff(over, live), { saved: {}, unlocked: ['showmewhatyougot'] }).ok).toBe(true);
  });
});

describe('hullName', () => {
  it('says the garage build’s code, or the crew’s own ship, tuned once a module is on it', () => {
    expect(hullName(openDraft(live))).toBe('Stock hull');
    expect(hullName(setModule(openDraft(live), 'engines', 'quad'))).toBe('Stock hull · tuned');
    expect(hullName(setModule(setModule(openDraft(live), 'engines', 'quad'), 'engines', STOCK_BUILD.engines))).toBe('Stock hull');
    expect(hullName(setHull(setModule(openDraft(live), 'engines', 'quad'), true, null))).toBe(`Garage build ${buildCode(STOCK_BUILD)}`);
  });
});

describe('draftKeys', () => {
  it('names every non-stock part, paint and module a draft holds, owned or not', () => {
    const wing = modulesFor('wings').find((m) => m.id !== STOCK_BUILD.wings && m.id !== 'none');
    const d = setModule(setPart(setPart(openDraft(live), 'booster', 'srb'), 'paint', 'portal'), 'wings', wing.id);
    expect(draftKeys(d).sort()).toEqual([itemOfModule('wings', wing.id).key, itemOfPart('booster', 'srb').key, itemOfPart('paint', 'portal').key].sort());
    expect(draftKeys(openDraft(live))).toEqual([]);
  });

  it('names a garage build’s modules, and a tune’s only while the stock ship is the hull', () => {
    const t = setModule(openDraft(live), 'engines', 'quad');
    expect(draftKeys(t)).toEqual([itemOfModule('engines', 'quad').key]);
    const g = setModule(setHull(t, true, null), 'wings', 'delta');
    expect(draftKeys(g)).toEqual([itemOfModule('wings', 'delta').key]);
  });

  it('kept from sale: an owned part staged on the draft isn’t sellable', () => {
    const e = wallet({ owned: [srb.key, rcs.key] });
    const d = setPart(openDraft(live), 'booster', 'srb');
    expect(sellable({ loadouts: {}, hulls: {}, garage: {}, keep: draftKeys(d) }, e).map((s) => s.item.key)).toEqual([rcs.key]);
  });
});

describe('hullLine', () => {
  it('says when a garage build flies in place of the crew’s own ship, and nothing otherwise', () => {
    expect(hullLine(null, 'An X-wing')).toBeNull();
    const b = { ...STOCK_BUILD, seed: 5 };
    expect(hullLine(b, 'An X-wing')).toBe(`Flying garage build ${buildCode(b)} in place of an X-wing. Pick Stock in the shipyard’s Hull to fly it again.`);
    expect(hullLine(b, '')).toBe(`Flying garage build ${buildCode(b)}. Pick Stock in the shipyard’s Hull to fly the crew’s own ship again.`);
  });
});
