import { describe, expect, it } from 'vitest';
import { FLIGHT, FLIGHT_MS, TITLE, flightAt } from './mapFlight';
import { framing } from './mapFraming';
import { STOPS } from './road';

const stop = (id) => {
  const s = STOPS.find((x) => x.id === id);
  return [s.x, s.y];
};

describe('the opening’s flight down the road', () => {
  it('starts over Hobbiton', () => {
    expect(flightAt(0).at).toEqual(stop('hobbiton'));
    expect(flightAt(0).zoom).toBe(1.1);
    expect(flightAt(0).done).toBe(false);
  });
  it('flies over each stop where the road puts it, and ends on the hub', () => {
    const ids = ['hobbiton', 'bree', 'rivendell', 'moria', 'lorien', 'amon-hen', 'mount-doom'];
    expect(FLIGHT.slice(0, ids.length).map((k) => k.at)).toEqual(ids.map(stop));
    expect(FLIGHT.map((k) => k.t)).toEqual([0, 1, 1.8, 2.6, 3.3, 4, 4.7, 5.5]);
    expect(FLIGHT[6].zoom).toBe(1.3);
    expect(FLIGHT.at(-1)).toEqual({ t: 5.5, ...framing() });
  });
  it('is over each key at its time', () => {
    for (const k of FLIGHT) {
      const f = flightAt(k.t * 1000);
      expect(f.at[0], String(k.t)).toBeCloseTo(k.at[0], 9);
      expect(f.at[1], String(k.t)).toBeCloseTo(k.at[1], 9);
      expect(f.zoom, String(k.t)).toBeCloseTo(k.zoom, 9);
    }
  });
  it('runs east down the road all the way to the Mountain', () => {
    // the West-gate of Moria lies south-east of Rivendell, so no leg turns back west
    let x = flightAt(0).at[0];
    for (let ms = 100; ms <= 4700; ms += 100) {
      const next = flightAt(ms).at[0];
      expect(next, String(ms)).toBeGreaterThanOrEqual(x - 1e-9);
      x = next;
    }
    expect(flightAt(4700).at[0]).toBeGreaterThan(flightAt(0).at[0]);
  });
  it('eases each leg: still at the keys, quickest between them', () => {
    const a = flightAt(1000).at[0];
    const mid = flightAt(1400).at[0];
    const b = flightAt(1800).at[0];
    expect(mid).toBeCloseTo((a + b) / 2, 9);
    expect(flightAt(1010).at[0] - a).toBeLessThan((b - a) / 80);
  });
  it('ends on the hub’s framing, done, and stays there', () => {
    expect(flightAt(5500)).toEqual({ ...framing(), done: true });
    expect(flightAt(6000)).toEqual({ ...framing(), done: true });
    expect(flightAt(5499).done).toBe(false);
  });
  it('lasts as long as its last key', () => {
    expect(FLIGHT_MS).toBe(FLIGHT.at(-1).t * 1000);
    expect(FLIGHT_MS).toBe(5500);
    expect(TITLE).toEqual({ inMs: 1500, outMs: 4500 });
  });
});
