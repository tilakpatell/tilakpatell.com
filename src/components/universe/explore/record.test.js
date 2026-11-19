import { describe, expect, it } from 'vitest';
import { createSaves } from '../../../runtime/saves';
import { EXPLORE_KEY, createRecord } from './record';

const memory = (init = {}) => {
  const m = new Map(Object.entries(init).map(([k, v]) => [k, JSON.stringify(v)]));
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const open = (local) => createRecord({ saves: createSaves({ local, session: memory() }), now: () => 1000, later: (fn) => (fn(), 1), cancel: () => {} });

describe('the explorer’s record', () => {
  it('charts a sector once, paying once, and counts how far out', () => {
    const r = open(memory());
    expect(r.chart([3, -1, 7], 40)).toBe(40);
    expect(r.chart([3, -1, 7], 40)).toBe(0);
    expect(r.isCharted([3, -1, 7])).toBe(true);
    expect(r.record()).toEqual({ sectors: 1, systems: 0, surveyed: 0, furthest: 7, data: 40 });
  });

  it('scans each system and thing once', () => {
    const r = open(memory());
    expect(r.scanSystem([1, 0, 1], 3, 25)).toBe(25);
    expect(r.scanSystem([1, 0, 1], 3, 25)).toBe(0);
    expect(r.scanThing([1, 0, 1], 'E:1,1:t9', 30)).toBe(30);
    expect(r.scanThing([1, 0, 1], 'E:1,1:t9', 30)).toBe(0);
    expect(r.isScanned([1, 0, 1], 3)).toBe(true);
    expect(r.scannedIn([1, 0, 1])).toBe(1);
    expect(r.data).toBe(55);
  });

  it('pays a survey once, when every system is scanned', () => {
    const r = open(memory());
    r.chart([2, 0, 2]);
    r.scanSystem([2, 0, 2], 0);
    expect(r.survey([2, 0, 2], 2, 250)).toBe(0);
    r.scanSystem([2, 0, 2], 1);
    expect(r.survey([2, 0, 2], 2, 250)).toBe(250);
    expect(r.survey([2, 0, 2], 2, 250)).toBe(0);
    expect(r.record().surveyed).toBe(1);
  });

  it('pays the bank out once, and keeps it all across a reload', () => {
    const local = memory();
    const a = open(local);
    a.chart([5, 0, 0], 40);
    a.scanSystem([5, 0, 0], 2, 25);
    const b = open(local);
    expect(b.data).toBe(65);
    expect(b.isScanned([5, 0, 0], 2)).toBe(true);
    expect(b.payOut()).toBe(65);
    expect(b.payOut()).toBe(0);
    expect(open(local).data).toBe(0);
  });

  it('reads junk as an empty record', () => {
    const r = open(memory({ [EXPLORE_KEY]: { v: 1, data: { charted: { nope: 1, '1,2,3': 'x' }, data: -4, counts: 'z' } } }));
    expect(r.record()).toEqual({ sectors: 0, systems: 0, surveyed: 0, furthest: 0, data: 0 });
    expect(r.charted()).toEqual([]);
  });
});
