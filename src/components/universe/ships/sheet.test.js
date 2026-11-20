import { describe, expect, it } from 'vitest';
import { createEconomy } from '../economy';
import { SYSTEMS } from './profiles';
import { LIVE, partsSheet, shipSheet, signatureLine, systemRows } from './sheet';
import { tierItem } from './tiers';

// a wallet in memory with this many credits (economy.js's, no saves)
const wallet = (credits) => {
  const e = createEconomy();
  e.grant([]);
  e.earn('warWin', Math.ceil(credits / 250)); // (250 a win: at least `credits`)
  return e;
};

describe('the Systems tab’s rows', () => {
  it('lists the systems a tier does something for, at Mk I, each with its next tier for sale', () => {
    const rows = systemRows({ crew: 'falcon', economy: wallet(600) });
    expect(rows.map((r) => r.id)).toEqual(SYSTEMS.filter((s) => LIVE.includes(s)));
    expect(LIVE).toEqual(['engines', 'pulse', 'hyperdrive', 'shields', 'scanner', 'hold', 'reactor']);
    const pulse = rows.find((r) => r.id === 'pulse');
    expect(pulse).toMatchObject({ label: 'Pulse drive', tier: 1, mk: 'Mk I', value: '330 a second', nextValue: '462 a second' });
    expect(pulse.item.key).toBe('tier:falcon:pulse:2');
    expect(pulse.pill).toMatchObject({ kind: 'buy' });
  });

  it('says each system’s number in words a pilot reads', () => {
    const rows = Object.fromEntries(systemRows({ crew: 'falcon', economy: null }).map((r) => [r.id, r]));
    expect(rows.engines.value).toBe('×1.00');
    expect(rows.hyperdrive.value).toBe('3 sectors, every 4.5 s');
    expect(rows.hyperdrive.nextValue).toBe('6 sectors, every 4.1 s');
    expect(rows.shields.value).toBe('×1.10');
    expect(rows.scanner.value).toBe('10,000 out');
    expect(rows.scanner.nextValue).toBe('25,000 out');
    expect(rows.hold.value).toBe('12 units');
    expect(rows.hold.nextValue).toBe('19 units');
    expect(rows.reactor.value).toBe('9 MW');
    expect(rows.reactor.nextValue).toBe('10 MW');
    expect(rows.engines.pill).toBe(null); // (no wallet yet: nothing for sale)
  });

  it('locks Mk IV on its rare, and stops at Mk V', () => {
    const e = wallet(30000);
    for (let n = 2; n <= 3; n++) e.buy(tierItem('cruiser', 'shields', n));
    const shields = systemRows({ crew: 'cruiser', economy: e }).find((r) => r.id === 'shields');
    expect(shields).toMatchObject({ tier: 3, mk: 'Mk III' });
    expect(shields.pill).toMatchObject({ kind: 'locked' });
    expect(shields.pill.text).toBe('Bring 2 relics (found 10 or more sectors out)');
    e.grant(['tier:cruiser:shields:4', 'tier:cruiser:shields:5']);
    const top = systemRows({ crew: 'cruiser', economy: e }).find((r) => r.id === 'shields');
    expect(top).toMatchObject({ tier: 5, mk: 'Mk V', item: null, pill: null, nextValue: null });
  });

  it('says what it’s short of', () => {
    const rows = systemRows({ crew: 'rv', economy: createEconomy() });
    expect(rows[0].pill).toMatchObject({ kind: 'short' });
  });
});

describe('the ship’s read-out', () => {
  it('is the ship, its role, its systems and the wallet', () => {
    const e = wallet(250);
    const sheet = shipSheet({ crew: 'falcon', economy: e });
    expect(sheet).toMatchObject({ ship: 'falcon', role: 'Smuggler and runner', signature: 'falcon', credits: e.credits, data: 0 });
    expect(sheet.systems).toHaveLength(LIVE.length);
    expect(sheet.hold).toEqual({ used: 0, room: 12, goods: [] });
    expect(sheet.explored).toEqual({ sectors: 0, systems: 0, surveyed: 0, furthest: 0 });
  });

  it('reads a garage build as neutral', () => {
    expect(shipSheet({ crew: 'falcon', build: { hull: 'dart' }, economy: null })).toMatchObject({ role: 'Garage build', signature: null, credits: 0 });
  });
});

describe('the read-out of an explorer', () => {
  it('reads the record, or its read-out', () => {
    const counts = { sectors: 4, systems: 11, surveyed: 1, furthest: 3, data: 120 };
    expect(shipSheet({ crew: 'cruiser', economy: null, record: { record: () => counts } })).toMatchObject({ data: 120, explored: { sectors: 4, systems: 11, surveyed: 1, furthest: 3 } });
    expect(shipSheet({ crew: 'cruiser', economy: null, record: counts }).data).toBe(120);
  });
});

describe('the Systems tab’s head', () => {
  it('names the ship’s role and its signature', () => {
    expect(signatureLine('falcon')).toMatchObject({ role: 'Smuggler and runner' });
    expect(signatureLine('falcon').line).toMatch(/compartments/);
    expect(signatureLine('falcon', { hull: 'dart' })).toEqual({ role: 'Garage build', line: 'A garage build: no signature of its own.' });
  });
});

describe('the parts read-out', () => {
  it('lists each slot, what’s fitted and what’s on offer, with the locks in words', () => {
    const sheet = partsSheet({ crew: 'falcon', loadout: { booster: 'srb' }, economy: createEconomy(), unlocked: [] });
    const boosters = sheet.find((s) => s.slot === 'booster');
    expect(boosters).toMatchObject({ label: 'Boosters', fitted: { id: 'srb', name: 'Twin solid boosters' } });
    expect(boosters.fitted.does).toContain('Agility −5%');
    const portal = boosters.options.find((o) => o.id === 'portal');
    expect(portal).toMatchObject({ open: false, owned: false });
    expect(portal.lock).toMatch(/^Locked\. Reach level 7, or /);
    expect(boosters.options.find((o) => o.id === 'iondrive')).toMatchObject({ name: 'Ion drive' });
    expect(sheet.map((s) => s.slot)).toEqual(['booster', 'thrusters', 'guns', 'shields', 'fins', 'secondary', 'ordnance']);
  });
});
