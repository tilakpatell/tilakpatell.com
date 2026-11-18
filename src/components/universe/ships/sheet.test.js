import { describe, expect, it } from 'vitest';
import { createEconomy } from '../economy';
import { SYSTEMS } from './profiles';
import { shipSheet, systemRows } from './sheet';
import { tierItem } from './tiers';

// a wallet in memory with this many credits (economy.js's, no saves)
const wallet = (credits) => {
  const e = createEconomy();
  e.grant([]);
  e.earn('warWin', Math.ceil(credits / 250)); // (250 a win: at least `credits`)
  return e;
};

describe('the Systems tab’s rows', () => {
  it('lists the seven systems at Mk I, each with its next tier for sale', () => {
    const rows = systemRows({ crew: 'falcon', economy: wallet(600) });
    expect(rows.map((r) => r.id)).toEqual(SYSTEMS);
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
    expect(rows.reactor.value).toBe('9 MW');
    expect(rows.reactor.nextValue).toBe('10 MW');
    expect(rows.engines.pill).toBe(null); // (no wallet yet: nothing for sale)
  });

  it('names the whole sector, and stops at Mk V', () => {
    const e = wallet(30000);
    for (let n = 2; n <= 3; n++) e.buy(tierItem('cruiser', 'scanner', n));
    const scanner = systemRows({ crew: 'cruiser', economy: e }).find((r) => r.id === 'scanner');
    expect(scanner).toMatchObject({ tier: 3, mk: 'Mk III', value: 'the whole sector' });
    expect(scanner.pill).toMatchObject({ kind: 'locked' });
    expect(scanner.pill.text).toMatch(/nebula silk/);
    e.grant(['tier:cruiser:scanner:4', 'tier:cruiser:scanner:5']);
    const top = systemRows({ crew: 'cruiser', economy: e }).find((r) => r.id === 'scanner');
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
    expect(sheet.systems).toHaveLength(7);
    expect(sheet.hold).toEqual({ used: 0, room: 12, goods: [] });
    expect(sheet.explored).toEqual({ sectors: 0, systems: 0, surveyed: 0, furthest: 0 });
  });

  it('reads a garage build as neutral', () => {
    expect(shipSheet({ crew: 'falcon', build: { hull: 'dart' }, economy: null })).toMatchObject({ role: 'Garage build', signature: null, credits: 0 });
  });
});
