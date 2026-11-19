import { describe, expect, it } from 'vitest';
import { createEconomy } from '../economy';
import { createMarket } from './store';
import { HOME, boardOf, buyGood, jettison, sellGood, stationFor } from './trade';

const setup = (credits = 1000) => {
  const economy = createEconomy();
  if (credits) economy.credit(credits, 'test');
  const market = createMarket();
  return { economy, market, crew: 'rv', room: 16, t: 1.7e12 };
};
const station = stationFor({ id: 'E:4,2:w10003', cube: [4, 0, 2] });

describe('trading at a station', () => {
  it('reads a generated station’s trade from its place', () => {
    expect(station).toMatchObject({ stationId: 'E:4,2:w10003', sector: [4, 0, 2] });
    expect(stationFor({ id: 'E:4,2:w10003', cube: [4, 0, 2] })).toEqual(station);
  });

  it('lists what it sells, with a price to buy and to sell', () => {
    const s = setup();
    const board = boardOf({ ...s, station });
    expect(board.length).toBeGreaterThan(3);
    for (const row of board) expect(row.buy).toBeGreaterThan(row.sell);
    expect(board.every((r) => r.have === 0 && !r.canSell)).toBe(true);
  });

  it('buys into the hold and sells back for less', () => {
    const s = setup();
    const good = boardOf({ ...s, station })[0].id;
    const b = buyGood({ ...s, station, good, n: 3 });
    expect(b).toMatchObject({ ok: true, n: 3 });
    expect(s.economy.credits).toBe(1000 - b.paid);
    expect(s.market.hold('rv', 16).count(good)).toBe(3);
    const r = sellGood({ ...s, station, good, n: 3 });
    expect(r).toMatchObject({ ok: true, n: 3 });
    expect(r.got).toBeLessThan(b.paid);
    expect(s.economy.credits).toBe(1000 - b.paid + r.got);
    expect(s.market.hold('rv', 16).count(good)).toBe(0);
  });

  it('sells each unit for a little less than the last', () => {
    const s = setup(5000);
    buyGood({ ...s, station: HOME, good: 'food', n: 10 });
    const first = sellGood({ ...s, station: HOME, good: 'food', n: 1, t: s.t + 3.6e6 * 24 }).got;
    const many = sellGood({ ...s, station: HOME, good: 'food', n: 9, t: s.t + 3.6e6 * 24 }).got;
    expect(many).toBeLessThan(first * 9);
  });

  it('refuses with no wallet, nothing to sell, no room or no credits', () => {
    const s = setup(0);
    expect(buyGood({ ...s, economy: null, station: HOME, good: 'food' })).toMatchObject({ ok: false, why: 'shop' });
    expect(sellGood({ ...s, station: HOME, good: 'food' })).toMatchObject({ ok: false, why: 'none' });
    expect(buyGood({ ...s, station: HOME, good: 'food' })).toMatchObject({ ok: false, why: 'credits' });
    expect(buyGood({ ...s, station: HOME, good: 'spice' })).toMatchObject({ ok: false, why: 'unsold' });
    const r = setup(100000);
    expect(buyGood({ ...r, room: 2, station: HOME, good: 'food', n: 5 })).toMatchObject({ ok: true, n: 2 });
    expect(buyGood({ ...r, room: 2, station: HOME, good: 'food', n: 1 })).toMatchObject({ ok: false, why: 'room' });
    expect(jettison({ ...r, room: 2, good: 'food', n: 9 })).toBe(2);
    expect(r.economy.credits).toBeGreaterThan(0);
  });
});
